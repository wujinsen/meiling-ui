import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export function usePageData() {
  const { t, tm } = useI18n()

  const dashboardKpis = computed(() => [
    { label: t('dashboard.kpis.totalLeads.label'), value: '377', sub: t('dashboard.kpis.totalLeads.sub'), accent: 'border-l-brand-500' },
    { label: t('dashboard.kpis.activeDeals.label'), value: '467', sub: t('dashboard.kpis.activeDeals.sub'), accent: 'border-l-blue-500' },
    { label: t('dashboard.kpis.wonDeals.label'), value: '122', sub: t('dashboard.kpis.wonDeals.sub'), accent: 'border-l-emerald-500' },
    { label: t('dashboard.kpis.totalRevenue.label'), value: '$350k', sub: t('dashboard.kpis.totalRevenue.sub'), accent: 'border-l-amber-500' },
  ])

  const analyticsKpis = computed(() => [
    { label: t('analytics.kpis.dealsWon.label'), value: '425', sub: t('analytics.kpis.dealsWon.sub') },
    { label: t('analytics.kpis.activeLeads.label'), value: '1,847', sub: t('analytics.kpis.activeLeads.sub') },
    { label: t('analytics.kpis.winRate.label'), value: '32.8%', sub: t('analytics.kpis.winRate.sub') },
    { label: t('analytics.kpis.totalRevenue.label'), value: '$350,000', sub: t('analytics.kpis.totalRevenue.sub') },
  ])

  const pulseKpis = computed(() => [
    { label: t('pulse.kpis.totalRevenue.label'), value: '$2.4M', change: '+12.4%', up: true },
    { label: t('pulse.kpis.activeUsers.label'), value: '48,291', change: '+8.1%', up: true },
    { label: t('pulse.kpis.churnRate.label'), value: '3.2%', change: '-0.4%', up: false },
    { label: t('pulse.kpis.avgSession.label'), value: '14.2m', change: '+2.1m', up: true },
  ])

  const recentDeals = computed(() => [
    { title: t('dashboard.deals.enterprise.title'), company: t('dashboard.deals.enterprise.company'), date: 'Feb 16', value: '$35k', progress: 75, progressColor: 'bg-violet-500', status: t('dashboard.dealStatus.new'), statusClass: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
    { title: t('dashboard.deals.support.title'), company: t('dashboard.deals.support.company'), date: 'Feb 14', value: '$12k', progress: 60, progressColor: 'bg-blue-500', status: t('dashboard.dealStatus.contacted'), statusClass: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' },
    { title: t('dashboard.deals.upgrade.title'), company: t('dashboard.deals.upgrade.company'), date: 'Feb 12', value: '$48k', progress: 45, progressColor: 'bg-amber-500', status: t('dashboard.dealStatus.negotiation'), statusClass: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
    { title: t('dashboard.deals.consulting.title'), company: t('dashboard.deals.consulting.company'), date: 'Feb 10', value: '$22k', progress: 30, progressColor: 'bg-emerald-500', status: t('dashboard.dealStatus.contacted'), statusClass: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' },
  ])

  const tasks = computed(() => [
    { title: t('dashboard.taskItems.followUp.title'), type: t('taskType.call'), priority: 'high' as const, assignees: 2, date: t('common.today') },
    { title: t('dashboard.taskItems.proposal.title'), type: t('taskType.email'), priority: 'medium' as const, assignees: 1, date: t('common.tomorrow') },
    { title: t('dashboard.taskItems.contract.title'), type: t('taskType.review'), priority: 'low' as const, assignees: 3, date: 'Jun 10' },
  ])

  const aiInsights = computed(() => [
    { type: t('insightType.anomaly'), typeColor: 'bg-amber-500/20 text-amber-400', title: t('pulse.insights.churn.title'), desc: t('pulse.insights.churn.desc'), action: t('pulse.insights.churn.action') },
    { type: t('insightType.trend'), typeColor: 'bg-emerald-500/20 text-emerald-400', title: t('pulse.insights.revenue.title'), desc: t('pulse.insights.revenue.desc'), action: t('pulse.insights.revenue.action') },
    { type: t('insightType.suggestion'), typeColor: 'bg-brand-500/20 text-brand-300', title: t('pulse.insights.pricing.title'), desc: t('pulse.insights.pricing.desc'), action: t('pulse.insights.pricing.action') },
  ])

  const salesFunnel = computed(() => [
    { stage: t('analytics.funnel.leads'), desc: t('analytics.funnel.leadsDesc'), count: 1847, rate: '100%', icon: 'users' as const },
    { stage: t('analytics.funnel.qualified'), desc: t('analytics.funnel.qualifiedDesc'), count: 924, rate: '50%', icon: 'filter' as const },
    { stage: t('analytics.funnel.proposal'), desc: t('analytics.funnel.proposalDesc'), count: 462, rate: '25%', icon: 'file' as const },
    { stage: t('analytics.funnel.negotiation'), desc: t('analytics.funnel.negotiationDesc'), count: 231, rate: '12.5%', icon: 'handshake' as const },
    { stage: t('analytics.funnel.closedWon'), desc: t('analytics.funnel.closedWonDesc'), count: 116, rate: '6.3%', icon: 'trophy' as const },
  ])

  const activityData = computed(() => [
    { name: t('chart.activities.calls'), value: 50, count: 1061 },
    { name: t('chart.activities.emails'), value: 30, count: 637 },
    { name: t('chart.activities.meetings'), value: 11, count: 233 },
    { name: t('chart.activities.tasks'), value: 9, count: 191 },
  ])

  const leadSourceData = computed(() => [
    { name: t('chart.leadSources.referrals'), value: 28 },
    { name: t('chart.leadSources.organic'), value: 24 },
    { name: t('chart.leadSources.social'), value: 18 },
    { name: t('chart.leadSources.paidAds'), value: 14 },
    { name: t('chart.leadSources.direct'), value: 10 },
    { name: t('chart.leadSources.other'), value: 6 },
  ])

  const trafficSourceData = computed(() => [
    { name: t('pulse.traffic.organic'), value: 42 },
    { name: t('pulse.traffic.paid'), value: 28 },
    { name: t('pulse.traffic.referral'), value: 18 },
    { name: t('pulse.traffic.direct'), value: 12 },
  ])

  const topDeals = computed(() => [
    { company: 'Stripe', logo: 'S', logoBg: 'bg-indigo-500', dealValue: '$70.0M', created: 12, won: 8, probability: 92, status: t('analytics.dealStatus.proposal'), statusClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', owner: 'John Smith' },
    { company: 'dzen.ru', logo: 'D', logoBg: 'bg-sky-500', dealValue: '$42.5M', created: 9, won: 5, probability: 78, status: t('analytics.dealStatus.negotiation'), statusClass: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', owner: 'John Smith' },
    { company: 'Invision', logo: 'I', logoBg: 'bg-pink-500', dealValue: '$28.0M', created: 7, won: 4, probability: 65, status: t('analytics.dealStatus.discovery'), statusClass: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300', owner: 'John Smith' },
    { company: 'Google', logo: 'G', logoBg: 'bg-red-500', dealValue: '$12.0B', created: 6, won: 3, probability: 85, status: t('analytics.dealStatus.active'), statusClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', owner: 'John Smith' },
    { company: 'TikTok', logo: 'T', logoBg: 'bg-gray-900', dealValue: '$9.8M', created: 4, won: 1, probability: 33, status: t('analytics.dealStatus.lead'), statusClass: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400', owner: 'John Smith' },
    { company: 'Salesforce', logo: 'SF', logoBg: 'bg-cyan-600', dealValue: '$4.2M', created: 3, won: 0, probability: 20, status: t('analytics.dealStatus.lost'), statusClass: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400', owner: 'John Smith' },
  ])

  const teamMembers = computed(() => [
    { name: 'Sebastian Gray', role: t('analytics.team.salesExecutive'), avatar: 'SG', deals: 42, badge: t('analytics.teamPerformance.badge') },
    { name: 'Emily Chen', role: t('analytics.team.accountExecutive'), avatar: 'EC', deals: 38, badge: t('analytics.teamPerformance.badge') },
    { name: 'Marcus Johnson', role: t('analytics.team.salesManager'), avatar: 'MJ', deals: 35, badge: t('analytics.teamPerformance.badge') },
    { name: 'Priya Patel', role: t('analytics.team.accountManager'), avatar: 'PP', deals: 31, badge: t('analytics.teamPerformance.badge') },
  ])

  const chartMonths = computed(() => tm('chart.months') as string[])
  const chartWeekdays = computed(() => tm('chart.weekdays') as string[])
  const chartRegions = computed(() => tm('chart.regions') as string[])

  const workflowNodes = computed(() => [
    { id: '1', type: 'trigger' as const, title: t('workflow.nodes.monthly'), x: 80, y: 40 },
    { id: '2', type: 'action' as const, title: t('workflow.nodes.branch'), x: 80, y: 160 },
    { id: '3', type: 'branch' as const, title: t('workflow.nodes.condition'), x: 80, y: 280 },
    { id: '4', type: 'action' as const, title: t('workflow.nodes.email'), x: 280, y: 360 },
    { id: '5', type: 'action' as const, title: t('workflow.nodes.crm'), x: 80, y: 400 },
  ])

  const priorityClass = (priority: 'high' | 'medium' | 'low') => ({
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  }[priority])

  const workflowTypeClass = (type: 'trigger' | 'branch' | 'action') => ({
    trigger: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    branch: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    action: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  }[type])

  return {
    dashboardKpis,
    analyticsKpis,
    pulseKpis,
    recentDeals,
    tasks,
    aiInsights,
    salesFunnel,
    activityData,
    leadSourceData,
    trafficSourceData,
    topDeals,
    teamMembers,
    chartMonths,
    chartWeekdays,
    chartRegions,
    workflowNodes,
    priorityClass,
    workflowTypeClass,
  }
}
