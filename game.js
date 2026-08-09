import { platform } from './tiktok.js'
import { createAudio } from './audio.js'
import { lookScore, rewardCompleted, upgradeCost } from './logic.js'

const SAVE_KEY = 'outfit-panic-v1'
const RUN_SECONDS = 45
const spriteSheet = new Image()
spriteSheet.src = './public/assets/sprites.webp'

const defaults = () => ({ cash: 500, best: 0, runs: 0, sound: true, lastSeen: Date.now(), upgrades: { wardrobe: 0, instinct: 0, influence: 0 } })
const load = () => { try { return { ...defaults(), ...JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}') } } catch { return defaults() } }
let save = load()
const offline = Math.min(14400, Math.max(0, (Date.now() - save.lastSeen) / 1000))
const offlineCash = Math.floor(offline * (.07 + save.upgrades.influence * .014))
save.cash += offlineCash

const outfits = [
  { name: 'Silver Flash', tags: ['rooftop', 'redcarpet', 'boardroom'] },
  { name: 'Pink Drama', tags: ['gala', 'rooftop', 'date'] },
  { name: 'Street Blue', tags: ['street', 'concert'] },
  { name: 'Lime Splash', tags: ['yacht', 'street'] },
  { name: 'Leather Edge', tags: ['concert', 'street', 'date'] },
  { name: 'Power White', tags: ['boardroom', 'redcarpet'] },
  { name: 'Golden Hour', tags: ['gala', 'redcarpet'] },
  { name: 'Violet Chrome', tags: ['rooftop', 'concert'] },
]
const prompts = [
  { label: 'ROOFTOP PARTY', tag: 'rooftop' },
  { label: 'CHARITY GALA', tag: 'gala' },
  { label: 'STREET FESTIVAL', tag: 'street' },
  { label: 'BOARDROOM PITCH', tag: 'boardroom' },
  { label: 'SUMMER YACHT', tag: 'yacht' },
  { label: 'SOLD OUT CONCERT', tag: 'concert' },
  { label: 'RED CARPET', tag: 'redcarpet' },
  { label: 'FIRST DATE', tag: 'date' },
]

const app = document.querySelector('#app')
app.innerHTML = `
  <main class="app">
    <section id="home" class="screen active"><div class="logo"><div class="hanger">♢</div><h1>Outfit<br>Panic</h1><p>READ THE VIBE. OWN THE RUNWAY.</p></div><div class="stats"><div class="pill">💵 <b data-cash>0</b></div><div class="pill">BEST <b data-best>0</b></div></div><div class="menu"><button class="primary" data-action="play">Hit the Runway</button><button class="secondary" data-action="garage">Closet Upgrades</button><button class="secondary" data-action="sound">🔊 Sound On</button><p class="offline" id="offline"></p></div></section>
    <section id="garage" class="screen"><div class="topbar"><button class="tiny" data-action="home">‹ Back</button><h2>Dream Closet</h2><div class="balance">💵 <span data-cash>0</span></div></div><div class="upgrade-list" id="upgrades"></div><button class="primary" data-action="play">Hit the Runway</button></section>
    <section id="play" class="screen"><canvas id="game-canvas" width="390" height="640"></canvas><div class="hud"><div class="hud-box">Score<strong id="hud-score">0</strong></div><div class="timer" id="hud-time">45</div><div class="hud-box right">Streak<strong id="hud-streak">0</strong></div></div><button class="quit" data-action="quit">✕</button><div class="prompt"><small>STYLE FOR</small><b id="prompt">ROOFTOP PARTY</b></div><div class="round-timer"><i id="round-bar"></i></div><div class="active-power" id="active-power" hidden>✨ STYLIST PICKS 3</div><aside class="offer" id="offer" hidden><b>✨ STYLIST PASS</b><small>Highlights 3 perfect looks</small><button data-action="power">▶ Watch</button></aside><div class="feedback" id="feedback">SLAY!</div><div class="audience"><div class="audience-label"><span>AUDIENCE HYPE</span><span id="hype-text">50%</span></div><div class="audience-bar"><i id="hype-bar"></i></div></div><div class="choices" id="choices"></div><div class="countdown" id="countdown" hidden>3</div></section>
    <section id="result" class="screen"><div class="result-card"><div class="hanger">✦</div><h2>Runway Recap</h2><div class="score-big" id="result-score">0</div><div class="earned" id="result-earned">+0 CASH</div><div class="actions"><button class="primary" id="double-button" data-action="double">▶ Double Payday</button><button class="secondary" data-action="play">Next Show</button><button class="secondary" data-action="home">Home</button></div></div></section>
    <div class="toast" id="toast"></div><div class="ad-overlay" id="ad-overlay" hidden><div class="ad-box"><div class="spinner"></div><h2>Style Sponsor</h2><p id="ad-label">Preparing reward…</p></div></div>
  </main>`

const audio = createAudio()
const canvas = document.querySelector('#game-canvas')
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
const screens = [...document.querySelectorAll('.screen')]
const $ = id => document.querySelector(`#${id}`)
const ui = Object.fromEntries(['offline', 'upgrades', 'hud-score', 'hud-time', 'hud-streak', 'prompt', 'round-bar', 'active-power', 'offer', 'feedback', 'hype-text', 'hype-bar', 'choices', 'countdown', 'result-score', 'result-earned', 'double-button', 'toast', 'ad-overlay', 'ad-label'].map(id => [id, $(id)]))
let game = null
let paused = true
let appHidden = false
let adPaused = false
let last = performance.now()

const upgradeInfo = {
  wardrobe: ['👗', 'Wardrobe', 'Earn more points per perfect look'],
  instinct: ['⏱️', 'Style Instinct', 'Get more time for each decision'],
  influence: ['📸', 'Influence', 'Convert audience hype into more cash'],
}
const persist = () => {
  save.lastSeen = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(save))
  document.querySelectorAll('[data-cash]').forEach(node => { node.textContent = Math.floor(save.cash).toLocaleString() })
  document.querySelectorAll('[data-best]').forEach(node => { node.textContent = save.best.toLocaleString() })
}
const show = id => { screens.forEach(screen => screen.classList.toggle('active', screen.id === id)); if (id !== 'play') { paused = true; audio.ambienceStop() }; persist() }
const toast = message => { ui.toast.textContent = message; ui.toast.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => ui.toast.classList.remove('show'), 1700) }

