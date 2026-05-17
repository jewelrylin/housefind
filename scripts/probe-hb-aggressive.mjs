import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
  console.log('=== 住商不動產 - Aggressive API Probe ===\n');

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
  const responses = [];

  // Capture ALL response bodies
  page.on('response', async (response) => {
    const url = response.url();
    const ct = response.headers()['content-type'] || '';
    const status = response.status();
    
    // Don't capture static assets
    if (url.match(/\.(js|css|png|jpg|gif|svg|ico|woff2?|ttf|eot)$/i)) return;
    
    try {
      const body = await response.text();
      if (body && body.length > 50 && body.length < 200000) {
        responses.push({
          url: url.substring(0, 150),
          status,
          ct: ct.substring(0, 50),
          size: body.length,
          isJSON: ct.includes('json') || (body.startsWith('{') || body.startsWith('[')),
          body: body.substring(0, 2000),
        });
      }
    } catch {}
  });

  try {
    console.log('Navigating...');
    // Use 'commit' to get HTML as fast as possible, then let JS run
    await page.goto('https://www.hbhousing.com.tw/Search/Result?type=S&city=台北市', { 
      waitUntil: 'commit',
      timeout: 10000 
    }).catch(() => {});
    
    // Wait for network idle or timeout
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    console.log('Network idle achieved');
    
    // Extra wait for any late-loading content
    await page.waitForTimeout(2000);

    // Check visible text now
    const text = await page.evaluate(() => document.body?.innerText || '');
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    console.log(`Visible lines: ${lines.length}`);
    
    // Check for prices in visible text
    const priceMatches = text.match(/\d[\d,]*\.?\d*\s*(?:萬|元\/月|元\/坪|萬\/坪)/g);
    if (priceMatches) {
      console.log(`Price patterns in visible text: ${priceMatches.length}`);
      console.log(`First 10: ${priceMatches.slice(0, 10).join(', ')}`);
    } else {
      console.log('No price patterns in visible text');
      // Look for any numbers that could be prices
      const numberMatches = text.match(/\d{4,8}/g);
      if (numberMatches) console.log(`Large numbers (4-8 digits): ${numberMatches.slice(0, 15).join(', ')}`);
    }

    // Try to find Vue reactive data
    const vueData = await page.evaluate(() => {
      const results = {};
      // Check for __NUXT__
      if (typeof window.__NUXT__ !== 'undefined') {
        results.hasNuxt = true;
        const keys = Object.keys(window.__NUXT__);
        results.nuxtKeys = keys;
      }
      // Check __vue_app__
      const appEl = document.querySelector('[data-vue-app]');
      if (appEl) results.hasVueApp = true;
      // Check for Nuxt app instance
      if (typeof window.$nuxt !== 'undefined') results.hasNuxtApp = true;
      // Check for __vue__
      if (typeof window.__vue__ !== 'undefined') results.hasVueGlobal = true;
      return results;
    });
    console.log('\nVue/Nuxt runtime info:', JSON.stringify(vueData));

    // Wait and check periodically
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(1000);
      const txt = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
      const hasData = /萬/.test(txt);
      console.log(`  Second ${i + 1}: hasPrices=${hasData}, textLen=${txt.length}`);
      if (hasData) {
        console.log(`  Text sample: ${txt.substring(0, 300)}`);
        break;
      }
    }

  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  console.log(`\n--- Captured ${responses.length} non-asset responses ---`);
  
  // Filter to show only potential data endpoints
  const dataResponses = responses.filter(r => 
    r.isJSON || r.url.includes('api') || r.url.includes('search') || r.url.includes('Search') || r.url.includes('list') || r.url.includes('List')
  );
  
  console.log(`\nPotential data endpoints (${dataResponses.length}):`);
  for (const r of dataResponses) {
    console.log(`\n[${r.status}] ${r.ct}`);
    console.log(`  URL: ${r.url}`);
    console.log(`  Size: ${r.size} bytes`);
    if (r.isJSON) {
      try {
        const parsed = JSON.parse(r.body);
        const type = typeof parsed;
        if (Array.isArray(parsed)) {
          console.log(`  Array[${parsed.length}]`);
          if (parsed[0]) console.log(`  Item keys: ${Object.keys(parsed[0]).slice(0, 15).join(', ')}`);
        } else if (typeof parsed === 'object') {
          const keys = Object.keys(parsed);
          console.log(`  Object keys: ${keys.join(', ')}`);
          for (const k of keys) {
            const v = parsed[k];
            if (Array.isArray(v)) console.log(`    ${k}: Array[${v.length}]`);
          }
        }
      } catch {}
      console.log(`  Body preview: ${r.body.substring(0, 300)}`);
    } else {
      console.log(`  Body preview: ${r.body.substring(0, 300)}`);
    }
  }

  // Show non-data responses too
  const otherResponses = responses.filter(r => !dataResponses.includes(r));
  if (otherResponses.length > 0) {
    console.log(`\n--- Other responses (${otherResponses.length}) ---`);
    for (const r of otherResponses) {
      console.log(`  [${r.status}] ${r.ct} | ${r.url}`);
      console.log(`    Body: ${r.body.substring(0, 200)}`);
    }
  }

  // Save captured data for inspection
  fs.writeFileSync('/tmp/hbhousing-probe.json', JSON.stringify(responses, null, 2));
  console.log('\nResponses saved to /tmp/hbhousing-probe.json');

  // Take a screenshot
  await page.screenshot({ path: '/tmp/hbhousing-page.png', fullPage: true });
  console.log('Screenshot saved to /tmp/hbhousing-page.png');

  await page.close();
  await browser.close();
  console.log('\n=== Done ===');
}

main().catch(console.error);
