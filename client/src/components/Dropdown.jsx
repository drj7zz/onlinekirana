import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * A custom dropdown filter — replaces the raw native `<select>` so the listing
 * page reads like a standard ecommerce toolbar. Keyboard + Escape supported,
 * closes on outside click, and renders a check mark on the active option.
 */
export default function Dropdown({ label, value, options, onChange, icon: Icon }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const current = options.find((o) => o.value === value) || options[0];

  return (
    <div className={`dd${open ? ' is-open' : ''}`} ref={ref}>
      <button
        type="button"
        className="dd-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {Icon ? <Icon size={15} className="dd-icon" aria-hidden="true" /> : null}
        <span className="dd-value">{current?.label}</span>
        {label && <span className="dd-label">{label}</span>}
        <ChevronDown size={14} className="dd-chev" aria-hidden="true" />
      </button>
      {open && (
        <ul className="dd-menu" role="listbox" aria-label={label || 'Options'}>
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`dd-item${o.value === value ? ' is-active' : ''}`}
                onClick={() => { onChange(o.value); setOpen(false); }}
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={14} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
