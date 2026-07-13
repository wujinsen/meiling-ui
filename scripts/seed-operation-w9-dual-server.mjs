#!/usr/bin/env node
/**
 * Seed W9 dual-server test data (user-center :8888 + MySQL moli).
 *
 * Creates:
 *   - server `w9-smoke-b` (SSH cloned from 201)
 *   - project `w9-batch-smoke` (projectName `moli-user-center` → serviceKey user-center)
 *   - N:N links [201, w9-smoke-b] + SQL clears primary server_id for multi-machine batch
 *
 * Env:
 *   UC_BASE (default http://127.0.0.1:8888)
 *   MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE
 *   MYSQL_BIN (default Windows MySQL 8.0 path)
 */
import http from 'node:http'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const UC_BASE = process.env.UC_BASE ?? 'http://127.0.0.1:8888'
const USER = process.env.OP_E2E_USER ?? 'admin'
const PASS = process.env.OP_E2E_PASS ?? '123456'
const MYSQL_BIN =
  process.env.MYSQL_BIN ??
  (process.platform === 'win32'
    ? 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe'
    : 'mysql')
const MYSQL = {
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: process.env.MYSQL_PORT ?? '3306',
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? '12345678',
  database: process.env.MYSQL_DATABASE ?? 'moli',
}

const W9_SERVER_NAME = 'w9-smoke-b'
const W9_PROJECT_NAME = 'w9-batch-smoke'
const W9_PROJECT_SERVICE_NAME = 'moli-user-center'
const PRIMARY_SSH_SERVER_ID = '201'

function parseBase(url) {
  const u = new URL(url)
  return { host: u.hostname, port: Number(u.port || 80), pathPrefix: u.pathname.replace(/\/$/, '') }
}

async function request(method, path, body, token) {
  const { host, port, pathPrefix } = parseBase(UC_BASE)
  const fullPath = `${pathPrefix}${path}`
  const data = body == null ? null : Buffer.from(JSON.stringify(body), 'utf8')
  const headers = {}
  if (token) headers.Authorization = token
  if (data) {
    headers['Content-Type'] = 'application/json'
    headers['Content-Length'] = String(data.length)
  }
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
          json = { raw: text.slice(0, 500) }
        }
        resolve({ status: res.statusCode, json })
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function login() {
  const res = await request('POST', '/login', { userName: USER, password: PASS })
  if (res.json?.code !== 200 || !res.json?.data?.token) {
    throw new Error(`login failed: ${JSON.stringify(res.json)}`)
  }
  return res.json.data.token
}

function okData(res) {
  return res.json?.code === 200 ? res.json.data : null
}

function runMysql(sql) {
  if (!existsSync(MYSQL_BIN)) {
    throw new Error(`mysql client not found: ${MYSQL_BIN}`)
  }
  const args = [
    `-u${MYSQL.user}`,
    `--password=${MYSQL.password}`,
    `-h${MYSQL.host}`,
    `-P${MYSQL.port}`,
    '--batch',
    MYSQL.database,
    '-e',
    sql,
  ]
  const r = spawnSync(MYSQL_BIN, args, { encoding: 'utf8' })
  if (r.status !== 0) {
    throw new Error(`mysql failed: ${r.stderr || r.stdout}`)
  }
  return (r.stdout || '').trim()
}

async function listServers(token) {
  const page = okData(await request('GET', '/operation/server/list?pageNum=1&pageSize=100', null, token))
  return page?.list ?? []
}

async function listProjects(token) {
  const page = okData(await request('GET', '/operation/project/list?pageNum=1&pageSize=100', null, token))
  return page?.list ?? []
}

async function ensureW9ServerB(token, primary) {
  const existing = (await listServers(token)).find((s) => s.serverName === W9_SERVER_NAME)
  if (existing?.id) {
    console.log(`server ${W9_SERVER_NAME} exists id=${existing.id}`)
    return String(existing.id)
  }
  const body = {
    serverName: W9_SERVER_NAME,
    ip: `10.255.${(Date.now() % 200) + 1}.${(Date.now() % 200) + 1}`,
    innerIp: '127.0.0.3',
    port: '22',
    environment: 1,
    serverRole: 'app',
    tags: ['w9', 'smoke'],
    remark: 'W9 dual-server walkthrough seed (SSH cloned from 201)',
  }
  const res = await request('POST', '/operation/server', body, token)
  if (res.json?.code !== 200 || res.json.data == null) {
    throw new Error(`create server failed: ${JSON.stringify(res.json)}`)
  }
  const id = String(res.json.data)
  console.log(`created server ${W9_SERVER_NAME} id=${id}`)
  return id
}

