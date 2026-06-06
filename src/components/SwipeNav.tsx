"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Swipe left/right between the main app tabs — but ONLY inside an installed PWA
// on a touch device (a native-app feel). In a normal browser tab it attaches
// nothing, so it can never interfere with desktop or in-browser use. It also
// bails on swipes that start in a horizontal scroller (the bracket tree) or that
// are vertical/slow, so it never hijacks scrolling.
const TABS = ["/dashboard", "/predict", "/tournament", "/bracket", "/rankings"];

function tabIndex(pathname: string): number {
  return TABS.findIndex((t) => pathname === t || pathname.startsWith(`${t}/`));
}

export default function SwipeNav() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (!standalone || !touch) return; // browser tab → do nothing

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let ignore = false;

    // True if the gesture began inside something that scrolls horizontally — let
    // that element keep the swipe (e.g. the knockout bracket).
    const startedInHScroller = (target: EventTarget | null): boolean => {
      let n = target as HTMLElement | null;
      while (n && n !== document.body) {
        const ox = getComputedStyle(n).overflowX;
        if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth + 4) return true;
        n = n.parentElement;
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        ignore = true;
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      startT = Date.now();
      ignore = startedInHScroller(e.target);
    };

    const onEnd = (e: TouchEvent) => {
      if (ignore) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      // Must be a quick, decisive, mostly-horizontal flick.
      if (Date.now() - startT > 700) return;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
      const idx = tabIndex(pathname);
      if (idx === -1) return; // not on a main tab → leave it alone
      const next = dx < 0 ? idx + 1 : idx - 1; // swipe left → forward
      if (next < 0 || next >= TABS.length) return; // clamp at the ends
      router.push(TABS[next]);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [pathname, router]);

  return null;
}
