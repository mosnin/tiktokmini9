export function createAudio() {
  let ctx = null
  let enabled = true
  let ambience = null
  const ready = () => {
    if (!enabled) return null
    ctx ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }
  const tone = (frequency, duration = .1, type = 'sine', volume = .055, delay = 0) => {
    const c = ready(); if (!c) return
    const osc = c.createOscillator(); const gain = c.createGain(); const start = c.currentTime + delay
    osc.type = type; osc.frequency.value = frequency; gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + .008); gain.gain.exponentialRampToValueAtTime(.0001, start + duration)
    osc.connect(gain).connect(c.destination); osc.start(start); osc.stop(start + duration + .02)
  }
  const noise = (duration = .06, volume = .04) => {
    const c = ready(); if (!c) return
    const buffer = c.createBuffer(1, c.sampleRate * duration, c.sampleRate); const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
    const source = c.createBufferSource(); const gain = c.createGain(); source.buffer = buffer; gain.gain.value = volume; source.connect(gain).connect(c.destination); source.start()
  }
  return {
    unlock: ready,
    toggle() { enabled = !enabled; if (!enabled) this.ambienceStop(); return enabled },
    click() { tone(720, .06, 'triangle', .04); tone(980, .07, 'triangle', .03, .045) },
    countdown(step) { tone(step ? 440 + step * 60 : 1040, step ? .12 : .3, 'square', .065) },
    camera() { noise(.045, .08); tone(120, .045, 'square', .035, .025) },
    correct(combo = 1) { [660, 830, 990, 1320].slice(0, Math.min(4, combo + 1)).forEach((f, i) => tone(f, .16, 'triangle', .05, i * .055)); setTimeout(() => this.camera(), 80) },
    wrong() { tone(240, .22, 'sawtooth', .055); tone(175, .26, 'sawtooth', .045, .11) },
    sparkle() { [1100, 1400, 1760, 2100].forEach((f, i) => tone(f, .11, 'sine', .035, i * .045)) },
    jackpot() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, .34, 'triangle', .052, i * .07)); for (let i = 0; i < 8; i += 1) setTimeout(() => this.camera(), 100 + i * 65) },
    ambienceStart() {
      const c = ready(); if (!c || ambience) return
      const osc = c.createOscillator(); const gain = c.createGain(); osc.type = 'sine'; osc.frequency.value = 98; gain.gain.value = .012; osc.connect(gain).connect(c.destination); osc.start(); ambience = { osc, gain }
    },
    ambienceStop() { if (!ambience) return; ambience.gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .15); ambience.osc.stop(ctx.currentTime + .17); ambience = null },
  }
}
