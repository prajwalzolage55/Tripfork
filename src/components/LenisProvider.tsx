'use client';

import { useEffect, useRef } from 'react';
import Lenis from 'lenis';

export default function LenisProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      allowNestedScroll: true,
      autoToggle: true,
      prevent: (node: HTMLElement) => {
        if (!node || !(node instanceof HTMLElement)) return false;

        // 1. Explicit data-lenis-prevent attribute anywhere in hierarchy
        if (
          node.hasAttribute('data-lenis-prevent') ||
          Boolean(node.closest('[data-lenis-prevent], [data-lenis-prevent-wheel], [data-lenis-prevent-touch]'))
        ) {
          return true;
        }

        // 2. Any modal, dialog, drawer, sheet, popup, backdrop, or fixed overlay
        if (
          Boolean(
            node.closest(
              '[role="dialog"], [aria-modal="true"], .fixed, [data-modal], [data-radix-portal], [data-drawer], .permission-overlay'
            )
          )
        ) {
          return true;
        }

        // 3. Any element or ancestor that is scrollable
        let cur: HTMLElement | null = node;
        while (cur && cur !== document.body && cur !== document.documentElement) {
          const style = window.getComputedStyle(cur);
          const overflowY = style.overflowY;
          if (
            (overflowY === 'auto' || overflowY === 'scroll') &&
            cur.scrollHeight > cur.clientHeight
          ) {
            return true;
          }
          const overflowX = style.overflowX;
          if (
            (overflowX === 'auto' || overflowX === 'scroll') &&
            cur.scrollWidth > cur.clientWidth
          ) {
            return true;
          }
          cur = cur.parentElement;
        }

        return false;
      },
    });

    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
