import axios from 'axios';

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
};

const clients = new Map();

function getClient(withCookies = true) {
  const key = withCookies ? 'with-cookies' : 'no-cookies';
  if (!clients.has(key)) {
    const c = axios.create({
      timeout: 20000,
      headers: { ...BASE_HEADERS },
      maxRedirects: 5,
      validateStatus: null,
    });
    clients.set(key, c);
  }
  return clients.get(key);
}

async function probe591() {
  console.log('\n========== 591 房屋交易 ==========');
  const client = getClient();

  // Step 1: Get cookies from main page
  console.log('\n[Step 1] Visit main page...');
  const home = await client.get('https://rent.591.com.tw/', {
    headers: { Accept: 'text/html,*/*' },
  });
  const cookies = home.headers['set-cookie'] || [];
  console.log(`Status: ${home.status}, Size: ${home.data.length}`);
  console.log(`Cookies (${cookies.length}): ${cookies.map(c => c.split(';')[0]).join(', ')}`);

  // Step 2: Try search API with cookie
  console.log('\n[Step 2] Try search API...');
  try {
    const searchResp = await client.post(
      'https://rent.591.com.tw/home/search/doList',
      new URLSearchParams({ region: '1', firstRow: '0', totalRows: '30' }).toString(),
      {
        headers: {
          ...BASE_HEADERS,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://rent.591.com.tw/',
          'Cookie': cookies.join('; '),
        },
      }
    );
    console.log(`Status: ${searchResp.status}`);
    const data = searchResp.data;
    if (typeof data === 'object' && data !== null) {
      console.log(`Keys: ${Object.keys(data).join(', ')}`);
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        const item = data.data[0];
        console.log(`First item keys: ${Object.keys(item).join(', ')}`);
        console.log(JSON.stringify(item, null, 2).slice(0, 2000));
      } else if (data.data) {
        console.log(`data type: ${typeof data.data}`);
        console.log(JSON.stringify(data).slice(0, 1000));
      }
    } else {
      console.log(`Response: ${JSON.stringify(data).slice(0, 1000)}`);
    }
  } catch (e) {
    console.log(`API Error: ${e.message}`);
    if (e.response) console.log(`Response: ${e.response.status} ${JSON.stringify(e.response.data).slice(0, 500)}`);
  }

  // Step 3: Try SSR list page
  console.log('\n[Step 3] Check SSR page...');
  try {
    const listResp = await client.get('https://rent.591.com.tw/list?region=1', {
      headers: { Accept: 'text/html,*/*', Cookie: cookies.join('; ') },
    });
    const html = listResp.data;
    
    // Look for Vue/Nuxt data
    const patterns = [/window\.__NUXT__\s*=\s*(\{[^;]+\})/g, /window\.__INITIAL_STATE__\s*=\s*(\{[^;]+\})/g];
    for (const pattern of patterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        console.log(`\nFound pattern: ${pattern.source.slice(0, 30)}`);
        try {
          const parsed = JSON.parse(match[1]);
          console.log(`Keys: ${Object.keys(parsed).slice(0, 15).join(', ')}`);
        } catch {}
      }
    }
    
    // Search for listing data in script tags
    const scriptRegex = /<script[^>]*>(\s*window\.[A-Z_]+\s*=\s*)(\{[^;]+\})/g;
    let m;
    while ((m = scriptRegex.exec(html)) !== null) {
      const varName = m[1].trim();
      try {
        const parsed = JSON.parse(m[2]);
        const keys = Object.keys(parsed);
        if (keys.length < 20) {
          console.log(`\nFound: ${varName}, keys: ${keys.join(', ')}`);
        }
      } catch {}
    }
  } catch (e) {
    console.log(`SSR Error: ${e.message}`);
  }
}

