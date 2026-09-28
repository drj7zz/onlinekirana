import { useEffect } from 'react';

/**
 * Per-page SEO.
 *
 * This is a single-page app, so every route ships the same <head>. Search
 * engines and social previews read the document, not the DOM, so the title and
 * meta tags are rewritten in place as the visitor moves between pages.
 *
 * Each page calls this with its own values. The `description` doubles as the
 * search-result snippet and the `og:*` tags, so it is written for a shopper
 * ("Buy X in Birgunj") rather than as internal labelling.
 *
 * The values are also mirrored onto the DOM head on every call, and `canonical`
 * is set from the current path so each page has exactly one indexable URL.
 */
export function useSeo({ title, description, image, type = 'website', noindex = false }) {
  useEffect(() => {
    // No title means "this layer has nothing to say" (e.g. a wrapper hook that
    // defers to the page), so leave the head exactly as the page set it.
    if (!title) return;
    document.title = title;

    const set = (selector, attr, value) => {
      if (!value) return;
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        const [key, val] = selector.replace(/meta\[|\]/g, '').split('=');
        el.setAttribute(key, val.replace(/"/g, ''));
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    set('meta[name="description"]', 'content', description);
    set('meta[property="og:title"]', 'content', title);
    set('meta[property="og:description"]', 'content', description);
    set('meta[property="og:type"]', 'content', type);
    set('meta[property="og:site_name"]', 'content', 'OnlineKirana');
    if (image) {
      set('meta[property="og:image"]', 'content', image);
      set('meta[name="twitter:card"]', 'content', 'summary_large_image');
      set('meta[name="twitter:title"]', 'content', title);
      set('meta[name="twitter:description"]', 'content', description);
      if (image) set('meta[name="twitter:image"]', 'content', image);
    }

    // robots: shopper-private pages must never be indexed
    set('meta[name="robots"]', 'content', noindex ? 'noindex, nofollow' : 'index, follow');

    // canonical — one URL per page, so ?search= and ?category= variants of the
    // home page do not compete with each other in search results
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', `${window.location.origin}${window.location.pathname}`);
  }, [title, description, image, type, noindex]);
}

export default useSeo;
