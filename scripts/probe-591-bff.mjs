import { chromium } from 'playwright';

async function main() {
  console.log('=== 591 BFF + NUXT Listing Data Extraction ===\n');
  
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

  // 1. Extract listing data from Pinia store
  console.log('=== Pinia Store: rent-list ===');
  const piniaData = await page.evaluate(() => {
    try {
      const pinia = window.__NUXT__?.pinia;
      if (!pinia) return { error: 'No pinia store' };
      
      const rentList = pinia['rent-list'];
      if (!rentList) return { error: 'No rent-list in pinia' };
      
      const result = {};
      
      // Check dataList
      if (rentList.dataList) {
        const rawValue = rentList.dataList._rawValue || rentList.dataList;
        const value = rentList.dataList._value || rentList.dataList;
        
        if (Array.isArray(rawValue)) {
          result.dataListType = 'rawArray';
          result.dataListLength = rawValue.length;
          if (rawValue.length > 0) {
            result.sampleKeys = Object.keys(rawValue[0]).slice(0, 30);
            result.sampleItem = JSON.stringify(rawValue[0]).slice(0, 800);
          }
        } else if (typeof rawValue === 'object') {
          result.dataListType = 'rawObject';
          result.dataListKeys = Object.keys(rawValue).slice(0, 20);
          // Check for items/data sub-fields
          for (const k of Object.keys(rawValue)) {
            if (Array.isArray(rawValue[k])) {
              result['raw.' + k + '_length'] = rawValue[k].length;
              if (rawValue[k].length > 0) {
                result['raw.' + k + '_keys'] = Object.keys(rawValue[k][0]).slice(0, 20);
              }
            }
          }
        }
        
        if (Array.isArray(value)) {
          result.valueLength = value.length;
          if (value.length > 0) {
            result.valueKeys = Object.keys(value[0]).slice(0, 30);
          }
        }
      }
      
      // Check for any other keys in rent-list
      result.rentListKeys = Object.keys(rentList).slice(0, 20);
      
      return result;
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log(JSON.stringify(piniaData, null, 2));

  // 2. Try to extract items from NUXT data using findListingArrays approach
  console.log('\n\n=== NUXT data.data items extraction ===');
  const nuxtItems = await page.evaluate(() => {
    const n = window.__NUXT__;
    if (!n) return null;
    
    const results = [];
    
    // Check data.$hash.data.items pattern
    function deepFind(obj, path, depth) {
      if (depth > 3 || typeof obj !== 'object' || obj === null) return;
      
      if (Array.isArray(obj)) {
        if (obj.length > 0 && typeof obj[0] === 'object' && obj.length < 500) {
          const keys = Object.keys(obj[0]);
          // Check housing keywords
          const housingWords = ['title', 'price', 'photo', 'room', 'floor', 'area', 'address', 'kind', 'tags'];
          const matchCount = keys.filter(k => housingWords.some(h => k.toLowerCase().includes(h))).length;
          if (matchCount >= 3) {
            results.push({ path, length: obj.length, keys: keys.slice(0, 25), matchCount });
          }
        }
        return;
      }
      
      for (const [k, v] of Object.entries(obj)) {
        const newPath = path ? path + '.' + k : k;
        deepFind(v, newPath, depth + 1);
      }
    }
    
    if (n.data && typeof n.data === 'object') {
      deepFind(n.data, 'data', 0);
    }
    
    return results;
  });
  
  if (nuxtItems && nuxtItems.length > 0) {
    console.log(`Found ${nuxtItems.length} housing data paths:`);
    for (const item of nuxtItems) {
      console.log(`\n  Path: ${item.path}`);
      console.log(`  Length: ${item.length}`);
      console.log(`  Keys (${item.matchCount} matches): ${item.keys.join(', ')}`);
      
      // Get a sample
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
      }, item.path);
      console.log(`  Sample: ${sample}`);
    }
  }

  // 3. Probe BFF API
  console.log('\n\n=== BFF API Probing ===');
  const bffEndpoints = [
    { name: 'rent-list', url: 'https://bff-house.591.com.tw/v1/rent/list?regionid=1&firstRow=0&totalRows=30' },
    { name: 'rent-search', url: 'https://bff-house.591.com.tw/v1/rent/search?regionid=1' },
    { name: 'rent-filter', url: 'https://bff-house.591.com.tw/v1/rent/filter-condition?regionId=1' },
    { name: 'sale-list', url: 'https://bff-house.591.com.tw/v1/sale/list?regionid=1&firstRow=0&totalRows=30' },
    { name: 'sale-search', url: 'https://bff-house.591.com.tw/v1/sale/search?regionid=1' },
    { name: 'house-list', url: 'https://bff-house.591.com.tw/v1/house/list?regionid=1' },
    { name: 'search-list', url: 'https://bff-house.591.com.tw/v1/search/list?regionid=1' },
  ];
  
  for (const ep of bffEndpoints) {
    try {
      const resp = await page.request.get(ep.url, {
        headers: {
          'Referer': 'https://rent.591.com.tw/list?region=1',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        }
      });
      const text = await resp.text();
      const isJSON = text.trim().startsWith('{') || text.trim().startsWith('[');
      console.log(`\n${ep.name}: GET ${ep.url}`);
      console.log(`  Status: ${resp.status()}, JSON: ${isJSON}`);
      
      if (isJSON && text.length < 10000) {
        console.log(`  ${text.slice(0, 600)}`);
      } else if (isJSON) {
        try {
          const parsed = JSON.parse(text);
          console.log(`  Keys: ${Object.keys(parsed).join(', ')}`);
          if (parsed.data && Array.isArray(parsed.data)) {
            console.log(`  data[]: ${parsed.data.length}`);
            if (parsed.data.length > 0) {
              console.log(`  Item keys: ${Object.keys(parsed.data[0]).slice(0, 20).join(', ')}`);
              console.log(`  Sample: ${JSON.stringify(parsed.data[0]).slice(0, 500)}`);
            }
          }
          if (parsed.total) console.log(`  total: ${parsed.total}`);
          if (parsed.totalRows) console.log(`  totalRows: ${parsed.totalRows}`);
        } catch {}
      } else {
        console.log(`  ${text.slice(0, 200)}`);
      }
    } catch(e) {
      console.log(`\n${ep.name}: ERROR ${e.message}`);
    }
  }

  // 4. Also check what __NUXT__ contains for sale
  console.log('\n\n=== Sale page check ===');
  try {
    const salePage = await context.newPage();
    await salePage.goto('https://sale.591.com.tw/list?region=1', { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    }).catch(() => {});
    await salePage.waitForTimeout(3000);
    
    const saleTitle = await salePage.title().catch(() => 'N/A');
    const saleText = await salePage.evaluate(() => document.body.innerText.slice(0, 500)).catch(() => 'N/A');
    console.log(`Title: ${saleTitle}`);
    console.log(`Body: ${saleText}`);
    await salePage.close();
  } catch(e) {
    console.log(`Error: ${e.message}`);
  }

  await page.close();
  await context.close();
  await browser.close();
  console.log('\n=== Done ===');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
