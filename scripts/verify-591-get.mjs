import axios from 'axios';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
};
const client = axios.create({ timeout: 20000, maxRedirects: 5, validateStatus: null });

async function main() {
  // Get cookies first
  const home = await client.get('https://rent.591.com.tw/', { headers: { ...headers, Accept: 'text/html,*/*' } });
  const cookies = (home.headers['set-cookie'] || []).join('; ');

  console.log('=== Try 591 rsList with GET ===');
  try {
    const resp = await client.get('https://rent.591.com.tw/home/search/rsList', {
      params: { region: '1', firstRow: '0', totalRows: '30' },
      headers: {
        ...headers,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://rent.591.com.tw/list?region=1',
        'Cookie': cookies,
      },
    });
    const d = resp.data;
    console.log(`Status: ${resp.status}`);
    console.log(`Type: ${typeof d}`);
    
    if (typeof d === 'object' && d !== null) {
      console.log(`Keys: ${Object.keys(d).join(', ')}`);
      
      if (d.data && Array.isArray(d.data)) {
        console.log(`\n✅ ${d.data.length} listings!`);
        console.log(`First item keys: ${Object.keys(d.data[0]).join(', ')}`);
        console.log(`Sample: ${JSON.stringify(d.data[0]).slice(0, 1500)}`);
      } else if (d.records) {
        console.log(`records: ${JSON.stringify(d.records).slice(0, 500)}`);
      } else {
        console.log(`Full response: ${JSON.stringify(d).slice(0, 2000)}`);
      }
    } else {
      console.log(`Response (500 chars): ${String(d).slice(0, 500)}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
    if (e.response) console.log(`Status: ${e.response.status}`);
  }

  // Also try rent.591.com.tw/home/search/rsList with different params
  console.log('\n=== Try all 591 API patterns ===');
  const patterns = [
    { url: 'https://rent.591.com.tw/home/search/rsList', params: { region: '1', firstRow: '0', totalRows: '30' } },
    { url: 'https://rent.591.com.tw/home/search/rsList', params: { region: '1' } },
    { url: 'https://rent.591.com.tw/api/search/list', params: {} },
    { url: 'https://rent.591.com.tw/api/list', params: {} },
    { url: 'https://rent.591.com.tw/search', params: { region: '1', format: 'json' } },
  ];
  for (const p of patterns) {
    try {
      const r = await client.get(p.url, { 
        params: p.params,
        headers: { ...headers, 'Cookie': cookies, 'Referer': 'https://rent.591.com.tw/' },
      });
      const d = r.data;
      const isJSON = typeof d === 'object';
      const hasListings = isJSON && ((d.data && Array.isArray(d.data)) || (d.list && Array.isArray(d.list)));
      console.log(`${p.url}: ${r.status} ${isJSON ? 'JSON' : 'HTML'} ${hasListings ? '✅' : ''}`);
      if (isJSON && r.status === 200) {
        const keys = Object.keys(d);
        console.log(`  keys: ${keys.join(', ')}`);
        if (d.data && Array.isArray(d.data)) console.log(`  data[]: ${d.data.length}`);
        if (d.list && Array.isArray(d.list)) console.log(`  list[]: ${d.list.length}`);
        if (d.total) console.log(`  total: ${d.total}`);
        if (d.totalRows) console.log(`  totalRows: ${d.totalRows}`);
      }
    } catch (e) {
      console.log(`${p.url}: ERROR ${e.message}`);
    }
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