async function probeSinyi() {
  console.log('\n========== 信義房屋 ==========');
  const client = getClient();
  
  try {
    console.log('\nVisiting search page...');
    const resp = await client.get('https://www.sinyi.com.tw/search/buy/', {
      headers: { Accept: 'text/html,*/*' },
    });
    console.log(`Status: ${resp.status}, Size: ${resp.data.length}`);

    // Look for Next.js data
    const nextMatch = resp.data.match(/<script id="__NEXT_DATA__"[^>]*type="application\/json">([^<]+)<\/script>/);
    if (nextMatch) {
      console.log('\n=== Next.js data found! ===');
      const data = JSON.parse(nextMatch[1]);
      console.log(`Top keys: ${Object.keys(data).join(', ')}`);
      if (data.props?.pageProps) {
        console.log(`pageProps keys: ${Object.keys(data.props.pageProps).join(', ')}`);
        for (const [k, v] of Object.entries(data.props.pageProps)) {
          if (Array.isArray(v)) {
            console.log(`  ${k}: array[${v.length}]`);
            if (v.length > 0 && typeof v[0] === 'object') {
              console.log(`  first item keys: ${Object.keys(v[0]).join(', ')}`);
              console.log(`  sample: ${JSON.stringify(v[0]).slice(0, 800)}`);
            }
          } else if (typeof v === 'object' && v !== null) {
            console.log(`  ${k}: object keys=${Object.keys(v).slice(0, 15).join(', ')}`);
            // Search nested for arrays
            for (const [k2, v2] of Object.entries(v)) {
              if (Array.isArray(v2) && v2.length > 0) {
                console.log(`    ${k2}: array[${v2.length}]`);
                if (typeof v2[0] === 'object') {
                  console.log(`    keys: ${Object.keys(v2[0]).join(', ')}`);
                  console.log(`    sample: ${JSON.stringify(v2[0]).slice(0, 600)}`);
                }
              }
            }
          }
        }
      }
      
      // Deep search for any array with housing-like data
      function deepSearch(obj, path = '', depth = 0) {
        if (depth > 4 || typeof obj !== 'object' || obj === null) return;
        for (const [k, v] of Object.entries(obj)) {
          const cp = path ? `${path}.${k}` : k;
          if (Array.isArray(v) && v.length > 0 && v.length < 200 && typeof v[0] === 'object') {
            const sampleKeys = Object.keys(v[0]);
            if (sampleKeys.some(key => ['price', 'title', 'address', 'area'].includes(key))) {
              console.log(`\n*** HOUSING DATA at ${cp}: [${v.length}]`);
              console.log(`Keys: ${sampleKeys.join(', ')}`);
              console.log(`Sample: ${JSON.stringify(v[0]).slice(0, 800)}`);
            }
          } else if (typeof v === 'object') {
            deepSearch(v, cp, depth + 1);
          }
        }
      }
      deepSearch(data);
    } else {
      console.log('No Next.js data');
      // Check for window globals
      const globals = resp.data.match(/window\.[_A-Za-z]+\s*=\s*\{/g);
      if (globals) console.log(`Window globals: ${globals.slice(0, 10).join('\n  ')}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

async function probeYungching() {
  console.log('\n========== 永慶房屋 ==========');
  const client = getClient();
  
  try {
    const resp = await client.get('https://www.yungching.com.tw/sale', {
      headers: { Accept: 'text/html,*/*' },
    });
    console.log(`Status: ${resp.status}, Size: ${resp.data.length}`);

    const nextMatch = resp.data.match(/<script id="__NEXT_DATA__"[^>]*type="application\/json">([^<]+)<\/script>/);
    if (nextMatch) {
      console.log('\n=== Next.js data found! ===');
      const data = JSON.parse(nextMatch[1]);
      console.log(`Top keys: ${Object.keys(data).join(', ')}`);
      
      function deepSearch(obj, path = '', depth = 0) {
        if (depth > 4 || typeof obj !== 'object' || obj === null) return;
        for (const [k, v] of Object.entries(obj)) {
          const cp = path ? `${path}.${k}` : k;
          if (Array.isArray(v) && v.length > 0 && v.length < 200 && typeof v[0] === 'object') {
            const sampleKeys = Object.keys(v[0]);
            if (sampleKeys.some(key => ['price', 'title', 'area', 'address', 'name', 'id'].includes(key))) {
              console.log(`\nArray at ${cp}: [${v.length}]`);
              console.log(`Keys: ${sampleKeys.join(', ')}`);
              console.log(`Sample: ${JSON.stringify(v[0]).slice(0, 600)}`);
            }
          } else if (typeof v === 'object') {
            deepSearch(v, cp, depth + 1);
          }
        }
      }
      deepSearch(data);
    } else {
      console.log('No Next.js data');
      const prices = resp.data.match(/[>]\s*[0-9,.]+\s*萬[<]/g);
      console.log(`Price patterns: ${prices ? prices.length : 0}`);
      if (prices) console.log(`Samples: ${prices.slice(0, 5)}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

async function probeRakuya() {
  console.log('\n========== 樂屋網 ==========');
  const client = getClient();
  
  try {
    const resp = await client.get('https://www.rakuya.com.tw/sale', {
      headers: { Accept: 'text/html,*/*' },
    });
    console.log(`Status: ${resp.status}, Size: ${resp.data.length}`);
    
    if (resp.data.includes('Just a moment')) {
      console.log('Blocked by Cloudflare');
      return;
    }
    
    const nextMatch = resp.data.match(/<script id="__NEXT_DATA__"[^>]*type="application\/json">([^<]+)<\/script>/);
    if (nextMatch) {
      console.log('\n=== Next.js data ===');
      const data = JSON.parse(nextMatch[1]);
      console.log(`Top keys: ${Object.keys(data).join(', ')}`);
    }
    
    // Check for Nuxt
    const nuxtMatch = resp.data.match(/window\.__NUXT__\s*=\s*(\{[^;]+\})/);
    if (nuxtMatch) {
      console.log('\n=== Nuxt data ===');
      console.log(nuxtMatch[1].slice(0, 500));
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

async function probeHousefun() {
  console.log('\n========== 好房網 ==========');
  const client = getClient();
  
  try {
    const resp = await client.get('https://www.housefun.com.tw/search/sale', {
      headers: { Accept: 'text/html,*/*' },
    });
    console.log(`Status: ${resp.status}, Size: ${resp.data.length}`);
    
    const nextMatch = resp.data.match(/<script id="__NEXT_DATA__"[^>]*type="application\/json">([^<]+)<\/script>/);
    if (nextMatch) {
      console.log('\n=== Next.js data ===');
      const data = JSON.parse(nextMatch[1]);
      console.log(`Top keys: ${Object.keys(data).join(', ')}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

async function probeHB() {
  console.log('\n========== 住商不動產 ==========');
  const client = getClient();
  
  try {
    const resp = await client.get('https://www.hbhousing.com.tw/', {
      headers: { Accept: 'text/html,*/*' },
    });
    console.log(`Status: ${resp.status}, Size: ${resp.data.length}`);
    
    // Try search page
    try {
      const searchResp = await client.get('https://www.hbhousing.com.tw/Search/Result?type=S', {
        headers: { Accept: 'text/html,*/*' },
      });
      console.log(`Search Status: ${searchResp.status}, Size: ${searchResp.data.length}`);
      
      const nextMatch = searchResp.data.match(/<script id="__NEXT_DATA__"[^>]*type="application\/json">([^<]+)<\/script>/);
      if (nextMatch) {
        console.log('\n=== Next.js data ===');
        const data = JSON.parse(nextMatch[1]);
        console.log(`Top keys: ${Object.keys(data).join(', ')}`);
      }
      
      // Search for embedded JSON
      const jsonPattern = /"HouseList"|"SearchResult"|listingsData/g;
      const matches = searchResp.data.match(jsonPattern);
      if (matches) console.log(`Data patterns found: ${matches}`);
    } catch (e) {
      console.log(`Search Error: ${e.message}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

async function main() {
  console.log('Probing Taiwanese real estate platform APIs...\n');
  console.log(`Time: ${new Date().toISOString()}\n`);
  
  await probe591();
  await probeSinyi();
  await probeYungching();
  await probeRakuya();
  await probeHousefun();
  await probeHB();
  
  console.log('\n========== DONE ==========');
}

main().catch(console.error);
