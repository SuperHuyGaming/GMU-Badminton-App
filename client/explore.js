/* global require */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://gmu-frontend-staging.onrender.com/');
  
  console.log('Title:', await page.title());
  
  const html = await page.content();
  console.log('Body length:', html.length);
  
  // Get all visible text and links/buttons
  const elements = await page.evaluate(() => {
    const interactables = Array.from(document.querySelectorAll('a, button, input')).map(el => {
      return {
        tag: el.tagName,
        text: el.innerText || el.value || el.placeholder || '',
        id: el.id,
        className: el.className,
        href: el.href || ''
      };
    });
    return interactables;
  });
  
  console.log(JSON.stringify(elements, null, 2));

  await browser.close();
})();
