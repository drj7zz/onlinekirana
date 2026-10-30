import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CircleCheck, TriangleAlert, Info, X } from 'lucide-react';

/**
 * Toast notifications, shared by both apps (the portal imports this file via
 * `@shared`).
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Profile saved');
 *   toast.error('Could not delete that product');
 *   toast.info('Rider is on the way');
 *
 * A toast is the transient confirmation for an action that succeeded (or
 * failed) while the user is looking somewhere else on the page. Inline
 * `.save-msg` / `.error` paragraphs stay for form validation, which the user
 * must read next to the field; a toast covers "it worked".
 *
 * Auto-dismisses after 3.5s; multiple toasts stack; the newest appears at the
 * bottom on mobile (thumb-reachable) and top-right on desktop.
 */

const ToastContext = createContext(null);

const ICONS = { success: CircleCheck, error: TriangleAlert, info: Info };
const TIMEOUT = 3500;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind, text) => {
    const id = ++seq.current;
    setToasts((list) => [...list.slice(-3), { id, kind, text }]); // keep at most 4
    setTimeout(() => dismiss(id), TIMEOUT);
  }, [dismiss]);

  const api = {
    success: (t) => push('success', t),
    error: (t) => push('error', t),
    info: (t) => push('info', t),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* role=status so screen readers announce toasts without stealing focus */}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(({ id, kind, text }) => {
          const Icon = ICONS[kind] || Info;
          return (
            <div key={id} className={`toast toast-${kind}`}>
              <Icon size={17} aria-hidden="true" />
              <span>{text}</span>
              <button type="button" className="toast-x" aria-label="Dismiss" onClick={() => dismiss(id)}>
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
