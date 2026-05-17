import axios from 'axios';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
};
const client = axios.create({ timeout: 20000, maxRedirects: 5, validateStatus: null });

async function main() {
  // Step 1: Get cookies and main page
  const home = await client.get('https://rent.591.com.tw/', { headers: { ...headers, Accept: 'text/html,*/*' } });
  const cookies = (home.headers['set-cookie'] || []).join('; ');
  console.log('Cookies obtained from main page');

  // Step 2: Fetch a JS bundle to find API endpoints
  const listPage = await client.get('https://rent.591.com.tw/list?region=1', {
    headers: { ...headers, Cookie: cookies, Accept: 'text/html,*/*' },
  });
  const html = listPage.data;

  // Find all script src
  const scriptSrcs = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*>/g)];
  console.log(`\nTotal scripts found: ${scriptSrcs.length}`);
  
  // Look for main/entry JS files (these usually contain API URLs)
  const jsFiles = scriptSrcs
    .map(m => m[1])
    .filter(src => src.includes('.js'))
    .filter(src => !src.includes('webpack') && !src.includes('chunk'));
  
  console.log('Potential main JS files:');
  jsFiles.slice(0, 10).forEach(src => console.log(`  ${src}`));

  // Step 3: Fetch a few JS files to find API URLs
  for (const jsSrc of jsFiles.slice(0, 3)) {
    const fullUrl = jsSrc.startsWith('http') ? jsSrc : `https:${jsSrc}`;
    try {
      const jsResp = await client.get(fullUrl, {
        headers: { ...headers, Accept: '*/*', Cookie: cookies, Referer: 'https://rent.591.com.tw/' },
      });
      const js = jsResp.data;
      
      // Search for API-related patterns
      const patterns = [
        /doList|getList|searchList|getSearch|api.*list/gi,
        /["']\/home\/search[^"']*["']/g,
        /["']\/api[^"']*["']/g,
        /fetch\(["']([^"']+)["']\)/g,
      ];
      
      for (const pattern of patterns) {
        const matches = [...js.matchAll(pattern)];
        if (matches.length > 0) {
          console.log(`\nIn ${fullUrl.split('/').pop()}:`);
          const unique = [...new Set(matches.map(m => m[1] || m[0]))];
          unique.slice(0, 15).forEach(m => console.log(`  ${m}`));
        }
      }
      
      // Also check for axios instance configuration
      const baseUrlMatch = js.match(/baseURL["']?\s*[:=]\s*["']([^"']+)["']/);
      if (baseUrlMatch) console.log(`\nBase URL found: ${baseUrlMatch[1]}`);
    } catch (e) {
      console.log(`Error fetching ${fullUrl}: ${e.message}`);
    }
  }

  // Step 4: Try a few more 591 API patterns
  console.log('\n=== Trying various API patterns ===');
  const apiAttempts = [
    { url: 'https://rent.591.com.tw/api/search/list', method: 'GET' },
    { url: 'https://rent.591.com.tw/api/list', method: 'GET' },
    { url: 'https://rent.591.com.tw/search/api/list', method: 'GET' },
    { url: 'https://rent.591.com.tw/Home/Search/RentSearch', method: 'POST', data: { region: '1' } },
  ];

  for (const attempt of apiAttempts) {
    try {
      const resp = attempt.method === 'POST'
        ? await client.post(attempt.url, new URLSearchParams(attempt.data).toString(), {
            headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies, Referer: 'https://rent.591.com.tw/', 'X-Requested-With': 'XMLHttpRequest' },
          })
        : await client.get(attempt.url, {
            headers: { ...headers, Cookie: cookies, Referer: 'https://rent.591.com.tw/' },
          });
      const data = resp.data;
      const isJSON = typeof data === 'object';
      const isHTML = typeof data === 'string' && data.includes('<!DOCTYPE');
      console.log(`${attempt.url}: ${resp.status} ${isJSON ? 'JSON' : isHTML ? 'HTML' : typeof data}`); 
      if (isJSON && data.data) {
        console.log(`  data type: ${typeof data.data}, isArray: ${Array.isArray(data.data)}`);
        if (Array.isArray(data.data) && data.data.length > 0) {
          console.log(`  items: ${data.data.length}, keys: ${Object.keys(data.data[0]).join(', ')}`);
        }
      }
    } catch (e) {
      console.log(`${attempt.url}: ERROR ${e.message}`);
    }
  }
  
  console.log('\n=== Done ===');
}

main().catch(console.error);
