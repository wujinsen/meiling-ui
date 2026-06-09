export type DashboardPeriod = 'monthly' | 'weekly' | 'quarterly'
export type PulseRange = '1D' | '7D' | '30D' | '90D'

const dashboardMulti: Record<DashboardPeriod, { revenue: number[]; dealValue: number[]; target: number[] }> = {
  monthly: {
    revenue: [120, 145, 168, 192, 210, 235],
    dealValue: [95, 110, 130, 155, 170, 190],
    target: [100, 120, 140, 160, 180, 200],
  },
  weekly: {
    revenue: [28, 32, 35, 41, 38, 44, 48],
    dealValue: [22, 25, 28, 33, 30, 36, 39],
    target: [24, 26, 28, 32, 30, 34, 36],
  },
  quarterly: {
    revenue: [320, 380, 410],
    dealValue: [260, 310, 340],
    target: [300, 350, 380],
  },
}

const pulseDual: Record<PulseRange, { revenue: number[]; users: number[] }> = {
  '1D': {
    revenue: [4200, 5100, 4800, 6200, 5800, 7100, 6900, 8200],
    users: [180, 210, 195, 240, 220, 260, 250, 280],
  },
  '7D': {
    revenue: [8200, 9320, 9010, 9340, 12900, 13300, 13200],
    users: [220, 282, 301, 334, 390, 430, 410],
  },
  '30D': {
    revenue: [62000, 68000, 71000, 75000, 82000, 88000, 94000],
    users: [1800, 1950, 2100, 2250, 2400, 2550, 2680],
  },
  '90D': {
    revenue: [180000, 195000, 210000, 228000, 245000, 262000, 280000],
    users: [5200, 5600, 5900, 6200, 6500, 6800, 7100],
  },
}

const pulseLabels: Record<PulseRange, string[]> = {
  '1D': ['6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p'],
  '7D': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  '30D': ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
  '90D': ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'],
}

const dashboardLabels: Record<DashboardPeriod, string[]> = {
  monthly: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  weekly: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  quarterly: ['Q1', 'Q2', 'Q3'],
}

export function getDashboardChartData(period: DashboardPeriod) {
  return {
    labels: dashboardLabels[period],
    ...dashboardMulti[period],
  }
}

export function getPulseChartData(range: PulseRange) {
  return {
    labels: pulseLabels[range],
    ...pulseDual[range],
  }
}
