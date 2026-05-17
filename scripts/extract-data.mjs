import * as cheerio from 'cheerio';
import axios from 'axios';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
};

const client = axios.create({ timeout: 20000, maxRedirects: 5, validateStatus: null });

async function extractSinyi() {
  console.log('=== 信義房屋 Listing Data ===\n');
  try {
    const resp = await client.get('https://www.sinyi.com.tw/buy/list', { headers: { ...headers, Accept: 'text/html,*/*' } });
    const html = resp.data;
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*type="application\/json">([^<]+)<\/script>/);
    if (!match) { console.log('No Next.js data found'); return; }
    const data = JSON.parse(match[1]);

    // Try to find the correct path
    function findPath(obj, targetDepth = 3, path = '') {
      if (typeof obj !== 'object' || obj === null) return;
      for (const [k, v] of Object.entries(obj)) {
        const cp = path ? `${path}.${k}` : k;
        if (Array.isArray(v) && v.length > 0 && v.length < 200 && typeof v[0] === 'object') {
          const keys = Object.keys(v[0]);
          if (keys.some(key => ['price', 'totalPrice', 'name', 'address', 'areaBuilding', 'layout'].includes(key))) {
            console.log(`\n*** LISTING DATA at ${cp}: array[${v.length}]`);
            console.log(`Keys: ${keys.join(', ')}`);
            console.log(`Sample:\n${JSON.stringify(v[0], null, 2).slice(0, 2000)}`);
          }
        }
        if (typeof v === 'object') findPath(v, targetDepth, cp);
      }
    }
    findPath(data);
  } catch (e) { console.log(`Error: ${e.message}`); }
}

