import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowDown, ArrowUpRight, CalendarHeart } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, cx } from './ui'

// Quadros da mão já recortados (fundo transparente), gerados a partir do vídeo.
const FRAME_COUNT = 81
const frameSrc = (i: number) => `${import.meta.env.BASE_URL}frames/f${String(i).padStart(3, '0')}.webp`
const FRAME_RATIO = 820 / 1286

// Linha do tempo do scroll (0 a 1):
//   0 – 0.80  a mão gira (quadro 0 → 80) e as legendas trocam
//   0.80 – 0.95  círculo cereja cresce a partir da mão e cobre a tela
//   0.90 – 1  frase final aparece dentro do círculo
const SCRUB_END = 0.8
const CIRCLE = [0.8, 0.95] as const

// Cada legenda descreve o que a mão está mostrando naquele trecho do vídeo.
const LOOKS = [
  { from: 12, n: '01', label: 'A cor', name: 'Rosa cereja cremoso', text: 'Duas camadas e top coat. Brilho de gel sem cabine.' },
  { from: 24, n: '02', label: 'A arte', name: 'Marmorizado com foil', text: 'Pintado à mão, unha por unha, com folha dourada.' },
  { from: 48, n: '03', label: 'O detalhe', name: 'Francesinha nude', text: 'Base translúcida e ponta marmorizada.' },
  { from: 64, n: '04', label: 'O resultado', name: 'Pronta pra brilhar', text: 'Mão em 40 minutos. Pé e mão em 80.' },
]

function lookFor(frame: number) {
  let idx = -1
  LOOKS.forEach((l, i) => frame >= l.from && (idx = i))
  return idx
}

