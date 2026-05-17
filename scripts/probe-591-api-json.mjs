import { chromium } from 'playwright';

async function main() {
  console.log('=== 591 API JSON Response Interception ===\n');
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  // Collect API responses
  const apiResponses = [];
  
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const resourceType = route.request().resourceType();
    
    if (url.includes('api.591') || url.includes('/search/') || url.includes('/home/')) {
      try {
        const response = await route.fetch();
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          const json = await response.json();
          apiResponses.push({
            url: url,
            method: route.request().method(),
            status: response.status(),
            data: JSON.stringify(json).slice(0, 3000),
            dataKeys: typeof json === 'object' ? Object.keys(json).join(', ') : typeof json,
          });
        }
        route.fulfill({ response });
      } catch(e) {
        route.continue();
      }
    } else {
      route.continue();
    }
  });

  try {
    console.log('Navigating to rent.591.com.tw list page...');
    await page.goto('https://rent.591.com.tw/list?region=1', { 
      waitUntil: 'domcontentloaded', 
      timeout: 20000 
    });
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    console.log(`\nAPI responses captured: ${apiResponses.length}\n`);
    for (const resp of apiResponses) {
      console.log(`=== ${resp.method} ${resp.status} ${resp.url} ===`);
      console.log(`Keys: ${resp.dataKeys}`);
      console.log(`Data: ${resp.data.slice(0, 1000)}`);
      console.log('');
    }

    // Also try to click a region/city to trigger more API calls
    console.log('Trying to interact with page to trigger more API calls...');
    
    // Check for city/region selector
    const citySelectors = [
      'select[name="region"]', 
      '[class*="region"] select',
      '[class*="city"] select',
      'button[data-region]',
      '[class*="tab"]',
    ];
    
    for (const sel of citySelectors) {
      const el = await page.$(sel);
      if (el) {
        console.log(`Found element: ${sel} (${await el.textContent()})`);
        break;
      }
    }

    // Wait a bit more for any lazy-loaded content
    await page.waitForTimeout(2000);
    console.log(`Total API responses: ${apiResponses.length}`);

    // Check what the page actually displays
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(`\nPage body text (first 2000 chars):\n${bodyText.slice(0, 2000)}`);

  } catch(e) {
    console.log(`Error: ${e.message}`);
  }

  await page.close();
  await context.close();
  await browser.close();
  console.log('\n=== Done ===');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
