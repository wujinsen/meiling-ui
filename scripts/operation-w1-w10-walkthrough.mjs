#!/usr/bin/env node
/**
 * Operation W1–W10 API walkthrough (user-center :8888)
 * Usage: node scripts/operation-w1-w10-walkthrough.mjs
 */
import http from 'node:http'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const UC_BASE = process.env.UC_BASE ?? 'http://127.0.0.1:8888'
const USER = process.env.OP_E2E_USER ?? 'admin'
const PASS = process.env.OP_E2E_PASS ?? '123456'
const SKIP_MUTATING = process.env.OP_E2E_SKIP_MUTATING === '1'

const W9_PROJECT_MARKER = 'w9-batch-smoke'

function runMysql(sql) {
  const bin =
    process.env.MYSQL_BIN ??
    (process.platform === 'win32'
      ? 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe'
      : 'mysql')
  if (!existsSync(bin)) return false
  const r = spawnSync(
    bin,
    [
      `-u${process.env.MYSQL_USER ?? 'root'}`,
      `--password=${process.env.MYSQL_PASSWORD ?? '12345678'}`,
      `-h${process.env.MYSQL_HOST ?? '127.0.0.1'}`,
      `-P${process.env.MYSQL_PORT ?? '3306'}`,
      '--batch',
      process.env.MYSQL_DATABASE ?? 'moli',
      '-e',
      sql,
    ],
    { encoding: 'utf8' },
  )
  return r.status === 0
}

function pickW4Project(projects) {
  return (
    projects?.find((p) => !p.remark?.includes(W9_PROJECT_MARKER) && (p.serverIds?.length ?? 0) >= 1) ??
    projects?.find((p) => !p.remark?.includes(W9_PROJECT_MARKER))
  )
}

function prepareW9Project(token, w9Project, servers) {
  if (!w9Project?.id || !w9Project.serverIds?.length) return false
  const ids = w9Project.serverIds
  runMysql(`UPDATE operation_project_deploy_info SET server_id = NULL WHERE id = ${w9Project.id};`)
  return true
}
const __dirname = dirname(fileURLToPath(import.meta.url))
const results = {}

const pass = (id, detail) => {
  results[id] = { ok: true, detail }
  console.log(`✅ ${id}${detail ? ` — ${detail}` : ''}`)
}
const fail = (id, detail) => {
  results[id] = { ok: false, detail }
  console.error(`❌ ${id}${detail ? ` — ${detail}` : ''}`)
}
const skip = (id, detail) => {
  results[id] = { ok: null, detail }
  console.log(`⏭ ${id} — ${detail}`)
}

function parseBase(url) {
  const u = new URL(url)
  return { host: u.hostname, port: Number(u.port || 80), pathPrefix: u.pathname.replace(/\/$/, '') }
}

