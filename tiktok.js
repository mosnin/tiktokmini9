const config = globalThis.TIKTOK_GAME_CONFIG ?? {}
let adBusy = false
const sdk = () => globalThis.TTMinis?.game ?? null
const signal = detail => document.dispatchEvent(new CustomEvent('mini-ad', { detail }))

const mock = async (kind, label) => {
  signal({ open: true, kind, label })
  await new Promise(resolve => setTimeout(resolve, kind === 'rewarded' ? 1400 : 800))
  signal({ open: false, kind, label })
  return { ok: true, status: 'completed', completed: true, kind, mocked: true, ...(kind === 'interstitial' ? { shouldContinue: true } : {}) }
}

const show = async (kind, { label = 'Style bonus', onPause, onResume } = {}) => {
  if (adBusy) return { ok: false, status: 'busy', completed: false, kind, ...(kind === 'interstitial' ? { shouldContinue: true } : {}) }
  adBusy = true
  onPause?.()
  try {
    const game = sdk()
    const method = kind === 'rewarded' ? 'createRewardedVideoAd' : 'createInterstitialAd'
    const adUnitId = kind === 'rewarded' ? config.rewardedAdId : config.interstitialAdId
    let supported = false
    try { supported = game?.canIUse?.(method) === true && typeof game?.[method] === 'function' } catch {}
    if (!supported || !adUnitId) {
      if (!game && (location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname))) return await mock(kind, label)
      return { ok: false, status: 'unavailable', completed: false, kind, ...(kind === 'interstitial' ? { shouldContinue: true } : {}) }
    }
    return await new Promise(resolve => {
      const ad = game[method]({ adUnitId })
      let done = false
      const finish = response => {
        if (done) return
        done = true
        const completed = kind === 'interstitial' || response?.isEnded === true
        resolve({ ok: completed, status: completed ? 'completed' : 'cancelled', completed, kind, ...(kind === 'interstitial' ? { shouldContinue: true } : {}) })
      }
      ad.onClose?.(finish)
      ad.onError?.(() => finish({ isEnded: false }))
      Promise.resolve(ad.show()).catch(() => finish({ isEnded: false }))
    })
  } catch (error) {
    return { ok: false, status: 'error', completed: false, kind, error: String(error), ...(kind === 'interstitial' ? { shouldContinue: true } : {}) }
  } finally {
    adBusy = false
    onResume?.()
  }
}

export const platform = {
  init() { try { if (config.clientKey && globalThis.TTMinis?.init) globalThis.TTMinis.init({ clientKey: config.clientKey }); return { ok: true } } catch (error) { return { ok: false, error: String(error) } } },
  showRewarded: options => show('rewarded', options),
  showInterstitial: options => show('interstitial', options),
  bindLifecycle({ onPause, onResume } = {}) {
    const visibility = () => document.hidden ? onPause?.() : onResume?.()
    globalThis.TTMinis?.game?.onHide?.(onPause)
    globalThis.TTMinis?.game?.onShow?.(onResume)
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  },
}
