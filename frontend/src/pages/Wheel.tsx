import { useEffect, useRef, useState } from 'react'

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return reduced
}

export function Wheel({ spinning }: { spinning: boolean }) {
  const reducedMotion = usePrefersReducedMotion()
  const [angle, setAngle] = useState(0)
  const wasSpinning = useRef(false)

  useEffect(() => {
    if (spinning && !wasSpinning.current) {
      const n = Math.floor(Math.random() * 3)
      setAngle((value) => value + 360 * (4 + n))
    }
    wasSpinning.current = spinning
  }, [spinning])

  const spinClass = spinning && !reducedMotion ? ' is-spinning' : ''

  return (
    <div className="wheel-wrap" aria-hidden="true">
      <div className="wheel-glow" />
      <div className="wheel-pointer" />
      <div
        className={`wheel${spinClass}`}
        style={{ transform: `rotate(${angle}deg)` }}
      />
      <div className="wheel-hub">вкус</div>
    </div>
  )
}
