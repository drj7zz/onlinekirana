fix export default async function run(page, ui) {
  const out = {};
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card', { timeout: 20000 });

  // ---- 1. search: browse state (nothing typed) ----
  await page.click('#nav-search');
  await page.waitForTimeout(900);
  out.browsePanel = await page.evaluate(() => ({
    open: !!document.querySelector('.search-panel'),
    groups: [...document.querySelectorAll('.search-group-head span')].map((e) => e.textContent.trim()),
    catRows: document.querySelectorAll('.search-group .search-item-plain').length,
  }));
  await page.screenshot({ path: 'C:/Users/girid/OneDrive/Documents/Desktop/birgunj/onlinekirana/client/_s-browse.png' });

  // ---- 2. search: results ----
  await page.fill('#nav-search', 'ri');
  await page.waitForTimeout(1200);
  out.results = await page.evaluate(() => ({
    items: document.querySelectorAll('.search-item:not(.search-item-plain)').length,
    hits: document.querySelectorAll('.search-hit').length,
    seeAll: document.querySelector('.search-all')?.textContent.trim(),
  }));
  await page.screenshot({ path: 'C:/Users/girid/OneDrive/Documents/Desktop/birgunj/onlinekirana/client/_s-results.png' });

  // ---- 3. search: no-match empty state ----
  await page.fill('#nav-search', 'zzzqqq');
  await page.waitForTimeout(1300);
  out.empty = await page.evaluate(() => ({
    shown: !!document.querySelector('.search-empty'),
    text: document.querySelector('.search-empty strong')?.textContent.trim(),
    chips: [...document.querySelectorAll('.search-empty-chips button')].map((b) => b.textContent.trim()),
  }));
  await page.screenshot({ path: 'C:/Users/girid/OneDrive/Documents/Desktop/birgunj/onlinekirana/client/_s-empty.png' });

  // ---- 4. recent search gets remembered ----
  await page.fill('#nav-search', 'dal');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  out.afterSearch = { url: page.url(), stored: await page.evaluate(() => localStorage.getItem('ok_recent_searches')) };

  await page.click('#nav-search');
  await page.waitForTimeout(700);
  out.recentShown = await page.evaluate(() =>
    [...document.querySelectorAll('.search-group')].map((g) => g.querySelector('.search-group-head span')?.textContent.trim()));

  // ---- 5. product page: Buy now ----
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card', { timeout: 20000 });
  await page.click('.card h3');
  await page.waitForSelector('.pdp-buy', { timeout: 10000 });
  out.pdp = await page.evaluate(() => ({
    hasAdd: !!document.querySelector('.pdp-buy .buy-add'),
    hasBuyNow: !!document.querySelector('.pdp-buy .buy-now'),
    title: document.title,
  }));
  await page.screenshot({ path: 'C:/Users/girid/OneDrive/Documents/Desktop/birgunj/onlinekirana/client/_s-pdp.png' });

  // Buy now should add and land on checkout
  await page.click('.pdp-buy .buy-now');
  await page.waitForTimeout(1800);
  out.afterBuyNow = { url: page.url() };

  out.pageErrors = errs;
  return out;
}
