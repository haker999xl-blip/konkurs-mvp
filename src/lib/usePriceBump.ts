import { useEffect, useRef, useState } from 'react';

/**
 * Хук вау-фичи: возвращает true на 520 мс, когда значение изменилось.
 * Уважает prefers-reduced-motion — тогда просто мгновенная смена числа.
 */
export function usePriceBump(value: number): boolean {
  const prev = useRef(value);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    // Смена значения — внешнее событие для эффекта: подсветку зажигаем здесь осознанно.
    setBump(true);
    const timer = window.setTimeout(() => setBump(false), 520);
    return () => window.clearTimeout(timer);
  }, [value]);

  return bump;
}
