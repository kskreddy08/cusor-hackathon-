import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:3847';

const browser = await chromium.launch();
const hostCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });

const host = await hostCtx.newPage();
await host.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
await host.waitForSelector('text=Rooms on this WiFi', { timeout: 15000 });
await host.click('text=+ Create a room');
await host.fill('input[placeholder*="Coffee"]', 'UI Test Room');
await host.click('text=Create & join');
await host.waitForSelector('text=Open chat', { timeout: 10000 });

const guest = await guestCtx.newPage();
await guest.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
await guest.waitForSelector('text=Live chat ✓', { timeout: 15000 });
await guest.waitForSelector('text=UI Test Room', { timeout: 15000 });
await guest.click('.btn-join');
await guest.waitForSelector('text=Open chat', { timeout: 10000 });

await browser.close();
console.log('UI test PASS');
