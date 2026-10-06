import { useState, type MouseEvent } from "react";

export interface TooltipState {
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

/** グラフの各要素にカーソルを合わせたときに値を表示する */
export const useTooltip = () => {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const bind = (text: string) => ({
    onMouseMove: (e: MouseEvent) => setTip({ text, x: e.clientX, y: e.clientY }),
    onMouseLeave: () => setTip(null),
  });
  const node =
    tip === null ? null : (
      <div
        role="tooltip"
        className="pointer-events-none fixed z-[60] rounded-lg bg-fg px-2.5 py-1.5 text-xs whitespace-nowrap text-bg shadow-lg"
        style={{ left: tip.x + 12, top: tip.y - 36 }}
      >
        {tip.text}
      </div>
    );
  return { bind, node };
};