const renderUpgrades = () => {
  ui.upgrades.innerHTML = Object.entries(upgradeInfo).map(([key, [icon, name, detail]]) => {
    const level = save.upgrades[key]; const adGate = (level + 1) % 5 === 0
    return `<article class="upgrade"><div class="upgrade-icon">${icon}</div><div><h3>${name}</h3><p>${detail}</p><small>LEVEL ${level}/20</small></div><button class="buy" data-upgrade="${key}" ${level >= 20 ? 'disabled' : ''}>${level >= 20 ? 'MAX' : adGate ? '▶ Unlock' : `💵 ${upgradeCost(level)}`}</button></article>`
  }).join('')
}
const rewarded = label => platform.showRewarded({ label, onPause: () => { adPaused = true; paused = true; audio.ambienceStop() }, onResume: () => { adPaused = false; if (!appHidden && game && !game.finished && document.querySelector('#play').classList.contains('active') && ui.countdown.hidden) { paused = false; audio.ambienceStart() } } })
const upgrade = async key => {
  const level = save.upgrades[key]; if (level >= 20) return
  if ((level + 1) % 5 === 0) { const result = await rewarded(`Unlock ${upgradeInfo[key][1]}`); if (!rewardCompleted(result)) return toast('Complete the video to unlock') }
  else { const price = upgradeCost(level); if (save.cash < price) return toast('Not enough cash'); save.cash -= price }
  save.upgrades[key] += 1; audio.jackpot(); renderUpgrades(); persist()
}

const shuffle = list => {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]] }
  return copy
}
const thumbPosition = index => `${(index % 4) * (100 / 3)}% ${Math.floor(index / 4) * 100}%`
const nextRound = () => {
  const prompt = prompts[Math.floor(Math.random() * prompts.length)]
  const good = outfits.map((outfit, index) => outfit.tags.includes(prompt.tag) ? index : -1).filter(index => index >= 0)
  const correct = good[Math.floor(Math.random() * good.length)]
  const wrong = shuffle(outfits.map((_, index) => index).filter(index => !good.includes(index))).slice(0, 2)
  game.prompt = prompt; game.correct = correct; game.choices = shuffle([correct, ...wrong]); game.roundMax = 5.3 + save.upgrades.instinct * .11; game.roundTime = game.roundMax; game.locked = false
  ui.prompt.textContent = prompt.label
  ui.choices.innerHTML = game.choices.map(index => `<button class="choice" data-choice="${index}" aria-label="${outfits[index].name}"><div class="thumb" style="background-position:${thumbPosition(index)}"></div><span>${outfits[index].name}</span></button>`).join('')
  if (game.stylistPicks > 0) ui.choices.querySelector(`[data-choice="${correct}"]`)?.classList.add('correct-hint')
}

