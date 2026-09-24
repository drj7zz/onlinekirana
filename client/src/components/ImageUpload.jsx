import { useRef, useState } from 'react';
import { Camera, LoaderCircle, ImagePlus, Trash2 } from 'lucide-react';
import API, { imageUrl } from '../api';

/**
 * Reusable image upload widget with instant local preview.
 * - round  → circular preview (avatar / shop logo); rounded square otherwise (product photos)
 * - endpoint → '/uploads/avatar' | '/uploads/shop-logo' | '/uploads/product'
 * - value → current saved URL; onChange(url) fires after upload or removal
 */
export default function ImageUpload({ endpoint, value, onChange, round = false, label = 'Upload image', size = 96 }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // instant local preview while uploading

  const src = preview || imageUrl(value) || null;

  const pick = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Only JPG, PNG or WebP'); return; }
    if (file.size > 3 * 1024 * 1024) { setError('Max size 3 MB'); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);

    setBusy(true);
    const fd = new FormData();
    fd.append('image', file);
    API.post(endpoint, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(({ data }) => { onChange(data.url); setPreview(null); })
      .catch((e) => { setError(e.response?.data?.message || 'Upload failed'); setPreview(null); })
      .finally(() => setBusy(false));
  };

  return (
    <div className={`img-upload${round ? ' round' : ''}`}>
      <div
        className="img-upload-box" role="button" tabIndex={0} aria-label={label}
        style={{ width: size, height: size }}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        {src
          ? <img src={src} alt="" style={{ width: size, height: size }} />
          : <ImagePlus size={Math.round(size / 3.2)} aria-hidden="true" />}
        <span className="img-upload-overlay">
          {busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Camera size={15} aria-hidden="true" />}
          {busy ? 'Uploading…' : src ? 'Change' : label}
        </span>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {src && !busy && (
        <button type="button" className="img-upload-clear" aria-label="Remove image"
          onClick={() => { setPreview(null); onChange(''); }}>
          <Trash2 size={12} aria-hidden="true" />
        </button>
      )}
      {error && <p className="field-error img-upload-err">{error}</p>}
    </div>
  );
}
