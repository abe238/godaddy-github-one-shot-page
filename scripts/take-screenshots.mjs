import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const imgDir = join(__dirname, '..', 'img');

async function takeScreenshots() {
  await mkdir(imgDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Navigate to main UI
  await page.goto('http://localhost:3847', { waitUntil: 'networkidle0' });
  await page.waitForSelector('body');
  await new Promise(r => setTimeout(r, 1000));

  // Main screen screenshot
  await page.screenshot({
    path: join(imgDir, 'webui-main.png'),
    fullPage: false
  });
  console.log('✓ Captured: webui-main.png');

  // Click settings button to open modal
  const settingsBtn = await page.$('[aria-label="Settings"], button:has-text("Settings"), .settings-btn, button[title="Settings"]');
  if (settingsBtn) {
    await settingsBtn.click();
    await new Promise(r => setTimeout(r, 500));
  } else {
    // Try finding any gear icon or settings-related button
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent?.toLowerCase() || '');
      if (text.includes('setting') || text.includes('config') || text.includes('⚙')) {
        await btn.click();
        await new Promise(r => setTimeout(r, 500));
        break;
      }
    }
  }

  // Settings screen screenshot
  await page.screenshot({
    path: join(imgDir, 'webui-settings.png'),
    fullPage: false
  });
  console.log('✓ Captured: webui-settings.png');

  await browser.close();
  console.log('Done! Screenshots saved to img/');
}

takeScreenshots().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
