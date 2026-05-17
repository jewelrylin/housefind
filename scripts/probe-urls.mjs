import axios from 'axios';

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
};

const client = axios.create({
  timeout: 15000,
  maxRedirects: 5,
  validateStatus: null,
});

async function probe(label, url, extraHeaders = {}) {
  try {
    const resp = await client.get(url, {
      headers: { ...BASE_HEADERS, ...extraHeaders },
    });
    const size = (resp.data || '').length || 0;
    const isHTML = typeof resp.data === 'string' && resp.data.includes('<html');
    const isJSON = typeof resp.data === 'object';
    const isBlocked = typeof resp.data === 'string' && resp.data.includes('Just a moment');
    
    console.log(`${label}: HTTP ${resp.status}, ${(size/1024).toFixed(0)}KB, ${isBlocked ? '🔒 CLOUDFLARE' : isHTML ? '📄 HTML' : isJSON ? '📦 JSON' : '❓'}`);
    
    if (isJSON && resp.data) {
      const keys = Object.keys(resp.data);
      console.log(`  Keys: ${keys.join(', ')}`);
      if (resp.data.data && Array.isArray(resp.data.data)) {
        console.log(`  Data array: ${resp.data.data.length} items`);
        if (resp.data.data[0]) console.log(`  Item keys: ${Object.keys(resp.data.data[0]).join(', ')}`);
      }
      if (resp.data.list && Array.isArray(resp.data.list)) {
        console.log(`  List array: ${resp.data.list.length} items`);
        if (resp.data.list[0]) console.log(`  Item keys: ${Object.keys(resp.data.list[0]).join(', ')}`);
      }
    }
    
    if (isHTML && !isBlocked && size > 0) {
      // Find embedded data
      const patterns = [
        /__NEXT_DATA__[^>]*>([^<]+)<\/script>/,
        /__NUXT__\s*=\s*(\{[^;]+\})/,
        /__INITIAL_STATE__\s*=\s*(\{[^;]+\})/,
        /\"houseList\"\s*:\s*\[/,
        /\"listData\"\s*:\s*\[/,
      ];
      for (const p of patterns) {
        const m = resp.data.match(p);
        if (m) console.log(`  Pattern found: ${p.source.slice(0, 30)}...`);
      }
    }
    return resp;
  } catch (e) {
    console.log(`${label}: ERROR ${e.message}`);
    return null;
  }
}

async function main() {
  console.log('=== Probing all platform URLs ===\n');
  
  // 591
  console.log('--- 591 ---');
  const home591 = await client.get('https://rent.591.com.tw/', { headers: BASE_HEADERS });
  const cookies = (home591.headers['set-cookie'] || []).join('; ');
  
  await probe('Rent list', 'https://rent.591.com.tw/list?region=1&firstRow=0&totalRows=30');
  await probe('Sale list', 'https://sale.591.com.tw/list?region=1', { Accept: 'text/html,*/*' });
  await probe('Rent SSR', 'https://rent.591.com.tw/?region=1');
  
  // 591 API - try with cookies
  console.log('\n  Trying 591 API with cookies...');
  try {
    const apiResp = await client.post(
      'https://rent.591.com.tw/home/search/doList',
      new URLSearchParams({ region: '1', firstRow: '0', totalRows: '30' }).toString(),
      {
        headers: {
          ...BASE_HEADERS,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://rent.591.com.tw/',
          'Cookie': cookies,
        },
      }
    );
    const d = apiResp.data;
    console.log(`  API: HTTP ${apiResp.status}, type=${typeof d}`);
    if (typeof d === 'object' && d !== null) {
      console.log(`  Keys: ${Object.keys(d).join(', ')}`);
      if (d.data && Array.isArray(d.data)) {
        console.log(`  listings: ${d.data.length}`);
        if (d.data[0]) console.log(`  keys: ${Object.keys(d.data[0]).join(', ')}`);
      }
    } else if (typeof d === 'string') {
      console.log(`  Response: ${d.slice(0, 300)}`);
    }
  } catch (e) {
    console.log(`  API Error: ${e.message}`);
  }
  
  // 信義房屋
  console.log('\n--- 信義房屋 ---');
  await probe('Buy page', 'https://www.sinyi.com.tw/search/buy/');
  await probe('Rent page', 'https://www.sinyi.com.tw/search/rent/');
  await probe('List page', 'https://www.sinyi.com.tw/buy/list');
  await probe('List2', 'https://www.sinyi.com.tw/buy');
  await probe('Api search', 'https://www.sinyi.com.tw/api/Search/List', {
    Accept: 'application/json',
    Referer: 'https://www.sinyi.com.tw/',
  });
  
  // 永慶房屋
  console.log('\n--- 永慶房屋 ---');
  await probe('Sale', 'https://www.yungching.com.tw/sale');
  await probe('Buy list', 'https://www.yungching.com.tw/buy/list');
  await probe('Search', 'https://www.yungching.com.tw/search');
  await probe('Sale area', 'https://www.yungching.com.tw/sale/area');
  
  // 樂屋網
  console.log('\n--- 樂屋網 ---');
  await probe('Sale', 'https://www.rakuya.com.tw/sale');
  await probe('Buy', 'https://www.rakuya.com.tw/buy');
  await probe('Search', 'https://www.rakuya.com.tw/search/sale');
  
  // 好房網
  console.log('\n--- 好房網 ---');
  await probe('Home', 'https://www.housefun.com.tw/');
  await probe('Sale search', 'https://www.housefun.com.tw/search/sale/');
  await probe('Buy', 'https://www.housefun.com.tw/buy/');
  await probe('Rent', 'https://www.housefun.com.tw/rent/');
  
  // 住商不動產
  console.log('\n--- 住商不動產 ---');
  await probe('Search S', 'https://www.hbhousing.com.tw/Search/Result?type=S');
  await probe('Search R', 'https://www.hbhousing.com.tw/Search/Result?type=R');
  await probe('Api search', 'https://www.hbhousing.com.tw/api/search');
  
  console.log('\n=== Done ===');
}

main().catch(console.error);
