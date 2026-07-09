import { chromium } from 'playwright';

const out = '/opt/cursor/artifacts/screenshots';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:3847', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

const joinBtn = page.locator('.btn-join').first();
if (await joinBtn.count()) {
  await joinBtn.click();
} else {
  await page.click('text=+ Create a room');
  await page.fill('input[placeholder*="Coffee"]', 'Demo room');
  await page.click('text=Create & join');
}
await page.waitForSelector('text=Open chat', { timeout: 5000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/03-open-chat.png`, fullPage: true });

await page.click('text=People');
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/04-people.png`, fullPage: true });

await browser.close();
console.log('done');
