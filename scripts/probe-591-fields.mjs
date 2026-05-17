import { chromium } from 'playwright';

async function main() {
  console.log('=== 591 NUXT Field Names ===\n');
  
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

  await page.goto('https://rent.591.com.tw/list?region=1', { 
    waitUntil: 'domcontentloaded', 
    timeout: 15000 
  }).catch(() => {});
  await page.waitForTimeout(5000);

  // Extract a sample item from NUXT data - plain JS for evaluate
  const sampleData = await page.evaluate(() => {
    const n = window.__NUXT__;
    if (!n) return null;

    // Check Pinia stores for items
    if (n.pinia) {
      const storeKeys = Object.keys(n.pinia);
      for (const storeKey of storeKeys) {
        const store = n.pinia[storeKey];
        if (!store) continue;
        
        const candidates = ['dataList', 'listData', 'items'];
        for (const candidate of candidates) {
          const dataList = store[candidate];
          if (dataList) {
            const items = dataList._value || dataList._rawValue || dataList;
            if (Array.isArray(items) && items.length > 0) {
              return JSON.stringify(items[0]);
            }
          }
        }
      }
    }

    // Fallback: deep find
    function findFirstItem(obj, depth) {
      if (depth > 4 || typeof obj !== 'object' || obj === null) return null;
      if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') {
        const keys = Object.keys(obj[0]);
        if (keys.some(k => ['title', 'price', 'id'].includes(k))) {
          return JSON.stringify(obj[0]);
        }
      }
      const vals = Object.values(obj);
      for (const v of vals) {
        const result = findFirstItem(v, depth + 1);
        if (result) return result;
      }
      return null;
    }
    
    if (n.data) return findFirstItem(n.data, 0);
    return null;
  });

  if (sampleData) {
    console.log('Sample listing item:');
    console.log(sampleData);
    
    // Get ALL unique keys across all items
    const allKeys = await page.evaluate(() => {
      const n = window.__NUXT__;
      const keySet = new Set();
      
      function collectKeys(obj, depth) {
        if (depth > 4 || typeof obj !== 'object' || obj === null) return;
        if (Array.isArray(obj)) {
          for (const item of obj) {
            if (typeof item === 'object' && item !== null) {
              Object.keys(item).forEach(k => keySet.add(k));
            }
          }
        } else {
          const vals = Object.values(obj);
          for (const v of vals) {
            collectKeys(v, depth + 1);
          }
        }
      }
      
      if (n.pinia) {
        const storeKeys = Object.keys(n.pinia);
        for (const storeKey of storeKeys) {
          collectKeys(n.pinia[storeKey], 0);
        }
      }
      if (n.data) {
        collectKeys(n.data, 0);
      }
      
      return Array.from(keySet);
    });
    
    console.log('\nAll unique field names (' + allKeys.length + '):');
    console.log(allKeys.join(', '));
  } else {
    console.log('No data found');
  }

  // Also try to get data from the HTML source
  const html = await page.content();
  
  const nuxtMatch = html.match(/<script[^>]*>window\.__NUXT__\s*=\s*(\{[^<]+\})<\/script>/);
  if (nuxtMatch) {
    console.log('\nRaw NUXT size: ' + (nuxtMatch[1].length/1024).toFixed(1) + 'KB');
    
    try {
      const raw = JSON.parse(nuxtMatch[1]);
      
      function explore(obj, path, depth) {
        if (depth > 3 || typeof obj !== 'object' || obj === null) return;
        if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') {
          const sampleKeys = Object.keys(obj[0]);
          if (sampleKeys.length >= 5 && sampleKeys.length <= 30) {
            const housingWords = ['title', 'price', 'area', 'room', 'floor', 'address', 'photo', 'kind'];
            const matchCount = sampleKeys.filter(k => housingWords.some(h => k.toLowerCase().includes(h))).length;
            if (matchCount >= 2) {
              console.log('\nFound listing array at ' + path + ':');
              console.log('  Length: ' + obj.length);
              console.log('  Keys (' + sampleKeys.length + '): ' + sampleKeys.join(', '));
              console.log('  Full first item: ' + JSON.stringify(obj[0]).slice(0, 1500));
            }
          }
        } else if (typeof obj === 'object' && obj !== null) {
          const entries = Object.entries(obj);
          for (const [k, v] of entries) {
            const cp = path ? path + '.' + k : k;
            if (!cp.includes('$f') && !cp.includes('_')) {
              explore(v, cp, depth + 1);
            }
          }
        }
      }
      
      // Explore data
      if (raw.data) {
        const entries = Object.entries(raw.data);
        for (const [k, v] of entries) {
          if (typeof v === 'object') {
            explore(v, 'data.' + k.slice(0, 8) + '...', 0);
          }
        }
      }
      
      // Explore pinia
      if (raw.pinia) {
        const storeKeys = Object.keys(raw.pinia);
        for (const storeKey of storeKeys) {
          const store = raw.pinia[storeKey];
          console.log('\nPinia store: ' + storeKey);
          if (typeof store === 'object' && store !== null) {
            console.log('  Keys: ' + Object.keys(store).join(', '));
            explore(store, 'pinia.' + storeKey, 0);
          }
        }
      }
      
    } catch(e) {
      console.log('Parse error: ' + e.message);
    }
  } else {
    console.log('No __NUXT__ found in raw HTML');
  }

  await page.close();
  await context.close();
  await browser.close();
  console.log('\n=== Done ===');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
