import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface Tip {
  x: number;
  y: number;
  body: ReactNode;
}

const WIDTH = 290;

export function TipBox({ x, y, body }: Tip) {
  const left = Math.max(8, Math.min(x + 14, window.innerWidth - WIDTH - 8));
  const below = y < window.innerHeight * 0.65;
  return createPortal(
    <div
      className="chart-tip"
      role="tooltip"
      style={below ? { left, top: y + 16 } : { left, bottom: window.innerHeight - y + 12 }}
    >
      {body}
    </div>,
    document.body,
  );
}
