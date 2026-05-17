import { chromium } from 'playwright';

async function main() {
  console.log('=== 591 Playwright Deep Probe ===\n');
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  // Test both rent and sale
  const targets = [
    { name: 'rent', url: 'https://rent.591.com.tw/list?region=1' },
    { name: 'rent-home', url: 'https://rent.591.com.tw/' },
    { name: 'sale', url: 'https://sale.591.com.tw/list?region=1' },
  ];

  for (const target of targets) {
    console.log(`\n========== ${target.name} ==========`);
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'zh-TW',
      timezoneId: 'Asia/Taipei',
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    // Intercept all API/XHR calls
    const apiCalls = [];
    const pageErrors = [];
    
    await page.route('**/*', (route) => {
      const url = route.request().url();
      const resourceType = route.request().resourceType();
      if (resourceType === 'xhr' || resourceType === 'fetch' || url.includes('/api/') || url.includes('/search/') || url.endsWith('.js')) {
        apiCalls.push({ url, method: route.request().method(), resourceType });
      }
      route.continue();
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        pageErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => pageErrors.push(err.message));

    try {
      console.log(`Navigating to ${target.url}...`);
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // Wait for network idle or timeout
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000);

      console.log(`\nAPI calls intercepted (${apiCalls.length}):`);
      const jsonEndpoints = apiCalls.filter(c => 
        c.url.includes('api') || c.url.includes('search') || c.url.includes('list')
      );
      for (const call of jsonEndpoints) {
        console.log(`  ${call.method} ${call.url}`);
      }

      // Check page for content
      const html = await page.content();
      console.log(`\nPage title: ${await page.title()}`);
      console.log(`HTML size: ${(html.length/1024).toFixed(1)}KB`);
      
      // Find any embedded data
      const nuxtMatch = html.match(/window\.__NUXT__\s*=\s*(\{[^;]+\})/);
      if (nuxtMatch) {
        console.log('__NUXT__ data found!');
        try {
          const nuxt = JSON.parse(nuxtMatch[1]);
          console.log(`  Top keys: ${Object.keys(nuxt).join(', ')}`);
        } catch(e) {
          console.log(`  Parse error: ${e.message}`);
        }
      }

      const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*type="application\/json">([^<]+)<\/script>/);
      if (nextMatch) {
        console.log('__NEXT_DATA__ found! Size: ${(nextMatch[1].length/1024).toFixed(1)}KB');
        try {
          const data = JSON.parse(nextMatch[1]);
          console.log(`  Top keys: ${Object.keys(data).join(', ')}`);
        } catch(e) {
          console.log(`  Parse error: ${e.message}`);
        }
      }

      // Search for API URLs in JS bundles
      const scriptSrcs = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*>/g)];
      const jsBundles = scriptSrcs.map(m => m[1]).filter(s => s.includes('.js'));
      console.log(`\nJS bundles (${jsBundles.length}):`);
      
      // Try to fetch and analyze a few key bundles
      for (const src of jsBundles.slice(0, 5)) {
        const fullUrl = src.startsWith('http') ? src : `https:${src}`;
        try {
          const resp = await page.request.get(fullUrl);
          const content = await resp.text();
          
          // Look for API-related patterns
          const apiPatterns = [
            /\/home\/search\/\w+/g,
            /\/api\/\w+/g,
            /['"]\/search\/[\w\/]+['"]/g,
            /baseURL\s*[:=]\s*['"]([^'"]+)['"]/g,
            /axios\.(?:get|post|create)/g,
          ];
          
          let found = false;
          for (const pattern of apiPatterns) {
            const matches = [...content.matchAll(pattern)];
            if (matches.length > 0) {
              if (!found) {
                console.log(`\n  Analyzing ${fullUrl.split('/').pop()}...`);
                found = true;
              }
              const unique = [...new Set(matches.map(m => m[1] || m[0]))];
              console.log(`    ${pattern}: ${unique.slice(0, 8).join(', ')}`);
            }
          }
        } catch(e) {
          // Skip bundles that can't be fetched
        }
      }

      console.log(`\nPage errors: ${pageErrors.length}`);
      if (pageErrors.length > 0) {
        pageErrors.slice(0, 5).forEach(e => console.log(`  ${e.slice(0, 200)}`));
      }

    } catch(e) {
      console.log(`Navigation error: ${e.message}`);
    }

    await page.close();
    await context.close();
  }

  await browser.close();
  console.log('\n=== Done ===');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
