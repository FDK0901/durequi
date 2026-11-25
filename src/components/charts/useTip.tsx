import { useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react';
import { TipBox, type Tip } from './TipBox';

/** A tooltip that follows the pointer, or sits at the element that has the focus. */
export function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);

  const over = (body: () => ReactNode) => ({
    onPointerEnter: (e: PointerEvent) => setTip({ x: e.clientX, y: e.clientY, body: body() }),
    onPointerMove: (e: PointerEvent) => setTip({ x: e.clientX, y: e.clientY, body: body() }),
    onPointerLeave: () => setTip(null),
    onFocus: (e: FocusEvent) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ x: r.left + r.width / 2, y: r.top, body: body() });
    },
    onBlur: () => setTip(null),
  });

  return { tip: tip && <TipBox {...tip} />, over };
}
