import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const imgDir = join(__dirname, '..', 'img');

async function captureSettings() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto('http://localhost:3847', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Find and click settings button by class
  await page.click('.settings-btn');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: join(imgDir, 'webui-settings.png') });
  console.log('✓ Captured: webui-settings.png');

  await browser.close();
}

captureSettings().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