async function extract591() {
  console.log('\n========= 591 Listing Data =========\n');
  try {
    // Get cookies first
    const homeResp = await client.get('https://rent.591.com.tw/', { headers });
    const cookies = (homeResp.headers['set-cookie'] || []).join('; ');
    
    // Fetch list page with cookies
    const listResp = await client.get('https://rent.591.com.tw/list?region=1', {
      headers: { ...headers, Cookie: cookies, Accept: 'text/html,*/*' },
    });
    const html = listResp.data;
    const $ = cheerio.load(html);
    
    // Look for Vue rendering data
    const scripts = $('script').toArray();
    for (const script of scripts) {
      const content = $(script).html() || '';
      if (content.includes('__NUXT__') || content.includes('__INITIAL_STATE__') || content.includes('window.__')) {
        console.log(`Script with window data:\n${content.slice(0, 1000)}...\n`);
      }
      // Search for JSON data in all scripts
      if (content.includes('"data"') && content.includes('"items"') || content.includes('"list"')) {
        try {
          const jsonMatch = content.match(/\{[\s\S]{100,50000}\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            console.log(`Script has JSON with keys: ${Object.keys(parsed).slice(0, 20).join(', ')}`);
          }
        } catch { }
      }
    }

    // Also look for listing HTML structure
    console.log('\nSearching for listing elements in HTML...');
    const listingSelectors = ['[class*="listItem"]', '[class*="itemInfo"]', '[class*="houseItem"]', '[class*="listInfo"]', 'li.item', 'div.item'];
    for (const sel of listingSelectors) {
      const elems = $(sel).slice(0, 2);
      if (elems.length > 0) {
        console.log(`\nSelector "${sel}": ${elems.length} found`);
        console.log(`First element HTML:\n${$.html(elems.first()).slice(0, 500)}`);
      }
    }

    // Try sale.591 as well
    console.log('\n--- Sale 591 ---');
    const saleResp = await client.get('https://sale.591.com.tw/list?region=1', {
      headers: { ...headers, Accept: 'text/html,*/*' },
    });
    const saleHtml = saleResp.data;
    console.log(`Sale page size: ${saleHtml.length} bytes`);
    
    // Find embedded data
    const windowData = saleHtml.match(/window\.__[A-Z_]+__\s*=\s*(\{[^;]+\})/);
    if (windowData) {
      console.log(`Window data found: ${windowData[1].slice(0, 500)}`);
    }

    // Try the API endpoint with device-id
    console.log('\n--- Trying API with device-id ---');
    const deviceId = 'd' + Date.now();
    try {
      const apiResp = await client.post(
        'https://rent.591.com.tw/home/search/doList',
        new URLSearchParams({ region: '1', firstRow: '0', totalRows: '30' }).toString(),
        {
          headers: {
            ...headers,
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://rent.591.com.tw/list?region=1',
            'Cookie': cookies,
            'device-id': deviceId,
          },
        }
      );
      console.log(`API Status: ${apiResp.status}`);
      const d = apiResp.data;
      console.log(`Response type: ${typeof d}, isHTML: ${typeof d === 'string' && d.includes('<html')}`);
      if (typeof d === 'object') console.log(`Keys: ${Object.keys(d).join(', ')}`);
      else console.log(`Data: ${String(d).slice(0, 500)}`);
    } catch (e) {
      console.log(`API Error: ${e.message}`);
    }

  } catch (e) { console.log(`Error: ${e.message}`); }
}

async function extractHB() {
  console.log('\n========= 住商不動產 =========\n');
  try {
    const resp = await client.get('https://www.hbhousing.com.tw/Search/Result?type=S', { headers });
    const $ = cheerio.load(resp.data);
    
    // Check for listing items
    console.log('Common listing selectors:');
    for (const sel of ['[class*="item"]', '[class*="list"]', '[class*="card"]', '[class*="box"]', 'li', 'tr', '.item', '.list-item']) {
      const count = $(sel).length;
      if (count > 1 && count < 200) {
        const firstText = $(sel).first().text().trim().slice(0, 100);
        if (firstText.length > 5) {
          console.log(`  ${sel}: ${count} items, text: "${firstText}"`);
        }
      }
    }

    // Look for links
    console.log('\nListing links (first 5):');
    $('a[href*="Detail"], a[href*="detail"]').slice(0, 5).each((i, el) => {
      console.log(`  ${$(el).attr('href')} -> ${$(el).text().trim().slice(0, 100)}`);
    });

    // Find price & listing patterns in text
    const bodyText = $('body').text().replace(/\s+/g, ' ');
    const prices = [...bodyText.matchAll(/(\d[\d,]*)\s*(萬|元\/月|元)/g)].slice(0, 10);
    if (prices.length > 0) {
      console.log('\nPrice samples:');
      prices.forEach(p => console.log(`  ${p[0]}`));
    }
  } catch (e) { console.log(`Error: ${e.message}`); }
}

async function extractYungching() {
  console.log('\n========= 永慶房屋 (Try different URLs) =========\n');
  const urls = [
    'https://www.yungching.com.tw/sale',
    'https://www.yungching.com.tw/buy',
    'https://www.yungching.com.tw/search?type=buy',
    'https://www.yungching.com.tw/Sale/Search',
  ];
  for (const url of urls) {
    try {
      const resp = await client.get(url, { headers });
      const size = (resp.data || '').length || 0;
      console.log(`${url}: ${resp.status}, ${(size/1024).toFixed(0)}KB`);
      
      if (size > 1000 && typeof resp.data === 'string') {
        const match = resp.data.match(/<script id="__NEXT_DATA__"[^>]*type="application\/json">([^<]+)<\/script>/);
        if (match) {
          console.log(`  Next.js data found! Length: ${match[1].length}`);
          const j = JSON.parse(match[1]);
          // Find listing arrays
          function findArrays(obj, path = '', depth = 0) {
            if (depth > 4 || typeof obj !== 'object' || obj === null) return;
            for (const [k, v] of Object.entries(obj)) {
              const cp = path ? `${path}.${k}` : k;
              if (Array.isArray(v) && v.length > 0 && v.length < 200 && typeof v[0] === 'object') {
                const keys = Object.keys(v[0]);
                if (keys.some(key => ['price', 'name', 'title', 'address'].includes(key))) {
                  console.log(`  *** ARRAY at ${cp}: [${v.length}], keys: ${keys.slice(0, 15).join(', ')}`);
                  console.log(`  Sample: ${JSON.stringify(v[0]).slice(0, 800)}`);
                }
              }
              if (typeof v === 'object') findArrays(v, cp, depth + 1);
            }
          }
          findArrays(j);
        } else {
          console.log(`  No Next.js data`);
          // Check for window variables
          const winVars = resp.data.match(/window\.\w+\s*=\s*\{/g);
          if (winVars) console.log(`  Window vars: ${winVars.slice(0, 5).join(', ')}`);
        }
      }
    } catch (e) { console.log(`  Error: ${e.message}`); }
  }
}

async function main() {
  await extractSinyi();
  await extract591();
  await extractHB();
  await extractYungching();
  console.log('\n=== All Done ===');
}

main().catch(console.error);
