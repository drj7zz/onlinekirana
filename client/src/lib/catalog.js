import API from '../api';

const CATEGORY_CACHE_KEY = 'ok_catalog_categories';
const PRODUCT_CACHE_KEY = 'ok_catalog_products';
const CATEGORY_TTL = 5 * 60 * 1000;
const PRODUCT_TTL = 30 * 1000;
const requests = new Map();

function readCache(key) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) || 'null');
    return cached && cached.expiresAt > Date.now() ? cached.value : null;
  } catch {
    return null;
  }
}

function writeCache(key, value, ttl) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + ttl }));
  } catch {
    // The in-memory cache still works when browser storage is unavailable.
  }
}

function request(key, storageKey, ttl, load) {
  const cached = requests.get(key);
  if (cached) return cached;

  const stored = readCache(storageKey);
  if (stored) return Promise.resolve(stored);

  const pending = load()
    .then((value) => {
      writeCache(storageKey, value, ttl);
      requests.delete(key);
      return value;
    })
    .catch((error) => {
      requests.delete(key);
      throw error;
    });
  requests.set(key, pending);
  return pending;
}

export function getCachedProducts(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).sort(([left], [right]) => left.localeCompare(right)),
  ).toString();
  return readCache(`${PRODUCT_CACHE_KEY}:${query}`);
}

export function getCategories() {
  return request(
    CATEGORY_CACHE_KEY,
    CATEGORY_CACHE_KEY,
    CATEGORY_TTL,
    () => API.get('/products/categories').then(({ data }) => (Array.isArray(data) ? data : [])),
  );
}

export function getProducts(params = {}) {
  // remember the last delivery pin so the storefront can rank nearby shops
  try {
    const pin = JSON.parse(localStorage.getItem('ok_delivery_pin') || 'null');
    if (pin && pin.lat != null && pin.lng != null && params.lat === undefined) {
      params = { ...params, lat: pin.lat, lng: pin.lng };
    }
  } catch { /* no pin saved */ }
  const query = new URLSearchParams(
    Object.entries(params).sort(([left], [right]) => left.localeCompare(right)),
  ).toString();
  const key = `${PRODUCT_CACHE_KEY}:${query}`;
  return request(
    key,
    key,
    PRODUCT_TTL,
    () => API.get('/products', { params }).then(({ data }) => data),
  );
}
