import axios from 'axios';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
};
const client = axios.create({ timeout: 20000, maxRedirects: 5, validateStatus: null });

async function main() {
  // Step 1: Get cookies from main page
  console.log('=== Step 1: Get cookies ===');
  const home = await client.get('https://rent.591.com.tw/', { 
    headers: { ...headers, Accept: 'text/html,*/*' } 
  });
  const cookies = (home.headers['set-cookie'] || []).join('; ');
  const csrfMatch = home.data.match(/name="csrf-token"\s+content="([^"]+)"/);
  const csrfToken = csrfMatch ? csrfMatch[1] : '';
  console.log(`Cookies obtained: ${cookies.slice(0, 80)}...`);
  console.log(`CSRF token from meta: ${csrfToken ? csrfToken.slice(0, 20) + '...' : 'none'}`);

  // Step 2: Try /home/search/rsList
  console.log('\n=== Step 2: Try /home/search/rsList ===');
  try {
    const resp = await client.post(
      'https://rent.591.com.tw/home/search/rsList',
      new URLSearchParams({
        region: '1',
        firstRow: '0',
        totalRows: '30',
      }).toString(),
      {
        headers: {
          ...headers,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://rent.591.com.tw/list?region=1',
          'Cookie': cookies,
          'Origin': 'https://rent.591.com.tw',
        },
      }
    );
    const d = resp.data;
    console.log(`Status: ${resp.status}`);
    console.log(`Type: ${typeof d}`);
    
    if (typeof d === 'object' && d !== null) {
      console.log(`Keys: ${Object.keys(d).join(', ')}`);
      
      if (d.data && Array.isArray(d.data)) {
        console.log(`\n*** SUCCESS! ${d.data.length} listings found! ***`);
        if (d.data.length > 0) {
          console.log(`First item keys: ${Object.keys(d.data[0]).join(', ')}`);
          console.log(`\nFull first item:\n${JSON.stringify(d.data[0], null, 2).slice(0, 2000)}`);
        }
      } else if (d.records && Array.isArray(d.records)) {
        console.log(`\n*** SUCCESS! ${d.records.length} records found! ***`);
        if (d.records.length > 0) {
          console.log(`First item keys: ${Object.keys(d.records[0]).join(', ')}`);
          console.log(`\nFull first item:\n${JSON.stringify(d.records[0], null, 2).slice(0, 2000)}`);
        }
      } else if (d.Result && Array.isArray(d.Result)) {
        console.log(`\n*** SUCCESS! ${d.Result.length} results found! ***`);
        if (d.Result.length > 0) {
          console.log(`First item keys: ${Object.keys(d.Result[0]).join(', ')}`);
        }
      } else {
        console.log(`Data structure:\n${JSON.stringify(d).slice(0, 1500)}`);
      }
    } else if (typeof d === 'string') {
      console.log(`Response (first 500): ${d.slice(0, 500)}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
    if (e.response) console.log(`Status: ${e.response.status}, Data: ${JSON.stringify(e.response.data).slice(0, 500)}`);
  }

  // Step 3: Try with 'firstRow' instead of 'firstRow' (typo variants)
  console.log('\n=== Step 3: Try variant params ===');
  const variants = [
    { firstRow: '0', totalRows: '30' },
    { first_row: '0', total_rows: '30' },
    { page: '1', pageSize: '30' },
    { offset: '0', limit: '30' },
  ];
  for (const v of variants) {
    try {
      const params = { region: '1', ...v };
      const resp = await client.post(
        'https://rent.591.com.tw/home/search/rsList',
        new URLSearchParams(params).toString(),
        {
          headers: {
            ...headers,
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://rent.591.com.tw/list?region=1',
            'Cookie': cookies,
          },
        }
      );
      const d = resp.data;
      const hasData = typeof d === 'object' && d !== null && 
        ((d.data && Array.isArray(d.data)) || (d.records && Array.isArray(d.records)));
      console.log(`Params ${JSON.stringify(v)}: ${resp.status} ${hasData ? '✅ HAS DATA' : '❌ no data'}`);
    } catch (e) {
      console.log(`Params ${JSON.stringify(v)}: ERROR ${e.message}`);
    }
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
