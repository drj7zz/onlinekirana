import { useState } from 'react';

/**
 * One image element that never shows a broken-image icon.
 *
 * Why a component: several places (product cards, product detail, shop logos,
 * avatars) store an image URL that may 404 after a rename/re-upload, and the
 * native broken-image glyph looked like a bug. On error this swaps to a child
 * fallback (an icon or initials node) instead of DOM surgery, so React stays in
 * charge of the element.
 *
 * props:
 *   src     – resolved URL, or a falsy value to render only the fallback
 *   alt     – alt text (omit for decorative images)
 *   imgCls  – class for the <img>; fallbackCls for the fallback wrapper
 *   fallback – node rendered when src is empty OR the image fails to load
 *   ...rest – forwarded to <img> (width, height, style, loading, etc.)
 */
export default function SmartImage({ src, alt = '', imgCls = '', fallbackCls = '', fallback, ...rest }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span className={`img-fallback${fallbackCls ? ` ${fallbackCls}` : ''}`}>{fallback}</span>;
  }
  return (
    <img
      src={src}
      alt={alt}
      className={imgCls}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
