export const upgradeCost = level => Math.round(175 * Math.pow(1.53, level))

export const lookScore = (wardrobeLevel, streak, roundTimeRatio) => {
  const speed = .7 + .6 * Math.max(0, Math.min(1, roundTimeRatio))
  return Math.round((100 + wardrobeLevel * 8) * speed * (1 + Math.min(6, Math.max(0, streak - 1)) * .18))
}

export const rewardCompleted = result => result?.kind === 'rewarded' && result?.status === 'completed' && result?.completed === true
