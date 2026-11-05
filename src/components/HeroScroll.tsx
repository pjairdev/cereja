import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { ArrowDown, CalendarHeart, Clock, Palette, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, cx } from './ui'

const FRAME_COUNT = 81
const frameSrc = (i: number) => `${import.meta.env.BASE_URL}frames/f${String(i).padStart(3, '0')}.webp`

const STAGES = [
  {
    at: 0,
    kicker: 'Esmalteria em Santo Amaro',
    title: ['Unhas prontas', 'sem fila.'],
    text: 'Role a página e veja uma mão ganhar vida. Depois é só escolher o horário — a agenda é de verdade.',
    chips: [] as { icon: typeof Sparkles; label: string; pos: string }[],
  },
  {
    at: 0.12,
    kicker: '01 · a cor',
    title: ['Escolha', 'a sua cor.'],
    text: 'Do nude ao cereja intenso: mais de 120 cores, em esmalte comum ou gel que dura até 21 dias.',
    chips: [
      { icon: Palette, label: '+120 cores', pos: 'left-[-8%] top-[18%]' },
      { icon: Clock, label: 'Gel dura 21 dias', pos: 'right-[-10%] bottom-[24%]' },
    ],
  },
  {
    at: 0.36,
    kicker: '02 · o detalhe',
    title: ['Arte feita', 'à mão.'],
    text: 'Marmorizado, francesinha e foil dourado, unha por unha. Você mostra a referência, a gente reproduz.',
    chips: [
      { icon: Sparkles, label: 'Marmorizado', pos: 'right-[-8%] top-[22%]' },
      { icon: Sparkles, label: 'Foil dourado', pos: 'left-[-10%] bottom-[30%]' },
    ],
  },
  {
    at: 0.68,
    kicker: '03 · o resultado',
    title: ['Pronta pra', 'brilhar.'],
    text: 'Mão em 40 minutos, pé e mão em 80. Reserve em menos de um minuto e pague no Pix, no cartão ou aqui.',
    chips: [{ icon: CalendarHeart, label: 'Agende em 1 minuto', pos: 'left-[-8%] top-[26%]' }],
  },
]

function stageFor(p: number) {
  let s = 0
  STAGES.forEach((st, i) => p >= st.at && (s = i))
  return s
}

