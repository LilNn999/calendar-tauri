// src/lib/confetti.ts
// 单发礼炮爆炸特效（canvas 自绘，零依赖）：
// 触发瞬间在界面中下部直接炸开，模拟结婚礼炮"砰"的一响——没有升空飞行。
// 粒子全部实心不透明，寿命结束直接消失（无透明度、无渐隐）。
// 触发时机：当天所有任务完成 / 成就解锁。

interface BurstParticle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  life: number
}

interface BoomRing {
  x: number
  y: number
  r: number
  vr: number
  lw: number
}

const COLORS = [
  '#ff4d6d',
  '#ff9f1c',
  '#ffd60a',
  '#6ee7a0',
  '#4cc9f0',
  '#5a8dff',
  '#b56cff',
  '#ff70a6',
  '#ffffff',
]

function pickColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}

function launchShow(opts: { small?: boolean } = {}) {
  const canvas = document.createElement('canvas')
  canvas.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }
  const context = ctx
  const W = canvas.width
  const H = canvas.height
  const R = Math.min(W, H) * 0.42 // 爆炸半径：直径约 2/3 屏

  const particles: BurstParticle[] = []
  let ring: BoomRing | null = null

  // 单发礼炮：无升空飞行，直接炸开；爆点在界面中下部（正中往下 12%）
  const small = opts.small === true
  const cx = small ? W * (0.3 + Math.random() * 0.4) : W * 0.5
  const cy = small ? H * (0.2 + Math.random() * 0.25) : H * 0.62
  const radius = small ? R * 0.35 : R
  const count = small ? 90 : 460
  const life = small ? 139 : 207 // 粒子寿命：在"慢40%"基础上再提速 20%
  const gravity = 0.0415 // 重力随时间缩放：0.0288 * 1.2^2

  // 预补偿重力：让粒子在第 life 帧到达目标半径，形成饱满的球形爆炸
  function explodeAt(x: number, y: number, burstRadius: number, particleCount: number, particleLife: number) {
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = burstRadius * Math.pow(Math.random(), 0.7)
      const ex = x + Math.cos(angle) * dist
      const ey = y + Math.sin(angle) * dist
      particles.push({
        x,
        y,
        vx: (ex - x) / particleLife,
        vy: (ey - y) / particleLife - 0.5 * gravity * particleLife,
        color: pickColor(),
        size: 1.8 + Math.random() * 3.2,
        life: particleLife,
      })
    }
    // 实心白色爆环（速率随播放速度同步调整）
    ring = { x, y, r: 8, vr: (burstRadius * 0.5) / 23 * 0.72, lw: 8 }
  }

  explodeAt(cx, cy, radius, count, life)

  function step() {
    context.clearRect(0, 0, W, H)

    // 实心白色爆环
    if (ring) {
      ring.r += ring.vr
      ring.lw -= 0.173 // 0.144 * 1.2，随播放速度同步
      if (ring.lw > 0.5) {
        context.strokeStyle = '#ffffff'
        context.lineWidth = ring.lw
        context.beginPath()
        context.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2)
        context.stroke()
      } else {
        ring = null
      }
    }

    // 实心粒子：无透明度，寿命结束直接消失
    let alive = false
    for (const p of particles) {
      p.life--
      if (p.life <= 0) continue
      p.x += p.vx
      p.y += p.vy
      p.vy += gravity
      context.fillStyle = p.color
      context.beginPath()
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      context.fill()
      alive = true
    }

    if (!alive && !ring) {
      canvas.remove()
      return
    }
    requestAnimationFrame(step)
  }

  requestAnimationFrame(step)
}

export function fireConfetti() {
  launchShow()
}

export function fireSmallConfetti() {
  launchShow({ small: true })
}