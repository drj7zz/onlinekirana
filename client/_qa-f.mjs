dontexport default async function run(page, ui) {
  const out = {};
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('http://localhost:5173/?search=masala', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card', { timeout: 20000 });

  // the discounted card must show BOTH the original and the reduced price
  out.card = await page.evaluate(() => {
    const c = document.querySelector('.card');
    return {
      name: c.querySelector('h3')?.textContent.trim(),
      strike: c.querySelector('.strike')?.textContent.trim() || null,
      price: c.querySelector('.price')?.textContent.trim(),
      off: c.querySelector('.off')?.textContent.trim() || null,
    };
  });

  // product page
  await page.click('.card h3');
  await page.waitForSelector('.pdp', { timeout: 10000 });
  out.pdp = await page.evaluate(() => ({
    strike: document.querySelector('.pdp-price .strike')?.textContent.trim() || null,
    price: document.querySelector('.pdp-price .price')?.textContent.trim(),
    off: document.querySelector('.pdp-price .off')?.textContent.trim() || null,
    save: document.querySelector('.pdp-save')?.textContent.trim() || null,
    // exactly ONE add action, and a real quantity picker
    addButtons: document.querySelectorAll('.buy-add').length,
    buyNow: document.querySelectorAll('.buy-now').length,
    qtyPicker: !!document.querySelector('.qty-stepper'),
    font: getComputedStyle(document.querySelector('.detail-buy h1')).fontFamily.split(',')[0],
  }));
  await page.screenshot({ path: 'C:/Users/girid/OneDrive/Documents/Desktop/birgunj/onlinekirana/client/_f-pdp.png' });

  // quantity picker must feed the add button
  await page.click('.qty-stepper button:last-of-type');
  await page.waitForTimeout(250);
  out.addLabelAfterQty = await page.$eval('.buy-add', (e) => e.textContent.trim());
  await page.click('.buy-add');
  await page.waitForTimeout(600);
  out.inCart = await page.evaluate(() => ({
    qty: document.querySelector('.buy-stepper-qty')?.textContent.trim(),
    total: document.querySelector('.buy-stepper-total')?.textContent.trim(),
  }));

  // cart math must agree with the PDP
  await page.click('.btn-cart');
  await page.waitForSelector('.cart-line', { timeout: 8000 });
  out.cart = await page.evaluate(() => ({
    unit: document.querySelector('.cart-line-unit')?.textContent.trim(),
    strike: document.querySelector('.cart-line-price .strike')?.textContent.trim() || null,
    sub: document.querySelector('.cart-line-sub')?.textContent.trim(),
    saveLine: document.querySelector('.cart-line-save')?.textContent.trim() || null,
    off: document.querySelector('.cart-line-off')?.textContent.trim() || null,
    sumItems: document.querySelector('.cart-sum-rows dd')?.textContent.trim(),
    sumTotal: document.querySelector('.cart-sum-total strong')?.textContent.trim(),
  }));
  await page.screenshot({ path: 'C:/Users/girid/OneDrive/Documents/Desktop/birgunj/onlinekirana/client/_f-cart.png' });

  out.pageErrors = errs;
  return out;
}
