export default async function run(page, ui) {
  const out = {};

  // ---- desktop: nav + search suggestions ----
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#nav-search', { timeout: 15000 });

  out.navLinks = await page.$$eval('.nav-link', (els) => els.map((e) => e.textContent.trim()));
  out.headerBox = await page.$eval('.site-header', (e) => {
    const r = e.getBoundingClientRect();
    return { position: getComputedStyle(e).position, h: Math.round(r.height) };
  });

  // type into search and wait for the debounced suggestions to land
  await page.fill('#nav-search', 'a');
  await page.waitForTimeout(600);
  await page.fill('#nav-search', 'ri');
  await page.waitForSelector('.search-panel', { timeout: 10000 }).catch(() => { });
  await page.waitForTimeout(900);

  out.panel = await page.evaluate(() => {
    const p = document.querySelector('.search-panel');
    if (!p) return { present: false };
    const r = p.getBoundingClientRect();
    return {
      present: true,
      w: Math.round(r.width),
      h: Math.round(r.height),
      items: [...document.querySelectorAll('.search-item-name')].map((e) => e.textContent.trim()),
      marks: document.querySelectorAll('.search-hit').length,
      seeAll: document.querySelector('.search-all')?.textContent.trim() || null,
    };
  });

  // keyboard: arrow down should move the active option
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(200);
  out.activeAfterArrow = await page.$$eval('.search-item.is-active', (e) => e.length);
  await page.screenshot({ path: 'C:/Users/girid/OneDrive/Documents/Desktop/birgunj/onlinekirana/client/_search-desktop.png' });

  // ---- footer ----
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  out.footer = await page.evaluate(() => {
    const f = document.querySelector('.site-footer');
    if (!f) return { present: false };
    return {
      present: true,
      bg: getComputedStyle(f).backgroundColor,
      stripItems: document.querySelectorAll('.footer-strip-item').length,
      cols: document.querySelectorAll('.footer-col').length,
      catLinks: document.querySelectorAll('.footer-links a').length,
    };
  });
  await page.screenshot({ path: 'C:/Users/girid/OneDrive/Documents/Desktop/birgunj/onlinekirana/client/_footer-desktop.png' });

  return out;
}
