import { chromium } from 'playwright';

async function main() {
  console.log('=== 591 Rendered Page Deep Analysis ===\n');
  
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

  // Try both rent and different sale URLs
  const pages = [
    { name: 'rent', url: 'https://rent.591.com.tw/list?region=1' },
    { name: 'rent-v2', url: 'https://rent.591.com.tw/?region=1' },
    { name: 'sale-new', url: 'https://sale.591.com.tw/?region=1' },
    { name: 'www', url: 'https://www.591.com.tw/' },
    { name: 'www-sale', url: 'https://www.591.com.tw/sale?region=1' },
  ];

  for (const target of pages) {
    console.log(`\n========== ${target.name}: ${target.url} ==========`);
    
    const page = await context.newPage();
    
    // Collect ALL XHR/fetch responses
    const allResponses = [];
    page.on('response', async (response) => {
      const url = response.url();
      const type = response.headers()['content-type'] || '';
      if (type.includes('json') || type.includes('text')) {
        try {
          const text = await response.text();
          if (text.length < 50000 && (text.startsWith('{') || text.startsWith('['))) {
            allResponses.push({
              url: url,
              status: response.status(),
              type: type,
              size: text.length,
              data: text.slice(0, 500),
            });
          } else if (text.length > 50000) {
            allResponses.push({
              url: url,
              status: response.status(),
              type: type,
              size: text.length,
              data: '[truncated: ' + (text.length/1024).toFixed(1) + 'KB]',
            });
          }
        } catch {}
      }
    });

    try {
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(3000);
      
      // Wait for content to appear
      try {
        await page.waitForFunction(() => {
          const text = document.body.innerText;
          return text.includes('房屋') || text.includes('件') || text.includes('筆');
        }, { timeout: 8000 });
      } catch {
        // No content found
      }
      
      await page.waitForTimeout(1000);

      // 1. Print all JSON responses
      console.log(`\n  JSON responses (${allResponses.length}):`);
      for (const resp of allResponses) {
        console.log(`  [${resp.status}] ${resp.url}`);
        if (resp.data.length < 800) {
          console.log(`    ${resp.data}`);
        } else {
          console.log(`    ${resp.data.slice(0, 300)}...`);
        }
      }

      // 2. Check rendered HTML for listing data
      const html = await page.content();
      
      // Search for JSON-like data in script tags
      const scripts = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('script').forEach(s => {
          const text = s.textContent || s.innerHTML;
          if (text && (text.includes('list') || text.includes('data') || text.includes('房屋') || text.includes('items') || text.includes('listings'))) {
            results.push({
              id: s.id,
              type: s.type,
              length: text.length,
              preview: text.slice(0, 200),
            });
          }
        });
        return results;
      });
      
      console.log(`\n  Data scripts (${scripts.length}):`);
      for (const s of scripts.slice(0, 10)) {
        console.log(`  id=${s.id || 'none'} type=${s.type || 'none'} len=${s.length}`);
        console.log(`    ${s.preview.replace(/\n/g, ' ')}`);
      }

      // 3. Check for listing items in the DOM
      const listings = await page.evaluate(() => {
        const containers = [];
        // Look for any data-* attributes
        const allElements = document.querySelectorAll('[class*="list"], [class*="item"], [class*="card"], [class*="house"], [data-id], [data-houseid]');
        
        allElements.forEach(el => {
          const text = el.textContent.trim();
          const priceMatch = text.match(/(\d[\d,]*)\s*(萬|元)/);
          const containsPrice = priceMatch !== null;
          const containsHouse = text.includes('房') || text.includes('廳') || text.includes('衛');
          
          if (containsPrice || containsHouse) {
            const htmlSnippet = el.innerHTML.slice(0, 300).replace(/</g, '<').replace(/>/g, '>');
            containers.push({
              tag: el.tagName,
              class: el.className.slice(0, 100),
              dataAttrs: JSON.stringify(
                Object.fromEntries(
                  Array.from(el.attributes)
                    .filter(a => a.name.startsWith('data-'))
                    .map(a => [a.name, a.value])
                )
              ),
              text: text.slice(0, 200),
              htmlSnippet,
            });
          }
        });
        return containers;
      });

      console.log(`\n  Listing-like elements (${listings.length}):`);
      for (const l of listings.slice(0, 8)) {
        console.log(`  <${l.tag} class="${l.class}">`);
        if (l.dataAttrs !== '{}') console.log(`    data: ${l.dataAttrs}`);
        console.log(`    text: ${l.text}`);
        console.log(`    html: ${l.htmlSnippet}`);
      }

      // 4. Check page text for listing data
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log(`\n  Body text (first 1500 chars):`);
      console.log(`  ${bodyText.slice(0, 1500).replace(/\n/g, '\n  ')}`);

    } catch(e) {
      console.log(`  Error: ${e.message}`);
    }
    
    await page.close();
  }

  await context.close();
  await browser.close();
  console.log('\n=== Done ===');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
