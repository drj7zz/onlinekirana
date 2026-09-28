
export default async function run(page, ui) {
  const out = {};
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card', { timeout: 20000 });

  // buy button must be OUTLINED now, not a solid green block
  out.cardBuy = await page.evaluate(() => {
    const b = document.querySelector('.card .buy-add');
    if (!b) return { found: false };
    const cs = getComputedStyle(b);
    return { found: true, bg: cs.backgroundColor, color: cs.color, border: cs.borderColor };
  });
  await page.screenshot({ path: 'C:/Users/girid/OneDrive/Documents/Desktop/birgunj/onlinekirana/client/_v-cards.png' });

  // search a term, then click the SAME box again -> panel must reopen
  await page.fill('#nav-search', 'dal');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await page.click('#nav-search');
  await page.waitForTimeout(700);
  out.reopens = await page.evaluate(() => ({
    panelOpen: !!document.querySelector('.search-panel'),
    groups: [...document.querySelectorAll('.search-group-head span')].map((e) => e.textContent.trim()),
  }));
  await page.screenshot({ path: 'C:/Users/girid/OneDrive/Documents/Desktop/birgunj/onlinekirana/client/_v-recent.png' });

  // ---- MOBILE: guest drawer ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.burger', { timeout: 15000 });
  await page.click('.burger');
  await page.waitForSelector('.drawer-panel', { timeout: 5000 });
  out.mobileGuest = await page.evaluate(() => {
    const p = document.querySelector('.drawer-panel').getBoundingClientRect();
    return {
      w: Math.round(p.width), h: Math.round(p.height),
      guestPrompt: !!document.querySelector('.drawer-guest'),
      quick: [...document.querySelectorAll('.drawer-quick strong')].map((e) => e.textContent.trim()),
      hasSearch: !!document.querySelector('.drawer-search input'),
      parent: document.querySelector('.drawer-panel').parentElement.parentElement.tagName,
    };
  });
  await page.screenshot({ path: 'C:/Users/girid/OneDrive/Documents/Desktop/birgunj/onlinekirana/client/_v-drawer-guest.png' });

  out.pageErrors = errs;
  return out;
}
