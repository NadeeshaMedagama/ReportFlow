/**
 * Renders docs/er-diagram.html to docs/er-diagram.png with a local Chrome.
 * Usage: node docs/render-er-diagram.js  (needs `npm i -g playwright-core` or run from a folder that has it)
 */
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1400 }, deviceScaleFactor: 2 });
  await page.goto('file://' + path.resolve(__dirname, 'er-diagram.html'));
  await page.waitForSelector('#diagram svg', { timeout: 30000 });
  await page.waitForTimeout(500);
  await page.locator('#diagram').screenshot({ path: path.resolve(__dirname, 'er-diagram.png') });
  await browser.close();
  console.log('Wrote docs/er-diagram.png');
})();