export function HeroScroll({ onBook }: { onBook: () => void }) {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const images = useRef<HTMLImageElement[]>([])
  const target = useRef(0)
  const nudge = useRef(0)
  const current = useRef(-1)
  const drawn = useRef(-1)
  const [look, setLook] = useState(-1)
  const [loaded, setLoaded] = useState(0)
  const reduce = useReducedMotion()

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] })
  const bgTextX = useTransform(scrollYProgress, [0, 1], ['2%', '-45%'])
  const hintOpacity = useTransform(scrollYProgress, [0, 0.04], [1, 0])
  const circle = useTransform(scrollYProgress, [CIRCLE[0], CIRCLE[1]], [0, 150])
  const clipPath = useTransform(circle, (r) => `circle(${r}% at 76% 62%)`)
  const finalOpacity = useTransform(scrollYProgress, [0.9, 0.97], [0, 1])
  const finalY = useTransform(scrollYProgress, [0.9, 1], [40, 0])
  const handScale = useTransform(scrollYProgress, [0, SCRUB_END, CIRCLE[1]], [1, 1.04, 1.12])

  // Pré-carrega os quadros
  useEffect(() => {
    let count = 0
    images.current = Array.from({ length: FRAME_COUNT }, (_, i) => {
      const img = new Image()
      img.decoding = 'async'
      img.src = frameSrc(i)
      img.onload = () => {
        count++
        setLoaded(count)
        drawn.current = -1
      }
      return img
    })
  }, [])

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const frame = Math.min(1, p / SCRUB_END) * (FRAME_COUNT - 1)
    target.current = frame
    const l = lookFor(frame)
    setLook((prev) => (prev === l ? prev : l))
  })

  // Laço de desenho: aproxima suavemente o quadro atual do quadro alvo
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
      current.current += (goal - current.current) * (reduce ? 1 : 0.2)
      const idx = nearestLoaded(Math.round(current.current))
      if (idx >= 0 && idx !== drawn.current) {
        const img = images.current[idx]
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
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

  // No computador, mover o mouse sobre a mão gira alguns quadros
  const onPointerMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType === 'touch') return
    const r = e.currentTarget.getBoundingClientRect()
    nudge.current = ((e.clientX - r.left) / r.width - 0.5) * 8
  }

  const pct = Math.round((loaded / FRAME_COUNT) * 100)
  const active = look >= 0 ? LOOKS[look] : null

  return (
    <section ref={sectionRef} id="inicio" className="relative h-[420vh] bg-blush md:h-[500vh]" aria-label="Apresentação">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* letreiro gigante ao fundo */}
        <motion.div
          aria-hidden
          style={{ x: bgTextX }}
          className="pointer-events-none absolute left-0 top-[46%] -translate-y-1/2 select-none whitespace-nowrap font-display text-[38vw] leading-none text-cherry/[0.05] md:text-[24vw]"
        >
          cereja esmalteria
        </motion.div>

        {/* mão recortada, encostada à direita e embaixo, como no vídeo */}
        <motion.div
          style={{ scale: handScale, transformOrigin: '80% 100%' }}
          onPointerMove={onPointerMove}
          onPointerLeave={() => (nudge.current = 0)}
          className="absolute bottom-0 right-0 h-[54svh] md:h-[78svh]"
        >
          <canvas
            ref={canvasRef}
            className="h-full"
            style={{
              aspectRatio: String(FRAME_RATIO),
              maxWidth: '100vw',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0, #000 18%), linear-gradient(to bottom, transparent 0, #000 10%)',
              maskImage: 'linear-gradient(to right, transparent 0, #000 18%), linear-gradient(to bottom, transparent 0, #000 10%)',
              WebkitMaskComposite: 'source-in',
              maskComposite: 'intersect',
            }}
            role="img"
            aria-label="Mão com unhas cereja e marmorizadas girando conforme a página rola"
          />
          {pct < 100 && (
            <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-wine backdrop-blur">
              carregando {pct}%
            </span>
          )}
        </motion.div>

        {/* texto à esquerda */}
        <div className="relative mx-auto flex h-full max-w-6xl flex-col px-4 pt-20 md:justify-center md:px-8 md:pt-16">
          <div className="max-w-[34rem] md:w-[50%] md:max-w-none">
            <AnimatePresence mode="wait">
              {!active ? (
                <motion.div
                  key="intro"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -24, filter: 'blur(6px)' }}
                  transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
                >
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[.22em] text-mauve md:mb-5 md:text-xs">
                    Cereja · Esmalteria em Santo Amaro
                  </p>
                  <h1 className="font-display text-[12.5vw] leading-[0.92] text-wine sm:text-6xl md:text-[4.4vw] xl:text-[64px]">
                    Unhas prontas
                    <br />
                    <span className="text-cherry">sem fila.</span>
                  </h1>
                  <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-mauve md:mt-6 md:text-base">
                    Cutilagem, esmaltação em gel e nail art feita à mão. Escolha o horário pelo site e chegue só na hora.
                  </p>
                  <div className="mt-6 hidden items-center gap-5 md:flex">
                    <Button onClick={onBook}>
                      <CalendarHeart className="h-4 w-4" /> Agendar horário
                    </Button>
                    <a href="#servicos" className="inline-flex items-center gap-1 text-sm font-semibold text-wine hover:text-cherry">
                      Ver serviços <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={active.n}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
                  className="md:mt-[18vh]"
                >
                  {/* régua de progresso: um traço por visual */}
                  <div className="mb-5 flex w-56 gap-1.5 md:w-72" aria-hidden>
                    {LOOKS.map((l, i) => (
                      <span key={l.n} className={cx('h-[3px] flex-1 rounded-full transition-colors duration-500', i <= look ? 'bg-cherry' : 'bg-cherry/15')} />
                    ))}
                  </div>
                  <p className="flex items-baseline gap-3 text-xs font-bold uppercase tracking-[.2em] text-mauve">
                    <span className="text-cherry">{active.n}</span> {active.label}
                  </p>
                  <h2 className="mt-2 font-display text-[10vw] leading-none text-wine sm:text-5xl md:text-[3.6vw] xl:text-[56px]">{active.name}</h2>
                  <p className="mt-3 max-w-xs text-[15px] text-mauve md:text-base">{active.text}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* círculo cereja que cresce a partir da mão e leva para a próxima parte */}
        <motion.div style={{ clipPath }} className="absolute inset-0 z-10 grid place-items-center bg-cherry px-4">
          <motion.div style={{ opacity: finalOpacity, y: finalY }} className="text-center text-white">
            <p className="font-display text-[15vw] leading-[0.9] sm:text-7xl md:text-8xl lg:text-[112px]">
              Sua unha,
              <br />
              <span className="text-cherry-soft">do seu jeito.</span>
            </p>
            <p className="mx-auto mt-5 max-w-md text-white/80 md:text-lg">Escolha a cor, a arte e o horário. A gente cuida do resto.</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={onBook}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-bold text-cherry shadow-lift transition hover:bg-blush active:scale-[.97]"
              >
                <CalendarHeart className="h-5 w-5" /> Agendar horário
              </button>
              <a href="#servicos" className="inline-flex items-center gap-1 text-sm font-semibold text-white/90 hover:text-white">
                Ver os mais pedidos <ArrowDown className="h-4 w-4" />
              </a>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          className="absolute bottom-24 left-4 z-20 flex items-center gap-2 text-xs font-semibold text-mauve md:bottom-5 md:left-8"
          style={{ opacity: hintOpacity }}
        >
          <ArrowDown className="h-4 w-4 animate-bounce" /> role para girar a mão
        </motion.div>
      </div>
    </section>
  )
}