const sprite = (index, x, y, width, height, alpha = 1) => {
  if (!spriteSheet.complete) return
  const sw = spriteSheet.naturalWidth / 4; const sh = spriteSheet.naturalHeight / 2
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.drawImage(spriteSheet, index % 4 * sw, Math.floor(index / 4) * sh, sw, sh, -width / 2, -height / 2, width, height); ctx.restore()
}
const reset = () => {
  game = { elapsed: 0, score: 0, earned: 0, streak: 0, hype: 50, rounds: 0, currentOutfit: 0, stylistPicks: 0, offerShown: false, offerUsed: false, doubled: false, feedbackUntil: 0, feedbackGood: true, particles: [], finished: false }
  ui.offer.hidden = true; ui['active-power'].hidden = true; nextRound(); updateHud()
}
const updateHud = () => {
  if (!game) return
  ui['hud-score'].textContent = Math.round(game.score).toLocaleString(); ui['hud-time'].textContent = Math.max(0, Math.ceil(RUN_SECONDS - game.elapsed)); ui['hud-streak'].textContent = game.streak
  ui['round-bar'].style.width = `${Math.max(0, game.roundTime / game.roundMax * 100)}%`; ui['hype-bar'].style.width = `${game.hype}%`; ui['hype-text'].textContent = `${Math.round(game.hype)}%`
  ui['active-power'].hidden = game.stylistPicks <= 0; if (game.stylistPicks > 0) ui['active-power'].textContent = `✨ STYLIST PICKS ${game.stylistPicks}`
}

const start = async () => {
  audio.unlock(); reset(); show('play'); ui.countdown.hidden = false
  for (const [label, step] of [['3', 3], ['2', 2], ['1', 1], ['GO!', 0]]) { ui.countdown.textContent = label; audio.countdown(step); await new Promise(resolve => setTimeout(resolve, step ? 620 : 480)) }
  ui.countdown.hidden = true; paused = appHidden || adPaused; audio.ambienceStart()
}

const feedback = (message, good) => {
  ui.feedback.textContent = message; ui.feedback.style.color = good ? '#ffffff' : '#ffb0e8'; ui.feedback.classList.add('show'); clearTimeout(feedback.timer); feedback.timer = setTimeout(() => ui.feedback.classList.remove('show'), 600)
}
const choose = index => {
  if (paused || !game || game.locked || game.finished) return
  game.locked = true; game.rounds += 1; game.currentOutfit = index
  const correct = index === game.correct
  if (correct) {
    game.streak += 1; game.hype = Math.min(100, game.hype + 8 + game.streak * 1.3)
    const value = lookScore(save.upgrades.wardrobe, game.streak, game.roundTime / game.roundMax)
    game.score += value; game.earned += Math.max(12, Math.round(value * (.22 + save.upgrades.influence * .009)))
    if (game.stylistPicks > 0) game.stylistPicks -= 1
    for (let i = 0; i < 22; i += 1) game.particles.push({ x: 195 + (Math.random() - .5) * 130, y: 340 + (Math.random() - .5) * 180, vy: -30 - Math.random() * 80, life: .5 + Math.random() * .6, color: Math.random() > .5 ? '#76ffe9' : '#ff68d8' })
    audio.correct(game.streak); feedback(game.streak > 2 ? `${game.streak}× SLAY!` : 'SLAY!', true)
  } else {
    game.streak = 0; game.hype = Math.max(0, game.hype - 17); audio.wrong(); feedback('NOT THE VIBE', false)
  }
  updateHud()
  setTimeout(() => { if (!game?.finished) nextRound() }, 520)
}

const miss = () => {
  if (game.locked) return
  game.locked = true; game.rounds += 1; game.streak = 0; game.hype = Math.max(0, game.hype - 13); audio.wrong(); feedback('TOO SLOW', false); setTimeout(() => { if (!game?.finished) nextRound() }, 520)
}