async function ensureW9Project(token, serverA, serverB, primary) {
  const projects = await listProjects(token)
  let project = projects.find(
    (p) => p.remark?.includes(W9_PROJECT_NAME) || (p.projectName === W9_PROJECT_SERVICE_NAME && p.remark?.includes('W9')),
  )
  if (!project) {
    const body = {
      projectName: W9_PROJECT_SERVICE_NAME,
      remark: `${W9_PROJECT_NAME} · W9 多机 batch 联调（勿删）`,
      environment: 1,
      url: 'http://localhost:8888',
      deployPath: '/opt/moli/moli-server',
      port: '8888',
      serverId: serverA,
      serverIds: [serverA, serverB],
      serverIp: primary.ip,
      innerIp: primary.innerIp ?? primary.ip,
    }
    const res = await request('POST', '/operation/project', body, token)
    if (res.json?.code !== 200 || res.json.data == null) {
      throw new Error(`create project failed: ${JSON.stringify(res.json)}`)
    }
    const id = String(res.json.data)
    console.log(`created project ${W9_PROJECT_NAME} id=${id}`)
    project = { id, projectName: W9_PROJECT_NAME }
  } else {
    console.log(`project ${W9_PROJECT_NAME} exists id=${project.id}`)
  }
  const pid = String(project.id)
  const linksRes = await request(
    'PUT',
    `/operation/project/${pid}/links`,
    { serverIds: [serverA, serverB] },
    token,
  )
  if (linksRes.json?.code !== 200) {
    throw new Error(`save links failed: ${JSON.stringify(linksRes.json)}`)
  }
  console.log(`linked project ${pid} → servers [${serverA}, ${serverB}]`)
  return pid
}

function cloneSshAndClearPrimary(serverBId, projectId) {
  runMysql(`
UPDATE operation_server_info dst
INNER JOIN operation_server_info src ON src.id = ${PRIMARY_SSH_SERVER_ID}
SET dst.ip = src.ip,
    dst.inner_ip = src.inner_ip,
    dst.ssh_port = src.ssh_port,
    dst.ssh_user = src.ssh_user,
    dst.ssh_auth_type = src.ssh_auth_type,
    dst.ssh_private_key = src.ssh_private_key,
    dst.ssh_passphrase = src.ssh_passphrase,
    dst.conn_pref = src.conn_pref,
    dst.upload_allowed_roots = src.upload_allowed_roots
WHERE dst.id = ${serverBId};
UPDATE operation_project_deploy_info SET server_id = NULL WHERE id = ${projectId};
`)
  console.log(`mysql: cloned SSH 201 → ${serverBId}; cleared project ${projectId} server_id`)
}

async function verifyW9Batch(token, projectId, serverA, serverB) {
  const steps = [
    { serverId: serverA, serviceKey: 'user-center', action: 'restart' },
    { serverId: serverB, serviceKey: 'user-center', action: 'restart' },
  ]
  const res = await request(
    'POST',
    '/operation/deploy/batch/task',
    { steps, projectId, stopOnFailure: true, intervalSeconds: 0 },
    token,
  )
  if (res.json?.code !== 200 || res.json.data == null) {
    throw new Error(`W9 verify failed: ${JSON.stringify(res.json)}`)
  }
  const taskId = res.json.data
  console.log(`W9 verify OK batch taskId=${taskId}`)
  await request('POST', `/operation/task/${taskId}/cancel`, null, token)
  console.log('cancelled verify task')
}

async function restoreProject404(token) {
  const res = await request('PUT', '/operation/project/404/links', { serverIds: ['202'] }, token)
  if (res.json?.code === 200) {
    console.log('restored project 404 links → [202]')
  }
}

async function main() {
  console.log(`W9 seed → ${UC_BASE} · MySQL ${MYSQL.host}:${MYSQL.port}/${MYSQL.database}\n`)
  const token = await login()
  const servers = await listServers(token)
  const primary = servers.find((s) => String(s.id) === PRIMARY_SSH_SERVER_ID)
  if (!primary) throw new Error(`server ${PRIMARY_SSH_SERVER_ID} not found`)

  const serverB = await ensureW9ServerB(token, primary)
  const projectId = await ensureW9Project(token, PRIMARY_SSH_SERVER_ID, serverB, primary)
  cloneSshAndClearPrimary(serverB, projectId)
  await verifyW9Batch(token, projectId, PRIMARY_SSH_SERVER_ID, serverB)
  await restoreProject404(token)

  console.log('\nDone.')
  console.log(`  W9 project id: ${projectId} (${W9_PROJECT_NAME})`)
  console.log(`  servers: ${PRIMARY_SSH_SERVER_ID}, ${serverB}`)
  console.log('  Deploy center: 选该项目 → 勾选 2 台 → restart → POST /deploy/batch/task')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
