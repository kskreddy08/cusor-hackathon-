import { chromium } from 'playwright';

const out = '/opt/cursor/artifacts/screenshots';

const browser = await chromium.launch();

// Seed: another tab creates a room first
const seeder = await browser.newPage();
await seeder.goto('http://localhost:3847', { waitUntil: 'networkidle' });
await seeder.click('text=+ Create a room');
await seeder.fill('input[placeholder*="Coffee"]', 'Coffee chat');
await seeder.click('text=Create & join');
await seeder.waitForTimeout(800);

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:3847', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/01-lobby.png`, fullPage: true });

await page.click('text=+ Create a room');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/02-create-room.png`, fullPage: true });

await page.click('text=Back');
await page.click('text=Join');
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/03-open-chat.png`, fullPage: true });

await page.click('text=People');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/04-people.png`, fullPage: true });

await browser.close();
console.log('done');
