import axios from 'axios';
import * as cheerio from 'cheerio';

const client = axios.create({ timeout: 15000, validateStatus: null });
const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
};

async function main() {
  console.log('=== 住商不動產 Raw HTML Deep Analysis ===');

  // First, get the home page to collect cookies
  const homeResp = await client.get('https://www.hbhousing.com.tw/', { headers });
  const cookies = (homeResp.headers['set-cookie'] || []).join('; ');
  console.log(`Home page cookies: ${cookies.substring(0, 100)}`);

  const resp = await client.get('https://www.hbhousing.com.tw/Search/Result?type=S&city=台北市', { 
    headers: { ...headers, Cookie: cookies } 
  });
  const html = resp.data;
  console.log(`Status: ${resp.status}, Size: ${html.length} bytes`);

  const $ = cheerio.load(html);

  // 1. Look for ANY script with JSON data
  console.log('\n--- All script tag analysis ---');
  $('script').each((i, el) => {
    const text = $(el).html() || '';
    if (text.length > 50) {
      // Check for JSON objects
      const jsonLike = text.match(/\{[^{}]*[:]\s*[\[{"]/);
      if (jsonLike) {
        console.log(`\nScript #${i} (${text.length} chars, starts with "${text.substring(0, 80)}"):`);
        // Try to find any large JSON objects
        const largeJson = text.match(/\{[\s\S]{200,20000}\}/);
        if (largeJson) {
          try {
            const parsed = JSON.parse(largeJson[0]);
            const keys = Object.keys(parsed);
            console.log(`  Has JSON! Top keys: ${keys.join(', ')}`);
            for (const k of keys) {
              const v = parsed[k];
              if (Array.isArray(v)) console.log(`  ${k}: Array[${v.length}]`);
              else if (typeof v === 'object') console.log(`  ${k}: Object with keys ${Object.keys(v).join(', ')}`);
              else console.log(`  ${k}: ${typeof v} = ${String(v).substring(0, 50)}`);
            }
          } catch {}
        }
      }
      
      // Check for specific keywords
      const keywords = ['house', 'list', 'item', 'search', 'data', 'price', 'area', 'address'];
      const found = keywords.filter(k => text.toLowerCase().includes(k));
      if (found.length >= 2 && text.length < 5000) {
        console.log(`\nScript #${i}: Keywords found: ${found.join(', ')}`);
        console.log(`  Content: ${text.substring(0, 300)}`);
      }
    }
  });

  // 2. Look for HTML elements that might contain listing data
  console.log('\n--- HTML Structure Analysis ---');
  
  // Find ALL elements with class names that might indicate listing containers
  const allElements = [];
  $('*').each((_, el) => {
    const cls = $(el).attr('class') || '';
    if (cls) allElements.push(`${el.tagName}.${cls.substring(0, 60)}`);
  });
  
  // Group by unique class patterns
  const classCounts = {};
  for (const e of allElements) {
    const key = e.split('.')[1]; // class part
    if (key && key.length > 3) {
      classCounts[key] = (classCounts[key] || 0) + 1;
    }
  }
  
  // Sort by frequency
  const sorted = Object.entries(classCounts)
    .filter(([k, v]) => v > 1 && v < 100)
    .sort((a, b) => b[1] - a[1]);
  
  console.log('Class frequencies (2-100 occurrences):');
  for (const [cls, count] of sorted.slice(0, 30)) {
    console.log(`  .${cls}: ${count}`);
  }

  // 3. Look for specific listing-related patterns
  console.log('\n--- Specific patterns ---');
  
  // Look for data-* attributes
  const dataAttrs = html.match(/data-[a-zA-Z-]+="[^"]*"/g);
  if (dataAttrs) {
    const unique = [...new Set(dataAttrs)];
    console.log(`Data attributes (${unique.length}):`);
    unique.slice(0, 20).forEach(a => console.log(`  ${a.substring(0, 80)}`));
  }

  // Look for ng-* (Angular), v-* (Vue), :data (Vue bind) patterns
  ['ng-', 'v-', ':data', '@click', 'v-bind', ':src', ':href'].forEach(p => {
    const matches = html.match(new RegExp(`${p}[^=]*="[^"]*"`, 'g'));
    if (matches) console.log(`Pattern "${p}": ${matches.length} matches, sample: ${matches.slice(0, 2).join(', ').substring(0, 100)}`);
  });

  // 4. Look for ANY URL that could be an API endpoint
  console.log('\n--- Potential API URLs in scripts ---');
  const scriptUrls = html.match(/["'](https?:\/\/[^"']*(?:api|search|list|house|property)[^"']*)["']/gi);
  if (scriptUrls) {
    const unique = [...new Set(scriptUrls.map(u => u.replace(/["']/g, '')))];
    console.log(`Found ${unique.length} potential API URLs:`);
    unique.slice(0, 10).forEach(u => console.log(`  ${u}`));
  }

  // 5. Check for Vue.js specific patterns (v-for, v-if, :key)
  console.log('\n--- Vue.js patterns ---');
  ['v-for', 'v-if', 'v-show', ':key', 'v-bind:key'].forEach(p => {
    const matches = html.match(new RegExp(`${p}="[^"]*"`, 'g'));
    if (matches) console.log(`  ${p}: ${matches.length}`);
  });

  // 6. Look for JSON in the final fallback text search
  console.log('\n--- Text search for prices/adresses ---');
  const bodyText = $('body').text();
  // Find numbers followed by 萬 or 元
  const priceRegex = /(\d[\d,.]*\s*(?:萬|元\/月|元\/坪|萬\/坪))/g;
  let priceMatch;
  let priceCount = 0;
  while ((priceMatch = priceRegex.exec(bodyText)) !== null && priceCount < 15) {
    const context = bodyText.substring(Math.max(0, priceMatch.index - 30), priceMatch.index + priceMatch[0].length + 50);
    console.log(`  "${priceMatch[1]}" context: ${context.replace(/\s+/g, ' ').trim()}`);
    priceCount++;
  }
  if (priceCount === 0) console.log('No standard price patterns found');

  // 7. Look for <a> tags with house/detail links
  console.log('\n--- Detail/House links ---');
  $('a[href*="Detail"], a[href*="detail"], a[href*="House"], a[href*="house"]').slice(0, 8).each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim().substring(0, 80);
    console.log(`  ${href} -> "${text}"`);
  });

  // 8. Look for <img> tags that might have house images
  console.log('\n--- Image sources ---');
  $('img[src*="house"], img[src*="House"], img[src*="upload"], img[data-src*="house"]').slice(0, 5).each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    const cls = $(el).attr('class') || '';
    console.log(`  <img class="${cls.substring(0, 40)}" src="${src.substring(0, 80)}" />`);
  });

  console.log('\n=== End of Analysis ===');
}

main().catch(console.error);
