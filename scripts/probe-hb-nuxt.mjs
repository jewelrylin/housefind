import axios from 'axios';

const client = axios.create({ timeout: 15000, validateStatus: null });
const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
};

async function main() {
  console.log('=== 住商不動產 __NUXT__ Analysis ===\n');

  const resp = await client.get('https://www.hbhousing.com.tw/Search/Result?type=S&city=台北市', { headers });
  const html = resp.data;

  // Extract __NUXT__ - the Nuxt 3 pattern is different
  // Nuxt 3 uses: window.__NUXT__ = { ... } or uses <script> with data-id
  const patterns = [
    // Nuxt 3: window.__NUXT__ = {...}
    { regex: /window\.__NUXT__\s*=\s*({[\s\S]*?});?\s*<\/script>/i, name: 'Nuxt 3 window' },
    // Nuxt 2/3 inline script with JSON
    { regex: /<script[^>]*>([\s\S]{100,100000})<\/script>/gi, name: 'Inline scripts' },
  ];

  // First try to find __NUXT__ with a broader pattern
  let nuxtMatch = html.match(/window\.__NUXT__\s*=\s*(\{[^;]+\})/);
  if (!nuxtMatch) {
    // Try a more flexible pattern
    nuxtMatch = html.match(/__NUXT__\s*=\s*(\{[\s\S]*?\});?\s*</);
  }
  if (!nuxtMatch) {
    // Try appPayload or data attribute in Nuxt 3
    nuxtMatch = html.match(/id="__NUXT_DATA__"[^>]*>\s*(\{[^<]+)\s*<\/script/);
  }
  if (!nuxtMatch) {
    // Try Nuxt 3 JSON script with data-nuxt-data attribute
    nuxtMatch = html.match(/<script[^>]*data-nuxt-data[^>]*>([\s\S]*?)<\/script>/i);
  }
  if (!nuxtMatch) {
    // Try the Nuxt 3 serialized state format
    nuxtMatch = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>\s*([\s\S]*?)\s*<\/script>/i);
  }

  if (nuxtMatch) {
    const raw = nuxtMatch[1];
    console.log(`Found __NUXT__ data! Length: ${raw.length}`);
    console.log(`First 200 chars: ${raw.substring(0, 200)}`);
    
    // Try to parse it
    try {
      const nuxt = JSON.parse(raw);
      console.log(`\nParsed successfully!`);
      console.log(`Top keys: ${Object.keys(nuxt).join(', ')}`);
      
      // Recursively search for listing data
      function deepSearch(obj, path, depth) {
        if (depth > 6 || typeof obj !== 'object' || obj === null) return;
        for (const [k, v] of Object.entries(obj)) {
          const cp = path ? `${path}.${k}` : k;
          if (Array.isArray(v) && v.length > 0 && v.length < 500 && typeof v[0] === 'object') {
            const keys = Object.keys(v[0]);
            // Check if this looks like listing data
            const listingKeys = ['price', 'name', 'title', 'address', 'area', 'layout', 'houseNo', 'totalPrice', 'imgUrl', 'buildingArea', 'floor'];
            const matchCount = keys.filter(k => listingKeys.includes(k)).length;
            if (matchCount >= 2 || (keys.length >= 4 && matchCount >= 1)) {
              console.log(`\n*** LISTING DATA at ${cp}: Array[${v.length}]`);
              console.log(`  Keys (${keys.length}): ${keys.join(', ')}`);
              const sample = JSON.stringify(v[0]);
              console.log(`  Sample: ${sample.substring(0, 600)}`);
            }
          }
          if (typeof v === 'object' && !Array.isArray(v)) {
            deepSearch(v, cp, depth + 1);
          }
        }
      }
      deepSearch(nuxt, '', 0);
      
    } catch (e) {
      console.log(`Parse error: ${e.message}`);
      // Maybe the data is JSON-encoded within a string
      console.log('Trying secondary extraction...');
      // Look for HTML-encoded JSON or nested JSON
      const decoded = raw.replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/\\"/g, '"');
      try {
        const nuxt2 = JSON.parse(decoded);
        console.log(`Secondary parse successful! Keys: ${Object.keys(nuxt2).join(', ')}`);
      } catch (e2) {
        console.log(`Secondary parse also failed: ${e2.message}`);
        // Save to file for manual inspection
        const fs = await import('fs');
        fs.writeFileSync('/tmp/hbhousing-nuxt.txt', raw.substring(0, 50000));
        console.log('Saved first 50000 chars to /tmp/hbhousing-nuxt.txt');
      }
    }
  } else {
    console.log('__NUXT__ not found with any pattern');
    // Look for any large JSON in scripts
    console.log('\nSearching for any large JSON in script tags...');
    const scriptRegex = /<script[^>]*>([\s\S]{200,50000})<\/script>/g;
    let sMatch;
    let scriptIndex = 0;
    while ((sMatch = scriptRegex.exec(html)) !== null && scriptIndex < 10) {
      const content = sMatch[1];
      // Try to find JSON objects
      const jsonRegex = /\{[^{}]*?:[\s\S]{50,20000}\}/g;
      let jMatch;
      while ((jMatch = jsonRegex.exec(content)) !== null) {
        const jsonStr = jMatch[0];
        // Only try parsing if it looks like it could be valid JSON (contains ":")
        if (jsonStr.includes('":"') || jsonStr.includes('":') || jsonStr.includes('":{')) {
          try {
            const parsed = JSON.parse(jsonStr);
            console.log(`Script ${scriptIndex}: Found JSON with keys: ${Object.keys(parsed).slice(0, 15).join(', ')}`);
            const keys = Object.keys(parsed);
            for (const k of keys.slice(0, 10)) {
              const v = parsed[k];
              if (Array.isArray(v)) console.log(`  ${k}: Array[${v.length}]`);
              else if (typeof v === 'object' && v !== null) console.log(`  ${k}: Object {${Object.keys(v).slice(0, 8).join(', ')}}`);
            }
          } catch {}
        }
        // Limit to avoid hanging
        break;
      }
      scriptIndex++;
    }
  }

  console.log('\n=== End ===');
}

main().catch(console.error);
