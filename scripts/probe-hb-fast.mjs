import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
  });

  const page = await context.newPage();
  const apiCalls = [];

  page.on('response', (response) => {
    const url = response.url();
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('json') || url.includes('api') || url.includes('search') || url.includes('Search') || url.includes('list') || url.includes('List')) {
      apiCalls.push({ url: url.substring(0, 150), status: response.status(), ct: ct.substring(0, 40) });
    }
  });

  try {
    console.log('Navigating...');
    await page.goto('https://www.hbhousing.com.tw/Search/Result?type=S', { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    });
    console.log('Page loaded (DOMContentLoaded)');
    
    // Wait 5 seconds for content to load
    await page.waitForTimeout(5000);
    
    // Get page state
    const state = await page.evaluate(() => ({
      readyState: document.readyState,
      url: window.location.href,
      title: document.title,
      bodyLength: document.body?.innerText?.length || 0,
    }));
    console.log(`State: readyState=${state.readyState}, url=${state.url}, title=${state.title}, bodyLen=${state.bodyLength}`);

    // Try to find listing data in the page
    const text = await page.evaluate(() => document.body?.innerText || '');
    
    // Find anything that looks like housing data (prices, addresses)
    const priceMatches = text.match(/\d[\d,]*\s*(?:萬|元\/月|元)/g);
    if (priceMatches) {
      console.log(`\nPrice patterns found: ${priceMatches.length}`);
      console.log(`First 10: ${priceMatches.slice(0, 10).join(', ')}`);
    } else {
      console.log('\nNo price patterns found in visible text');
      // Print what IS in the text
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      console.log(`Visible lines: ${lines.length}`);
      console.log(`First 20 lines:\n${lines.slice(0, 20).join('\n')}`);
    }

    console.log(`\nAPI calls captured: ${apiCalls.length}`);
    for (const call of apiCalls) {
      console.log(`  [${call.status}] ${call.ct} | ${call.url}`);
    }

  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  await page.close();
  await browser.close();
  console.log('\nDone');
}

main().catch(console.error);