export function HeroScroll({ onBook }: { onBook: () => void }) {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameBoxRef = useRef<HTMLDivElement>(null)
  const images = useRef<HTMLImageElement[]>([])
  const target = useRef(0)
  const nudge = useRef(0)
  const current = useRef(-1)
  const drawn = useRef(-1)
  const [stage, setStage] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const reduce = useReducedMotion()

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] })
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 })
  const bgTextX = useTransform(smooth, [0, 1], ['4%', '-38%'])
  const ringDash = useTransform(smooth, [0, 1], [0, 1])
  const frameScale = useTransform(smooth, [0, 0.12, 0.85, 1], [0.92, 1, 1, 0.96])
  const blobRotate = useTransform(smooth, [0, 1], [0, 140])
  const hintOpacity = useTransform(smooth, [0, 0.06], [1, 0])

  // Pré-carrega os quadros (o primeiro com prioridade para aparecer logo)
  useEffect(() => {
    let count = 0
    const imgs: HTMLImageElement[] = []
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image()
      img.decoding = 'async'
      img.src = frameSrc(i)
      img.onload = () => {
        count++
        setLoaded(count)
        if (i === 0) drawn.current = -1
      }
      imgs.push(img)
    }
    images.current = imgs
  }, [])

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    target.current = p * (FRAME_COUNT - 1)
    const s = stageFor(p)
    setStage((prev) => (prev === s ? prev : s))
  })

  // Laço de desenho: interpola até o quadro alvo para o movimento ficar suave
  useEffect(() => {
    let raf = 0
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(r.width * dpr)
      canvas.height = Math.round(r.height * dpr)
      drawn.current = -1
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const nearestLoaded = (i: number) => {
      for (let d = 0; d < FRAME_COUNT; d++) {
        for (const j of [i - d, i + d]) {
          const img = images.current[j]
          if (img && img.complete && img.naturalWidth) return j
        }
      }
      return -1
    }

    const tick = () => {
      const goal = Math.max(0, Math.min(FRAME_COUNT - 1, target.current + nudge.current))
      if (current.current < 0) current.current = goal
      current.current += (goal - current.current) * (reduce ? 1 : 0.18)
      const idx = nearestLoaded(Math.round(current.current))
      if (idx >= 0 && idx !== drawn.current) {
        const img = images.current[idx]
        const cw = canvas.width
        const ch = canvas.height
        const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight)
        const w = img.naturalWidth * scale
        const h = img.naturalHeight * scale
        ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h)
        drawn.current = idx
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [reduce])

  // Interação com o ponteiro: inclina a moldura e "gira" a mão alguns quadros
  const [tilt, setTilt] = useState({ x: 0, y: 0, gx: 50, gy: 30 })
  const onPointerMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType === 'touch') return
    const r = frameBoxRef.current!.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    nudge.current = px * 8
    setTilt({ x: -py * 10, y: px * 12, gx: (px + 0.5) * 100, gy: (py + 0.5) * 100 })
  }
  const onPointerLeave = () => {
    nudge.current = 0
    setTilt({ x: 0, y: 0, gx: 50, gy: 30 })
  }

  const st = STAGES[stage]
  const pct = Math.round((loaded / FRAME_COUNT) * 100)

  return (
    <section ref={sectionRef} id="inicio" className="relative h-[360vh] bg-blush md:h-[420vh]" aria-label="Apresentação">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        {/* fundo */}
        <motion.div
          aria-hidden
          style={{ x: bgTextX }}
          className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 select-none whitespace-nowrap font-display text-[34vw] leading-none text-cherry/[0.06] md:text-[22vw]"
        >
          cereja cereja cereja
        </motion.div>
        <motion.div
          aria-hidden
          style={{ rotate: blobRotate }}
          className="pointer-events-none absolute -right-[20vmax] -top-[18vmax] h-[60vmax] w-[60vmax] rounded-[42%_58%_63%_37%/41%_44%_56%_59%] bg-gradient-to-br from-cherry-soft/60 to-petal"
        />

        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-6 px-4 pt-16 md:grid-cols-[1.05fr_1fr] md:gap-10 md:px-8 md:pt-0">
          {/* texto */}
          <div className="order-2 md:order-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={stage}
                initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -18, filter: 'blur(6px)' }}
                transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
              >
                <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-cherry md:mb-3 md:text-sm">{st.kicker}</p>
                <h1 className="font-display text-[13vw] leading-[0.92] text-wine sm:text-6xl md:text-7xl lg:text-8xl">
                  {st.title[0]}
                  <br />
                  <span className="text-cherry">{st.title[1]}</span>
                </h1>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-mauve md:mt-5 md:text-lg">{st.text}</p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 hidden flex-wrap items-center gap-3 md:flex">
              <Button size="lg" onClick={onBook}>
                <CalendarHeart className="h-5 w-5" /> Agendar horário
              </Button>
              <a href="#servicos" className="text-sm font-semibold text-wine underline decoration-cherry/40 underline-offset-4 hover:decoration-cherry">
                Ver serviços
              </a>
            </div>

            <div className="mt-6 hidden items-center gap-2 md:flex" aria-hidden>
              {STAGES.map((_, i) => (
                <span
                  key={i}
                  className={cx('h-1.5 rounded-full transition-all duration-500', i === stage ? 'w-10 bg-cherry' : 'w-4 bg-cherry/20')}
                />
              ))}
            </div>
          </div>

          {/* mão */}
          <div className="order-1 flex justify-center md:order-2">
            <motion.div style={{ scale: frameScale }} className="relative" ref={frameBoxRef} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
              <div
                className="relative h-[46svh] w-[29svh] overflow-hidden rounded-[999px_999px_48px_48px] bg-petal shadow-lift ring-[6px] ring-white transition-transform duration-200 ease-out md:h-[68vh] md:w-[42.5vh]"
                style={{ transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
              >
                <canvas ref={canvasRef} className="h-full w-full" role="img" aria-label="Mão com unhas cereja decoradas, girando conforme a página rola" />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 mix-blend-soft-light"
                  style={{ background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,.55), transparent 45%)` }}
                />
                {pct < 100 && (
                  <div className="absolute inset-x-0 bottom-4 flex justify-center">
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-wine backdrop-blur">carregando {pct}%</span>
                  </div>
                )}
              </div>

              {/* anel de progresso */}
              <svg className="absolute -bottom-5 -left-5 h-16 w-16 md:-bottom-6 md:-left-6 md:h-20 md:w-20" viewBox="0 0 80 80" aria-hidden>
                <circle cx="40" cy="40" r="34" fill="#fff" />
                <circle cx="40" cy="40" r="28" fill="none" stroke="#ffe2de" strokeWidth="6" />
                <motion.circle
                  cx="40"
                  cy="40"
                  r="28"
                  fill="none"
                  stroke="#d8304a"
                  strokeWidth="6"
                  strokeLinecap="round"
                  style={{ pathLength: ringDash, rotate: -90, transformOrigin: '50% 50%' }}
                />
                <text x="40" y="45" textAnchor="middle" className="fill-wine font-display" fontSize="15">
                  {String(stage + 1).padStart(2, '0')}
                </text>
              </svg>

              <AnimatePresence>
                {st.chips.map((c) => (
                  <motion.div
                    key={stage + c.label}
                    initial={{ opacity: 0, scale: 0.6, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.1 }}
                    className={cx(
                      'absolute hidden items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-wine shadow-lift sm:flex',
                      c.pos,
                    )}
                  >
                    <c.icon className="h-4 w-4 text-cherry" /> {c.label}
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>

        <motion.div
          className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 text-xs font-semibold text-mauve"
          style={{ opacity: hintOpacity }}
        >
          <ArrowDown className="h-4 w-4 animate-bounce" /> role para girar a mão
        </motion.div>
      </div>
    </section>
  )
}
