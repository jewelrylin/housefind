import axios from 'axios';

const client = axios.create({ timeout: 10000, validateStatus: null, maxRedirects: 3 });
const BASE = 'https://www.hbhousing.com.tw';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
  'Referer': 'https://www.hbhousing.com.tw/',
};

async function tryAPI(label, url, extraHeaders = {}, isPost = false, postData = null) {
  try {
    let resp;
    if (isPost) {
      resp = await client.post(url, postData, {
        headers: { ...HEADERS, ...extraHeaders, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      });
    } else {
      resp = await client.get(url, { headers: { ...HEADERS, ...extraHeaders } });
    }
    const data = resp.data;
    const size = typeof data === 'string' ? data.length : JSON.stringify(data).length;
    const isJSON = typeof data === 'object' || (typeof data === 'string' && (data.startsWith('{') || data.startsWith('[')));
    const isHTML = typeof data === 'string' && data.includes('<html');
    const isBlocked = typeof data === 'string' && (data.includes('Just a moment') || data.includes('cf-browser-verify'));
    
    console.log(`${label}: ${resp.status}, ${(size/1024).toFixed(1)}KB, ${isBlocked ? '🔒' : isHTML ? '📄' : isJSON ? '📦' : '❓'}`);
    
    if (isJSON) {
      const parsed = typeof data === 'object' ? data : JSON.parse(data);
      if (Array.isArray(parsed)) {
        console.log(`  Array[${parsed.length}]`);
        if (parsed.length > 0 && typeof parsed[0] === 'object') {
          console.log(`  Keys: ${Object.keys(parsed[0]).slice(0, 20).join(', ')}`);
          console.log(`  Sample: ${JSON.stringify(parsed[0]).substring(0, 400)}`);
        }
      } else if (typeof parsed === 'object') {
        const keys = Object.keys(parsed);
        console.log(`  Object keys: ${keys.join(', ')}`);
        for (const k of keys) {
          const v = parsed[k];
          if (Array.isArray(v)) console.log(`    ${k}: Array[${v.length}]`);
          else if (typeof v === 'object' && v !== null) console.log(`    ${k}: Object {${Object.keys(v).join(', ')}}`);
          else console.log(`    ${k}: ${typeof v} = ${String(v).substring(0, 50)}`);
        }
      }
    }
    return resp;
  } catch (e) {
    console.log(`${label}: ERROR ${e.message}`);
    return null;
  }
}

async function main() {
  console.log('=== 住商不動產 - API Endpoint Probe ===\n');

  // First get cookies
  const homeResp = await client.get(BASE, { headers: HEADERS });
  const cookies = (homeResp.headers['set-cookie'] || []).join('; ');
  const cookiesWithRef = { ...HEADERS, Cookie: cookies };

  console.log(`Home status: ${homeResp.status}, cookies: ${cookies.substring(0, 80)}\n`);

  // 1. Try different search URL patterns
  console.log('--- Search Page URLs ---');
  await tryAPI('Search Result (URL-encoded city)', 'https://www.hbhousing.com.tw/Search/Result?type=S&city=%E5%8F%B0%E5%8C%97%E5%B8%82', cookiesWithRef);
  await tryAPI('Search Result (numeric city)', 'https://www.hbhousing.com.tw/Search/Result?type=S&city=1', cookiesWithRef);
  await tryAPI('Search Result (no city)', 'https://www.hbhousing.com.tw/Search/Result?type=S', cookiesWithRef);
  await tryAPI('Search Result (with keyword)', 'https://www.hbhousing.com.tw/Search/Result?type=S&keyword=%E5%A4%A7%E5%AE%89', cookiesWithRef);

  // 2. Try potential API endpoints
  console.log('\n--- Potential API Endpoints ---');
  await tryAPI('/api/search', `${BASE}/api/search`, cookiesWithRef);
  await tryAPI('/api/list', `${BASE}/api/list`, cookiesWithRef);
  await tryAPI('/api/house', `${BASE}/api/house`, cookiesWithRef);
  await tryAPI('/api/house/list', `${BASE}/api/house/list`, cookiesWithRef);
  await tryAPI('/api/House/List', `${BASE}/api/House/List`, cookiesWithRef);
  await tryAPI('/house/search', `${BASE}/house/search`, cookiesWithRef);
  
  // 3. Try POST endpoints  
  console.log('\n--- POST Endpoints ---');
  await tryAPI('POST /api/search', `${BASE}/api/search`, 
    { ...cookiesWithRef, 'X-Requested-With': 'XMLHttpRequest' }, 
    true, 
    { type: 'S', city: '台北市' }
  );
  await tryAPI('POST /api/house/list', `${BASE}/api/house/list`, 
    { ...cookiesWithRef, 'X-Requested-With': 'XMLHttpRequest' }, 
    true, 
    { type: 'S', city: '台北市', page: '1', size: '20' }
  );

  // 4. Try ihouse subdomain
  console.log('\n--- ihouse Subdomain ---');
  await tryAPI('ihouse api', 'https://ihouse.hbhousing.com.tw/api/search', cookiesWithRef);
  await tryAPI('ihouse list', 'https://ihouse.hbhousing.com.tw/api/list', cookiesWithRef);

  // 5. Try with JSON-LD or RESTful patterns
  console.log('\n--- RESTful Patterns ---');
  await tryAPI('houses', `${BASE}/houses`, cookiesWithRef);
  await tryAPI('buy', `${BASE}/buy`, cookiesWithRef);
  await tryAPI('sale', `${BASE}/sale`, cookiesWithRef);
  await tryAPI('search/content', `${BASE}/search/content`, cookiesWithRef);
  await tryAPI('api/houses/search', `${BASE}/api/houses/search`, cookiesWithRef);

  // 6. Try with X-Requested-With header (XMLHttpRequest)  
  console.log('\n--- With X-Requested-With ---');
  const xhrHeaders = { ...cookiesWithRef, 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json, text/javascript, */*; q=0.01' };
  await tryAPI('Search Result (XHR)', 'https://www.hbhousing.com.tw/Search/Result?type=S&city=%E5%8F%B0%E5%8C%97%E5%B8%82', xhrHeaders);
  await tryAPI('/home/search', `${BASE}/home/search`, xhrHeaders);
  await tryAPI('/Home/Search/doList', `${BASE}/Home/Search/doList`, xhrHeaders);

  console.log('\n=== End ===');
}

main().catch(console.error);