async function request(method, path, body, token, headersExtra = {}, timeoutMs = 60_000) {
  const { host, port, pathPrefix } = parseBase(UC_BASE)
  const fullPath = `${pathPrefix}${path}`
  const data =
    body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body), 'utf8')
  const headers = { ...headersExtra }
  if (token) headers.Authorization = token
  if (data && !Buffer.isBuffer(body)) headers['Content-Type'] = 'application/json'
  if (data) headers['Content-Length'] = String(data.length)

  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: host, port, path: fullPath, method, headers }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let json
        try {
          json = JSON.parse(text)
        } catch {
          json = { raw: text.slice(0, 800) }
        }
        resolve({ status: res.statusCode, json })
      })
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout ${method} ${fullPath}`)))
    if (data) req.write(data)
    req.end()
  })
}

async function login() {
  const res = await request('POST', '/login', { userName: USER, password: PASS })
  if (res.json?.code !== 200 || !res.json?.data?.token) throw new Error(`login failed: ${JSON.stringify(res.json)}`)
  return res.json.data.token
}

function okData(res) {
  return res.json?.code === 200 ? res.json.data : null
}

const UPLOAD_PATHS = [
  '/opt/moli/frontend/dist/',
  '/opt/moli-project-distribute/moli-user-center/',
  '/opt/moli-project-distribute/moli-gateway/',
  '/opt/moli-project-distribute/moli-knowledge/',
]

function normalizeServiceKeys(raw) {
  if (!raw?.length) return ['user-center', 'gateway', 'knowledge']
  return raw
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim()
      if (entry && typeof entry === 'object' && entry.key) return String(entry.key).trim()
      return ''
    })
    .filter(Boolean)
}

function checkCountIdentity(row, label) {
  if (!row) return 'no row'
  const sc = row.serverCount
  const ids = row.serverIds
  if (typeof sc !== 'number') return `${label}: missing serverCount`
  if (!Array.isArray(ids)) return `${label}: missing serverIds`
  if (sc !== ids.length) return `${label}: serverCount=${sc} !== serverIds.length=${ids.length}`
  return null
}

async function listAll(token, base, pageSize = 50) {
  const res = await request('GET', `${base}/list?pageNum=1&pageSize=${pageSize}`, null, token)
  const page = okData(res)
  return page?.list ?? (Array.isArray(page) ? page : null)
}

async function main() {
  console.log(`Operation W1–W10 walkthrough → ${UC_BASE}\n`)
  const token = await login()
  console.log('logged in\n')

  // W1/W2/W2b — project list + detail
  const projListRes = await request('GET', '/operation/project/list?pageNum=1&pageSize=50', null, token)
  const projects = okData(projListRes)?.list ?? okData(projListRes)
  if (!Array.isArray(projects) || projects.length === 0) {
    fail('W1', 'project list empty or failed')
    fail('W2', 'no project to compare')
    fail('W2b', 'no project row')
  } else {
    const p = projects[0]
    const hasCounts =
      typeof p.serverCount === 'number' &&
      typeof p.componentCount === 'number' &&
      Array.isArray(p.serverIds)
    if (hasCounts) pass('W1', `project[0] serverCount=${p.serverCount} componentCount=${p.componentCount}`)
    else fail('W1', `missing *Count on list row: ${JSON.stringify(p).slice(0, 200)}`)

    const detailRes = await request('GET', `/operation/project/${p.id}`, null, token)
    const detail = okData(detailRes)
    if (
      detail &&
      detail.serverCount === p.serverCount &&
      detail.componentCount === p.componentCount
    ) {
      pass('W2', `id=${p.id} list/detail serverCount=${p.serverCount} componentCount=${p.componentCount}`)
    } else {
      fail(
        'W2',
        `mismatch list(${p.serverCount}/${p.componentCount}) vs detail(${detail?.serverCount}/${detail?.componentCount})`,
      )
    }

    const idErr = checkCountIdentity(p, 'list') || checkCountIdentity(detail, 'detail')
    if (!idErr) pass('W2b', `id=${p.id} serverCount=${p.serverCount} === serverIds.length`)
    else fail('W2b', idErr)
  }

  // component list counts (W1 supplement)
  const components = await listAll(token, '/operation/component')
  if (Array.isArray(components) && components.length > 0) {
    const c = components[0]
    if (typeof c.serverCount === 'number' && typeof c.projectCount === 'number') {
      pass('W1-comp', `component[0] serverCount=${c.serverCount} projectCount=${c.projectCount}`)
    }
  }

  const servers = await listAll(token, '/operation/server')
  if (Array.isArray(servers) && servers.length > 0) {
    const s = servers[0]
    if (typeof s.projectCount === 'number' && typeof s.componentCount === 'number') {
      pass('W1-srv', `server[0] projectCount=${s.projectCount} componentCount=${s.componentCount}`)
    }
  }

  // W3 — relations
  const relEntity = servers?.[0] ?? projects?.[0]
  const relType = servers?.[0] ? 'server' : 'project'
  if (relEntity?.id) {
    const relRes = await request('GET', `/operation/relations/${relType}/${relEntity.id}`, null, token)
    const rel = okData(relRes)
    if (rel?.entity && Array.isArray(rel.servers) && Array.isArray(rel.recentTasks)) {
      pass('W3', `${relType}/${relEntity.id} entity+servers+recentTasks ok`)
    } else {
      fail('W3', `bad relations vo: ${JSON.stringify(rel).slice(0, 300)}`)
    }
  } else {
    fail('W3', 'no entity for relations')
  }

  // W5 — list reverse filter (prefer server linked to a project)
  const filterServer = servers?.find((s) => (s.projectCount ?? 0) > 0) ?? servers?.[0]
  if (filterServer?.id) {
    const sid = filterServer.id
    const filtRes = await request('GET', `/operation/project/list?serverId=${sid}&pageNum=1&pageSize=50`, null, token)
    const filtered = okData(filtRes)?.list ?? okData(filtRes)
    if (Array.isArray(filtered)) {
      const allMatch = filtered.every(
        (row) => Array.isArray(row.serverIds) && row.serverIds.map(String).includes(String(sid)),
      )
      if (allMatch || filtered.length === 0) pass('W5', `?serverId=${sid} → ${filtered.length} rows`)
      else fail('W5', 'filtered rows contain unrelated serverId')
    } else fail('W5', 'filter list failed')
  } else {
    fail('W5', 'no server for filter')
  }

  // W6a — topology
  const topoRes = await request('GET', '/operation/topology', null, token)
  const topo = okData(topoRes)
  if (topo?.servers?.length && topo?.links) {
    pass('W6', `topology servers=${topo.servers.length} links=${topo.links.length}`)
  } else {
    fail('W6', `topology incomplete: ${JSON.stringify(topo).slice(0, 200)}`)
  }

  // W6b — component-links
  if (projects?.[0]?.id) {
    const clRes = await request('GET', `/operation/project/${projects[0].id}/component-links`, null, token)
    const cl = okData(clRes)
    if (cl && Array.isArray(cl.componentIds)) {
      pass('W6b', `project ${projects[0].id} componentIds=${cl.componentIds.length}`)
    } else {
      fail('W6b', 'component-links GET failed')
    }
  }

  // W4 — mutating links (optional)
  if (SKIP_MUTATING) {
    skip('W4', 'OP_E2E_SKIP_MUTATING=1')
  } else {
    const w4Project = pickW4Project(projects)
    if (w4Project?.id) {
      const pid = w4Project.id
      const linksRes = await request('GET', `/operation/project/${pid}/links`, null, token)
      const links = okData(linksRes)
      if (links && Array.isArray(links.serverIds)) {
        const one = links.serverIds.slice(0, 1)
        const putRes = await request('PUT', `/operation/project/${pid}/links`, { serverIds: one }, token)
        if (putRes.json?.code === 200) {
          const afterList = okData(await request('GET', '/operation/project/list?pageNum=1&pageSize=50', null, token))?.list
          const row = afterList?.find((r) => String(r.id) === String(pid))
          const afterDetail = okData(await request('GET', `/operation/project/${pid}`, null, token))
          if (row?.serverCount === 1 && afterDetail?.serverCount === 1 && row.serverCount === row.serverIds?.length) {
            pass('W4', `PUT links → serverCount=1 consistent`)
          } else {
            fail('W4', `after PUT counts: list=${row?.serverCount} detail=${afterDetail?.serverCount}`)
          }
          await request('PUT', `/operation/project/${pid}/links`, { serverIds: links.serverIds }, token)
        } else {
          fail('W4', `PUT links failed: ${JSON.stringify(putRes.json)}`)
        }
      } else {
        skip('W4', 'no project links to test')
      }
    } else {
      skip('W4', 'no safe project for links test')
    }
  }

  // W7 — create server returns id
  if (SKIP_MUTATING) {
    skip('W7', 'OP_E2E_SKIP_MUTATING=1')
  } else {
    const stamp = Date.now()
    const createBody = {
      serverName: `w7-e2e-${stamp}`,
      ip: '10.0.0.99',
      environment: 1,
      serverRole: 'app',
      tags: ['e2e'],
      remark: 'w7 walkthrough',
    }
    const createRes = await request('POST', '/operation/server', createBody, token)
    const newId = okData(createRes)
    if (newId && newId !== true && newId !== 'true') {
      pass('W7', `POST /server → id=${newId}`)
      await request('DELETE', `/operation/server/${newId}`, null, token)
    } else {
      fail('W7', `expected id, got ${JSON.stringify(createRes.json)}`)
    }
  }

  // W8/W9/W10 — need deploy infra; probe presets + recent tasks
  const presetsRes = await request('GET', '/operation/deploy/presets', null, token)
  const presets = okData(presetsRes)
  const sshServers = (servers ?? []).filter((s) => s.sshConfigured === true)
  const projectWithSsh = projects?.find((p) =>
    p.serverIds?.some((id) => sshServers.some((s) => String(s.id) === String(id))),
  )

  if (!projectWithSsh || sshServers.length < 1) {
    skip('W8', 'need project with SSH-configured server')
    skip('W9', 'need deploy targets')
    skip('W10', 'depends on running task')
  } else {
    const sshServer = sshServers[0]
    // W8 — file upload (server 201 + linked project)
    const boundary = `----opW8${Date.now()}`
    const fileContent = 'operation w8 walkthrough\n'
    const multipart = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="w8-test.txt"',
      'Content-Type: text/plain',
      '',
      fileContent,
      `--${boundary}`,
      `Content-Disposition: form-data; name="serverId"`,
      '',
      String(sshServer.id),
      `--${boundary}`,
      `Content-Disposition: form-data; name="targetPath"`,
      '',
      UPLOAD_PATHS[0],
      `--${boundary}`,
      `Content-Disposition: form-data; name="postAction"`,
      '',
      'none',
      `--${boundary}--`,
      '',
    ].join('\r\n')
    const uploadRes = await request(
      'POST',
      '/operation/file/upload',
      Buffer.from(multipart, 'utf8'),
      token,
      { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      120_000,
    )
    const taskId = okData(uploadRes)
    if (taskId) {
      pass('W8', `upload → taskId=${taskId}`)
      let finished = false
      let lastTask = null
      for (let i = 0; i < 40 && !finished; i++) {
        await new Promise((r) => setTimeout(r, 1500))
        const pollRes = await request('GET', `/operation/task/${taskId}?logOffset=0`, null, token)
        lastTask = okData(pollRes)
        finished = lastTask?.finished === true
      }
      if (lastTask?.finished && (lastTask.status === 'success' || lastTask.status === 'running')) {
        pass('W8-poll', `finished=${lastTask.finished} status=${lastTask.status}`)
      } else {
        fail('W8-poll', `task state: ${JSON.stringify(lastTask)?.slice(0, 300)}`)
      }
    } else {
      fail('W8', `upload failed: ${JSON.stringify(uploadRes.json)?.slice(0, 400)}`)
    }

    // W9 — batch deploy (use w9-batch-smoke seed project when present)
    const w9Project = projects?.find((p) => p.remark?.includes(W9_PROJECT_MARKER))
    if (w9Project) prepareW9Project(token, w9Project, servers)
    const w9Servers = w9Project?.serverIds?.filter((id) =>
      servers?.some((s) => String(s.id) === String(id) && s.sshConfigured === true),
    )
    const batchServerIds =
      w9Project && w9Servers?.length >= 2
        ? w9Servers.slice(0, 2)
        : [sshServer.id, ...(servers ?? []).map((s) => s.id).filter((id) => String(id) !== String(sshServer.id))].slice(0, 2)
    const batchProjectId = w9Project?.id ?? projectWithSsh.id
    const serviceKeys = normalizeServiceKeys(presets?.serviceKeys)
    if (batchServerIds.length >= 2 && serviceKeys.length) {
      const serviceKey = serviceKeys.includes('user-center') ? 'user-center' : serviceKeys[0]
      const steps = batchServerIds.map((serverId) => ({
        serverId,
        serviceKey,
        action: 'restart',
      }))
      const batchRes = await request(
        'POST',
        '/operation/deploy/batch/task',
        { projectId: batchProjectId, steps, stopOnFailure: true, intervalSeconds: 0 },
        token,
        {},
        30_000,
      )
      const batchTaskId = okData(batchRes)
      if (batchTaskId) {
        pass('W9', `batch/task → taskId=${batchTaskId}`)
        // W10 — cancel while running
        await new Promise((r) => setTimeout(r, 500))
        const cancelRes = await request('POST', `/operation/task/${batchTaskId}/cancel`, null, token)
        const cancelled = okData(cancelRes)
        if (cancelled?.status === 'cancelled' || cancelRes.json?.code === 200) {
          let endTask = cancelled
          for (let i = 0; i < 20; i++) {
            await new Promise((r) => setTimeout(r, 1000))
            const pollRes = await request('GET', `/operation/task/${batchTaskId}?logOffset=0`, null, token)
            endTask = okData(pollRes)
            if (endTask?.finished) break
          }
          if (endTask?.status === 'cancelled' && endTask.finished) {
            pass('W10', `cancel → status=cancelled finished=true`)
          } else {
            fail('W10', `after cancel: status=${endTask?.status} finished=${endTask?.finished}`)
          }
        } else {
          fail('W10', `cancel failed: ${JSON.stringify(cancelRes.json)?.slice(0, 300)}`)
        }
      } else {
        fail('W9', `batch/task failed: ${JSON.stringify(batchRes.json)?.slice(0, 400)}`)
        skip('W10', 'no batch task to cancel')
      }
    } else {
      skip('W9', `need ≥2 SSH servers (run npm run op:seed:w9); have ${batchServerIds.length}`)
      skip('W10', 'depends on W9 batch task')
    }
  }

  const summary = Object.entries(results).map(([id, r]) => ({
    id,
    result: r.ok === true ? 'PASS' : r.ok === false ? 'FAIL' : 'SKIP',
    detail: r.detail,
  }))
  const outPath = join(__dirname, '..', 'operation-w1-w10-walkthrough.log')
  writeFileSync(outPath, JSON.stringify({ at: new Date().toISOString(), UC_BASE, summary }, null, 2))
  console.log(`\nWrote ${outPath}`)

  const fails = summary.filter((s) => s.result === 'FAIL')
  process.exit(fails.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
