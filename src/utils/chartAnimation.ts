export const chartAnimation = {
  animation: true,
  animationDuration: 1400,
  animationEasing: 'cubicOut' as const,
  animationDelay: (idx: number) => idx * 100,
  animationDurationUpdate: 900,
  animationEasingUpdate: 'cubicInOut' as const,
}

export const pieAnimation = {
  ...chartAnimation,
  animationType: 'expansion' as const,
  animationDuration: 1200,
}
