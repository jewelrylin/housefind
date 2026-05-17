import { chromium } from 'playwright';

async function main() {
  console.log('=== 591 Final Deep Probe ===\n');
  
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
  
  // Collect ALL JSON responses
  const jsonResponses = [];
  page.on('response', async (response) => {
    const url = response.url();
    const type = (response.headers()['content-type'] || '').toLowerCase();
    if (type.includes('json') || url.includes('api.591')) {
      try {
        const text = await response.text();
        if (text.length < 100000 && (text.startsWith('{') || text.startsWith('['))) {
          jsonResponses.push({
            url,
            status: response.status(),
            textPreview: text.slice(0, 800),
          });
        }
      } catch {}
    }
  });

  try {
    await page.goto('https://rent.591.com.tw/list?region=1', { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    }).catch(() => {});
    await page.waitForTimeout(6000);

    // 1. Extract __NUXT__ top-level keys and some samples
    console.log('=== __NUXT__ Top-Level Analysis ===');
    const nuxtInfo = await page.evaluate(() => {
      const n = window.__NUXT__;
      if (!n) return { error: 'No Nuxt data' };
      
      const topKeys = Object.keys(n);
      const results = [];
      
      for (const key of topKeys) {
        const val = n[key];
        if (Array.isArray(val)) {
          results.push({ key, type: 'array', length: val.length, short: true });
          if (val.length > 0 && typeof val[0] === 'object') {
            results.push({ key: key + '[]', type: 'sample', length: val.length, sample: JSON.stringify(val[0]).slice(0, 300) });
          }
        } else if (typeof val === 'object' && val !== null) {
          const keys = Object.keys(val);
          results.push({ key, type: 'object', children: keys.slice(0, 30), childCount: keys.length });
          // Check for potentially useful data
          for (const k2 of keys.slice(0, 5)) {
            const v2 = val[k2];
            if (Array.isArray(v2) && v2.length > 0 && typeof v2[0] === 'object') {
              const objKeys = Object.keys(v2[0]);
              results.push({ key: key + '.' + k2, type: 'array', length: v2.length, sampleKeys: objKeys.slice(0, 20) });
              if (objKeys.length < 25) {
                results.push({ key: key + '.' + k2 + '[0]', type: 'sample', sample: JSON.stringify(v2[0]).slice(0, 400) });
              }
            } else if (Array.isArray(v2)) {
              results.push({ key: key + '.' + k2, type: 'array', length: v2.length });
            }
          }
        } else {
          results.push({ key, type: typeof val, value: String(val).slice(0, 80) });
        }
      }
      return results;
    });

    console.log(`\nTop-level keys: ${nuxtInfo.filter(i => i.type !== 'sample').length}`);
    for (const item of nuxtInfo) {
      if (item.type === 'array') {
        console.log(`  ${item.key}: Array[${item.length}]` + (item.sampleKeys ? ` keys=${item.sampleKeys.join(', ')}` : ''));
      } else if (item.type === 'object') {
        console.log(`  ${item.key}: Object(${item.childCount}) keys=${item.children.join(', ')}`);
      } else if (item.type === 'sample') {
        console.log(`  ${item.key}: ${item.sample}`);
      } else {
        console.log(`  ${item.key}: ${item.value}`);
      }
    }

    // 2. Search for listing data specifically
    console.log('\n=== Searching for Listing Data ===');
    const listingSearch = await page.evaluate(() => {
      const n = window.__NUXT__;
      if (!n) return [];
      
      const results = [];
      function search(obj, path, depth) {
        if (depth > 4 || typeof obj !== 'object' || obj === null) return;
        if (Array.isArray(obj)) {
          if (obj.length > 0 && typeof obj[0] === 'object' && obj.length < 500) {
            const keys = Object.keys(obj[0]);
            const housingKeywords = ['price', 'title', 'area', 'room', 'floor', 'kind', 'region', 'address', 'img', 'photo', 'tag', 'name'];
            const matchCount = keys.filter(k => housingKeywords.some(h => k.toLowerCase().includes(h))).length;
            if (matchCount >= 2 || obj.length >= 10) {
              results.push({ path, length: obj.length, keys: keys.slice(0, 20), relevance: matchCount });
            }
          }
        } else {
          for (const [k, v] of Object.entries(obj)) {
            search(v, path ? path + '.' + k : k, depth + 1);
          }
        }
      }
      search(n, '', 0);
      return results;
    });

    console.log(`Found ${listingSearch.length} potential listing arrays:`);
    for (const l of listingSearch) {
      console.log(`  ${l.path}: Array[${l.length}], keys=${l.keys.join(', ')} (relevance: ${l.relevance})`);
    }

    // Get sample of most relevant
    if (listingSearch.length > 0) {
      const best = listingSearch.sort((a, b) => b.relevance - a.relevance)[0];
      console.log(`\nBest match: ${best.path}`);
      const sample = await page.evaluate((path) => {
        const n = window.__NUXT__;
        const keys = path.split('.');
        let current = n;
        for (const k of keys) {
          if (current && typeof current === 'object') current = current[k];
        }
        if (Array.isArray(current) && current.length > 0) {
          return JSON.stringify(current[0]).slice(0, 1000);
        }
        return 'Not found';
      }, best.path);
      console.log(`Sample: ${sample}`);
    }

    // 3. Print all JSON responses captured
    console.log(`\n\n=== All JSON Responses (${jsonResponses.length}) ===`);
    for (const resp of jsonResponses) {
      console.log(`\n[${resp.status}] ${resp.url}`);
      console.log(`  ${resp.textPreview.slice(0, 500)}`);
    }

    // 4. Try direct API calls
    console.log('\n\n=== Direct API Calls ===');
    const endpoints = [
      'https://api.591.com.tw/api/house/list?region_id=1&firstRow=0&totalRows=30',
      'https://api.591.com.tw/api/house/rent?region_id=1&firstRow=0&totalRows=30',
      'https://api.591.com.tw/api/house/search?region_id=1&firstRow=0&totalRows=30',
      'https://api.591.com.tw/api/house/sale?region_id=1',
      'https://api.591.com.tw/api/search/list?region=1',
    ];
    
    for (const ep of endpoints) {
      try {
        const resp = await page.request.get(ep, {
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://rent.591.com.tw/list?region=1',
            'Accept': 'application/json',
          }
        });
        const text = await resp.text();
        const isJSON = text.trim().startsWith('{');
        console.log(`\nGET ${ep}`);
        console.log(`  Status: ${resp.status()}, Content-Type: ${resp.headers()['content-type'] || 'none'}, JSON: ${isJSON}`);
        if (isJSON && text.length < 3000) {
          console.log(`  ${text.slice(0, 600)}`);
        } else if (isJSON) {
          const parsed = JSON.parse(text);
          console.log(`  Keys: ${Object.keys(parsed).join(', ')}`);
          if (parsed.data && Array.isArray(parsed.data)) console.log(`  data[]: ${parsed.data.length}`);
          if (parsed.total) console.log(`  total: ${parsed.total}`);
          if (parsed.totalRows) console.log(`  totalRows: ${parsed.totalRows}`);
        } else {
          console.log(`  ${text.slice(0, 300)}`);
        }
      } catch(e) {
        console.log(`\nGET ${ep}: ERROR ${e.message}`);
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
