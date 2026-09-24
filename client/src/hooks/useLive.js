import { useEffect, useRef } from 'react';

// Lightweight "real-time": re-runs fn every intervalMs, pausing when the tab is hidden.
// Data updates in place — no page refresh.
export function useLive(fn, intervalMs = 8000, deps = []) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    fnRef.current(); // immediate first load
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fnRef.current();
    }, intervalMs);
    return () => clearInterval(id);
  }, deps);
}
