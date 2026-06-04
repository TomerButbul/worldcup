import { useRef, type PointerEvent as RPointerEvent, type MouseEvent as RMouseEvent } from "react";

// Press-and-hold without breaking a normal tap. Call once per component to get a
// factory, then spread `longPress(onHold)` onto any element. A normal tap still
// fires the element's onClick; a ~400ms hold fires onHold and suppresses the
// click that would otherwise follow (so e.g. a tap-to-pick handler doesn't also
// run). Pointer drift (scrolling) cancels the hold. Shared refs are fine — a
// single pointer can only press one thing at a time.
export function useLongPress(ms = 400) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return (onHold: () => void) => ({
    onPointerDown: (e: RPointerEvent) => {
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        onHold();
      }, ms);
    },
    onPointerMove: (e: RPointerEvent) => {
      if (origin.current && Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 10) {
        clear();
      }
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    // Swallow the click that fires right after a long-press so the tap action
    // (pick a winner / select a third) doesn't run when you only wanted details.
    onClickCapture: (e: RMouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
    onContextMenu: (e: RMouseEvent) => e.preventDefault(),
  });
}
