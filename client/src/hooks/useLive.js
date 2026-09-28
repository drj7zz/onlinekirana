import { useEffect, useRef } from 'react';

/**
 * Lightweight "real-time": re-runs `fn` every `intervalMs`, pausing while the
 * tab is hidden. Data updates in place — no page refresh.
 *
 * The latest `fn` is kept in a ref so changing the callback does not restart the
 * interval (every page passes a fresh arrow function, so it would otherwise
 * reset the timer on every render and never fire). The ref is written inside an
 * effect rather than during render: assigning `ref.current` while rendering is
 * not safe, because React may render a component and then throw that work away,
 * leaving the ref holding a callback from a discarded render.
 */
export function useLive(fn, intervalMs = 8000, deps = []) {
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    fnRef.current(); // immediate first load
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fnRef.current();
    }, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
