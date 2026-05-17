import { chromium } from 'playwright';

async function main() {
  console.log('=== 591 NUXT + API Deep Probe ===\n');
  
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

  // Only test rent page (the one that works)
  const page = await context.newPage();
  
  // Track ALL network requests
  const allRequests = [];
  page.on('request', request => {
    allRequests.push({
      url: request.url(),
      method: request.method(),
      type: request.resourceType(),
    });
  });

  // Also collect all responses
  const jsonResponses = {};
  page.on('response', async (response) => {
    const url = response.url();
    const type = (response.headers()['content-type'] || '').toLowerCase();
    if (type.includes('json') || url.includes('api.591') || url.includes('/search/')) {
      try {
        const text = await response.text();
        if (text.length < 100000 && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
          jsonResponses[url] = {
            status: response.status(),
            data: JSON.parse(text),
            size: text.length,
          };
        }
      } catch {}
    }
  });

  try {
    console.log('Navigating to rent.591.com.tw/list...');
    await page.goto('https://rent.591.com.tw/list?region=1', { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    }).catch(() => {});
    
    // Wait for content to render
    await page.waitForTimeout(5000);

    // 1. Extract __NUXT__ data
    console.log('\n=== __NUXT__ Data ===');
    const nuxtData = await page.evaluate(() => {
      try {
        return window.__NUXT__;
      } catch { return null; }
    });
    
    if (nuxtData) {
      console.log(`Top keys: ${Object.keys(nuxtData).join(', ')}`);
      
      // Search deeply for listing data
      function findListings(obj, path = '', depth = 0) {
        if (depth > 5 || typeof obj !== 'object' || obj === null) return [];
        const results = [];
        for (const [k, v] of Object.entries(obj)) {
          const cp = path ? `${path}.${k}` : k;
          if (Array.isArray(v) && v.length > 0 && v.length < 1000) {
            if (typeof v[0] === 'object' && v[0] !== null) {
              const keys = Object.keys(v[0]);
              // Check if it looks like housing data
              const hasHousingKeys = ['price', 'title', 'area', 'address', 'room', 'floor', 'kind', 'region', 'section'].some(k => 
                keys.some(key => key.toLowerCase().includes(k))
              );
              if (hasHousingKeys || v.length >= 5) {
                results.push({
                  path: cp,
                  length: v.length,
                  keys: keys.slice(0, 20),
                  sample: JSON.stringify(v[0]).slice(0, 400),
                });
              }
            }
          } else if (typeof v === 'object' && v !== null) {
            results.push(...findListings(v, cp, depth + 1));
          }
        }
        return results;
      }
      
      const listings = findListings(nuxtData);
      console.log(`\nPotential listing arrays found: ${listings.length}`);
      for (const l of listings) {
        console.log(`\n  Path: ${l.path}`);
        console.log(`  Length: ${l.length}`);
        console.log(`  Keys: ${l.keys.join(', ')}`);
        console.log(`  Sample: ${l.sample}`);
      }

      // Also print full structure at depth 1-2
      console.log('\n--- NUUXT Structure (depth 2) ---');
      for (const [k, v] of Object.entries(nuxtData)) {
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          console.log(`${k}: Object`);
          for (const [k2, v2] of Object.entries(v)) {
            if (Array.isArray(v2)) {
              console.log(`  ${k2}: Array[${v2.length}]`);
              if (v2.length > 0 && typeof v2[0] === 'object') {
                console.log(`    First item keys (${Object.keys(v2[0]).length}): ${Object.keys(v2[0]).slice(0, 15).join(', ')}`);
              }
            } else if (typeof v2 === 'object' && v2 !== null) {
              console.log(`  ${k2}: Object(${Object.keys(v2).length})`);
            } else {
              console.log(`  ${k2}: ${typeof v2} = ${String(v2).slice(0, 50)}`);
            }
          }
        } else if (Array.isArray(v)) {
          console.log(`${k}: Array[${v.length}]`);
        } else {
          console.log(`${k}: ${typeof v} = ${String(v).slice(0, 80)}`);
        }
      }

    } else {
      console.log('No __NUXT__ data found');
    }

    // 2. List all API-related requests
    console.log('\n\n=== API Requests ===');
    const apiRequests = allRequests.filter(r => 
      r.url.includes('api') || r.url.includes('search') || r.url.includes('list')
    );
    for (const r of apiRequests) {
      console.log(`${r.method} ${r.type} ${r.url}`);
    }
    
    // 3. List all JSON responses with their keys
    console.log(`\n\n=== JSON Responses (${Object.keys(jsonResponses).length}) ===`);
    for (const [url, resp] of Object.entries(jsonResponses)) {
      const data = resp.data;
      if (typeof data === 'object' && data !== null) {
        const keys = Object.keys(data);
        const hasData = data.data && Array.isArray(data.data);
        const hasRecords = data.records && Array.isArray(data.records);
        console.log(`${url}`);
        console.log(`  Status: ${resp.status}, Keys: ${keys.join(', ')}, Size: ${resp.size}B`);
        if (hasData) console.log(`  data[]: ${data.data.length} items`);
        if (hasRecords) console.log(`  records[]: ${data.records.length} items`);
        if (hasData && data.data.length > 0) {
          console.log(`  First item keys: ${Object.keys(data.data[0]).slice(0, 20).join(', ')}`);
          console.log(`  First item: ${JSON.stringify(data.data[0]).slice(0, 600)}`);
        } else if (hasRecords && data.records.length > 0) {
          console.log(`  First record keys: ${Object.keys(data.records[0]).slice(0, 20).join(', ')}`);
          console.log(`  First record: ${JSON.stringify(data.records[0]).slice(0, 600)}`);
        }
      } else {
        console.log(`${url}: ${typeof data} = ${String(data).slice(0, 200)}`);
      }
    }

    // 4. Try directly calling the api.591.com.tw endpoints
    console.log('\n\n=== Direct API calls to api.591.com.tw ===');
    const apiEndpoints = [
      'https://api.591.com.tw/api/house/list?region_id=1&firstRow=0&totalRows=30',
      'https://api.591.com.tw/api/house/search?region_id=1&firstRow=0&totalRows=30',
      'https://api.591.com.tw/api/list?region=1&firstRow=0&totalRows=30',
      'https://api.591.com.tw/api/house/rent?region_id=1',
      'https://api.591.com.tw/api/house/sale?region_id=1',
      'https://api.591.com.tw/api/search/list?region=1',
      'https://api.591.com.tw/api/v2/house/list?region=1',
      'https://api.591.com.tw/home/search/rsList?region=1',
    ];
    
    for (const endpoint of apiEndpoints) {
      try {
        const resp = await page.request.get(endpoint);
        const text = await resp.text();
        const isJSON = text.startsWith('{') || text.startsWith('[');
        const type = resp.headers()['content-type'] || '';
        console.log(`GET ${endpoint}: ${resp.status()} ${type.slice(0, 30)} ${isJSON ? '✅ JSON' : ''}`);
        if (isJSON && text.length < 5000) {
          console.log(`  ${text.slice(0, 500)}`);
        } else if (isJSON) {
          try {
            const parsed = JSON.parse(text);
            const keys = Object.keys(parsed);
            console.log(`  Keys: ${keys.join(', ')}`);
            if (parsed.data && Array.isArray(parsed.data)) {
              console.log(`  data[]: ${parsed.data.length}`);
              if (parsed.data.length > 0) console.log(`  Sample: ${JSON.stringify(parsed.data[0]).slice(0, 400)}`);
            }
          } catch {}
        }
      } catch(e) {
        console.log(`GET ${endpoint}: ERROR ${e.message}`);
      }
    }

  } catch(e) {
    console.log(`Error: ${e.message}`);
  }

  await page.close();
  await context.close();
  await browser.close();
  console.log('\n=== Done ===');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
