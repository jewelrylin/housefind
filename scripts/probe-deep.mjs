import axios from 'axios';

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
};

const client = axios.create({
  timeout: 20000,
  maxRedirects: 5,
  validateStatus: null,
});

async function main() {
  // === 信義房屋 - Extract Next.js data ===
  console.log('=== 信義房屋 Next.js Data ===\n');
  try {
    const resp = await client.get('https://www.sinyi.com.tw/buy/list', {
      headers: { ...BASE_HEADERS, Accept: 'text/html,*/*' },
    });
    const html = resp.data;
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*type="application\/json">([^<]+)<\/script>/);
    if (match) {
      const data = JSON.parse(match[1]);
      
      // Full structure
      function explore(obj, path = '', depth = 0) {
        if (depth > 3 || typeof obj !== 'object' || obj === null) return;
        for (const [k, v] of Object.entries(obj)) {
          const cp = path ? `${path}.${k}` : k;
          if (Array.isArray(v) && v.length > 0) {
            console.log(`${cp}: Array[${v.length}]`);
            if (typeof v[0] === 'object' && v[0] !== null) {
              const keys = Object.keys(v[0]);
              console.log(`  keys[${keys.length}]: ${keys.join(', ')}`);
              if (keys.length > 0 && keys.length < 30) {
                console.log(`  sample: ${JSON.stringify(v[0], null, 2).slice(0, 1000)}`);
              }
            } else if (typeof v[0] !== 'undefined') {
              console.log(`  type: ${typeof v[0]}, values: ${JSON.stringify(v.slice(0, 3))}`);
            }
          } else if (typeof v === 'object' && v !== null) {
            const isNode = path.includes('byPath') || path.includes('__N_SSG') || path.includes('queries');
            if (!isNode) {
              console.log(`${cp}: Object`);
              explore(v, cp, depth + 1);
            }
          }
        }
      }
      explore(data);
    } else {
      console.log('No Next.js data found');
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
  
  // === 591 - Check HTML for API URLs ===
  console.log('\n\n=== 591 - API URLs in HTML ===\n');
  try {
    // First get cookies
    const homeResp = await client.get('https://rent.591.com.tw/', {
      headers: { ...BASE_HEADERS, Accept: 'text/html,*/*' },
    });
    const cookies = (homeResp.headers['set-cookie'] || []).join('; ');
    console.log(`Home cookies: ${cookies.slice(0, 100)}`);
    
    // Get list page
    const listResp = await client.get('https://rent.591.com.tw/list?region=1&firstRow=0&totalRows=30', {
      headers: { ...BASE_HEADERS, Accept: 'text/html,*/*', Cookie: cookies },
    });
    const html = listResp.data;
    
    // Find all API-like URLs in scripts
    const apiPatterns = [
      /["']https?:\/\/[^"']*591[^"']*\/api[^"']*["']/gi,
      /["']https?:\/\/[^"']*591[^"']*\/search[^"']*["']/gi,
      /["']\/home\/search[^"']*["']/gi,
      /doList|getList|searchList|getSearch/gi,
    ];

    for (const pattern of apiPatterns) {
      const matches = html.match(pattern);
      if (matches) {
        const unique = [...new Set(matches.map(m => m.replace(/["']/g, '')))];
        console.log(`Pattern ${pattern}: ${unique.slice(0, 10).join('\n  ')}`);
      }
    }

    // Find window variable data
    const varPatterns = [
      /window\.__NUXT__\s*=\s*(\{[^;]+\})/,
      /window\.__INITIAL_STATE__\s*=\s*(\{[^;]+\})/,
      /window\._*\w+\s*=\s*(\{[^;]+\})/g,
    ];
    for (const pattern of varPatterns) {
      const m = html.match(pattern);
      if (m) {
        const matched = typeof m === 'string' ? [m] : m;
        if (Array.isArray(matched)) {
          for (const item of matched.slice(0, 5)) {
            console.log(`\nFound var pattern at index ${item.index || 0}: ${(item[0] || item).slice(0, 100)}`);
          }
        } else {
          console.log(`\nFound var: ${m.toString().slice(0, 100)}`);
        }
      }
    }

    // Search for Vue/Nuxt serialized data
    const nuxtPattern = /<script>window\.__NUXT__\s*=\s*(\{[^;]+\})<\/script>/;
    const nuxtMatch = html.match(nuxtPattern);
    if (nuxtMatch) {
      console.log('\nNUXT data found!');
      try {
        const nuxtData = JSON.parse(nuxtMatch[1]);
        console.log(`Keys: ${Object.keys(nuxtData).join(', ')}`);
        // Look for listing data
        for (const [k, v] of Object.entries(nuxtData)) {
          if (Array.isArray(v)) {
            console.log(`${k}: Array[${v.length}]`);
            if (v.length > 0 && typeof v[0] === 'object') {
              console.log(`  Keys: ${Object.keys(v[0]).join(', ')}`);
            }
          } else if (typeof v === 'object') {
            console.log(`${k}: Object keys=${Object.keys(v).join(', ')}`);
          }
        }
      } catch (e) {
        console.log(`Parse error: ${e.message}`);
      }
    } else {
      console.log('No NUXT data found');
    }

    // Check for price data in HTML
    const priceItems = html.match(/[\$]?\s*[0-9,]+[\s]*(萬|元)[^<]*/g);
    if (priceItems) console.log(`\nPrice items (${priceItems.length}): ${priceItems.slice(0, 5).join(', ')}`);

  } catch (e) {
    console.log(`591 Error: ${e.message}`);
  }

  // === 住商不動產 - Check HTML structure ===
  console.log('\n\n=== 住商不動產 HTML Structure ===\n');
  try {
    const resp = await client.get('https://www.hbhousing.com.tw/Search/Result?type=S', {
      headers: { ...BASE_HEADERS, Accept: 'text/html,*/*' },
    });
    const html = resp.data;
    
    // Search for listing containers
    const classPatterns = ['searchItem', 'listItem', 'houseItem', 'item', 'card', 'box'];
    for (const cp of classPatterns) {
      const matches = html.match(new RegExp(`class="[^"]*${cp}[^"]*"`, 'gi'));
      if (matches) console.log(`Class "${cp}": ${matches.length} matches, sample: ${matches.slice(0, 3).join(', ')}`);
    }

    // Search for price patterns
    const prices = html.match(/[>]\s*[0-9,.]+\s*(?:萬|元)[^<]*[<]/g);
    if (prices) console.log(`\nPrices: ${prices.slice(0, 10).join(', ')}`);

    // Search for JSON data
    const jsonPatterns = ['HouseList', 'SearchResult', 'listData', 'items'];
    for (const jp of jsonPatterns) {
      if (html.includes(`"${jp}"`)) console.log(`JSON key "${jp}" found`);
    }

    // Look for data in script tags
    const scriptTags = html.match(/<script[^>]*>([^<]+)<\/script>/g);
    if (scriptTags) {
      const dataScripts = scriptTags.filter(s => s.includes('{') && s.includes('}') && s.length < 50000);
      console.log(`\nPotential data scripts: ${dataScripts.length}`);
      for (const script of dataScripts.slice(0, 3)) {
        const content = script.replace(/<\/?script[^>]*>/g, '').trim().slice(0, 300);
        console.log(`Script content: ${content}`);
      }
    }
  } catch (e) {
    console.log(`HB Error: ${e.message}`);
  }  

  // === 好房網 - Try different URLs ===
  console.log('\n\n=== 好房網 URL Patterns ===\n');
  const hfUrls = [
    'https://www.housefun.com.tw/',
    'https://www.housefun.com.tw/search/sale/',
    'https://www.housefun.com.tw/buy/',
    'https://www.housefun.com.tw/rent/',
    'https://www.housefun.com.tw/search/result.php',
    'https://www.housefun.com.tw/house/search',
  ];
  for (const url of hfUrls) {
    try {
      const resp = await client.get(url, { headers: BASE_HEADERS });
      const size = (resp.data || '').length || 0;
      console.log(`${url}: ${resp.status}, ${(size/1024).toFixed(0)}KB`);
    } catch (e) {
      console.log(`${url}: ERROR ${e.message}`);
    }
  }  

  console.log('\n=== Done ===');
}

main().catch(console.error);
