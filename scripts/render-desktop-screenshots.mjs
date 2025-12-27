import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const imgDir = join(__dirname, '..', 'img');

function getMacOSWindowHtml(contentUrl, title = 'GG Deploy') {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
    }
    .window {
      background: #1a1a2e;
      border-radius: 12px;
      overflow: hidden;
      box-shadow:
        0 50px 100px -20px rgba(0, 0, 0, 0.5),
        0 30px 60px -30px rgba(0, 0, 0, 0.6),
        0 0 0 1px rgba(255, 255, 255, 0.1);
      width: 1024px;
      height: 700px;
    }
    .titlebar {
      background: linear-gradient(180deg, #3a3a4a 0%, #2a2a3a 100%);
      height: 38px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.3);
    }
    .traffic-lights {
      display: flex;
      gap: 8px;
    }
    .btn {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 0.5px solid rgba(0, 0, 0, 0.2);
    }
    .btn-close { background: linear-gradient(180deg, #ff5f57 0%, #e0443e 100%); }
    .btn-min { background: linear-gradient(180deg, #febc2e 0%, #dea123 100%); }
    .btn-max { background: linear-gradient(180deg, #28c840 0%, #1aab29 100%); }
    .title {
      flex: 1;
      text-align: center;
      color: #b0b0c0;
      font-size: 13px;
      font-weight: 500;
      margin-right: 52px;
    }
    .content {
      width: 100%;
      height: calc(100% - 38px);
      border: none;
    }
  </style>
</head>
<body>
  <div class="window">
    <div class="titlebar">
      <div class="traffic-lights">
        <span class="btn btn-close"></span>
        <span class="btn btn-min"></span>
        <span class="btn btn-max"></span>
      </div>
      <span class="title">${title}</span>
    </div>
    <iframe class="content" src="${contentUrl}"></iframe>
  </div>
</body>
</html>`;
}

async function captureDesktopApp() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 850 }
  });

  // First, capture the main screen
  console.log('Capturing desktop main screen...');
  const mainPage = await context.newPage();
  await mainPage.setContent(getMacOSWindowHtml('http://localhost:3847', 'GG Deploy'));
  await mainPage.waitForTimeout(2000);

  // Wait for iframe to load
  const frame = mainPage.frameLocator('iframe');
  await frame.locator('body').waitFor({ state: 'visible', timeout: 10000 });
  await mainPage.waitForTimeout(1000);

  await mainPage.screenshot({
    path: join(imgDir, 'desktop-main.png'),
    clip: { x: 0, y: 0, width: 1200, height: 850 }
  });
  console.log('✓ Captured: desktop-main.png');

  // Now capture with settings open
  console.log('Capturing desktop settings screen...');
  try {
    await frame.locator('.settings-btn').click();
    await mainPage.waitForTimeout(1000);

    await mainPage.screenshot({
      path: join(imgDir, 'desktop-settings.png'),
      clip: { x: 0, y: 0, width: 1200, height: 850 }
    });
    console.log('✓ Captured: desktop-settings.png');
  } catch (e) {
    console.log('Could not capture settings (button not found):', e.message);
  }

  await browser.close();
  console.log('Done! Desktop screenshots saved to img/');
}

captureDesktopApp().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