const update = dt => {
  if (paused || !game || game.finished) return
  game.elapsed += dt
  if (!game.locked) { game.roundTime -= dt; if (game.roundTime <= 0) miss() }
  if (!game.offerShown && game.rounds >= 3 && game.elapsed > 10 + Math.random() * 8) { game.offerShown = true; ui.offer.hidden = false }
  game.particles.forEach(p => { p.y += p.vy * dt; p.life -= dt }); game.particles = game.particles.filter(p => p.life > 0)
  if (game.elapsed >= RUN_SECONDS) finish()
  updateHud()
}

const draw = () => {
  ctx.clearRect(0, 0, 390, 640); if (!game) return
  const bob = Math.sin(performance.now() / 420) * 3
  sprite(game.currentOutfit, 195, 355 + bob, 210, 310)
  game.particles.forEach(p => { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 5); ctx.fillRect(-3, -3, 6, 6); ctx.restore() }); ctx.globalAlpha = 1
  if (game.hype > 82) { ctx.strokeStyle = '#8fffea'; ctx.globalAlpha = .25 + Math.sin(performance.now() / 120) * .12; ctx.lineWidth = 5; ctx.strokeRect(10, 10, 370, 620); ctx.globalAlpha = 1 }
}

const finish = async () => {
  if (!game || game.finished) return
  game.finished = true; paused = true; audio.ambienceStop(); save.runs += 1; save.cash += game.earned; save.best = Math.max(save.best, Math.round(game.score))
  ui['result-score'].textContent = Math.round(game.score).toLocaleString(); ui['result-earned'].textContent = `+${game.earned.toLocaleString()} CASH`; ui['double-button'].disabled = false; show('result'); audio.jackpot()
  if (save.runs % 2 === 0) await platform.showInterstitial({ label: 'Between runway shows' })
}
const power = async () => {
  if (!game || game.offerUsed) return
  const result = await rewarded('Stylist Pass'); if (!rewardCompleted(result)) return toast('Reward requires a completed video')
  game.offerUsed = true; game.stylistPicks = 3; ui.offer.hidden = true; ui.choices.querySelector(`[data-choice="${game.correct}"]`)?.classList.add('correct-hint'); audio.sparkle(); toast('Stylist Pass active for 3 looks')
}
const doubleReward = async () => {
  if (!game || game.doubled) return
  const result = await rewarded('Double runway payday'); if (!rewardCompleted(result)) return toast('Complete the video to double')
  game.doubled = true; save.cash += game.earned; ui['result-earned'].textContent = `+${(game.earned * 2).toLocaleString()} CASH`; ui['double-button'].disabled = true; persist(); audio.jackpot()
}

const loop = now => { const dt = Math.min(.04, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(loop) }
app.addEventListener('click', async event => {
  audio.unlock(); const choice = event.target.closest('[data-choice]')?.dataset.choice; if (choice != null) return choose(Number(choice))
  const key = event.target.closest('[data-upgrade]')?.dataset.upgrade; if (key) return upgrade(key)
  const action = event.target.closest('[data-action]')?.dataset.action; if (!action) return; audio.click()
  if (action === 'play') start(); if (action === 'garage') { renderUpgrades(); show('garage') }; if (action === 'home') show('home'); if (action === 'power') power(); if (action === 'double') doubleReward(); if (action === 'quit' && confirm('End this runway show?')) finish()
  if (action === 'sound') { save.sound = audio.toggle(); document.querySelectorAll('[data-action="sound"]').forEach(button => { button.textContent = save.sound ? '🔊 Sound On' : '🔇 Sound Off' }); persist() }
})
document.addEventListener('mini-ad', event => { ui['ad-overlay'].hidden = !event.detail.open; ui['ad-label'].textContent = event.detail.label ?? 'Preparing reward…' })
platform.init(); platform.bindLifecycle({ onPause: () => { appHidden = true; paused = true; audio.ambienceStop(); persist() }, onResume: () => { appHidden = false; if (!adPaused && game && !game.finished && document.querySelector('#play').classList.contains('active') && ui.countdown.hidden) { paused = false; audio.ambienceStart() } } })
ui.offline.textContent = offlineCash ? `Your looks earned ${offlineCash.toLocaleString()} cash while you were away.` : 'Upgrade Influence to grow offline income.'
persist(); requestAnimationFrame(loop)
