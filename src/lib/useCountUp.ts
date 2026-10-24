import { useEffect, useRef, useState } from 'react';

const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Плавно «докручивает» число до нового значения (ease-out, по умолчанию 700 мс).
 * При первом показе считает от 0. При prefers-reduced-motion меняет значение сразу.
 */
export function useCountUp(value: number, duration = 700): number {
  const [shown, setShown] = useState(() => (prefersReduced() ? value : 0));
  // Стартовая точка анимации — последнее показанное значение. Меняем её только при новом запуске.
  const from = useRef(shown);

  useEffect(() => {
    if (prefersReduced() || duration <= 0) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return shown;
}
