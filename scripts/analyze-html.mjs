import fs from 'fs';
import * as cheerio from 'cheerio';

function analyzePlatform(filePath, name) {
  console.log(`\n=== ${name} ===`);
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html);
    
    // Find price patterns in the raw HTML
    const priceMatches = html.match(/>\s*\d{1,3}[\.\,\d]*\s*(?:萬|元|坪|月|萬\/月)[^<]*</g);
    if (priceMatches) {
      console.log(`Price patterns (${priceMatches.length}):`);
      priceMatches.slice(0, 15).forEach(m => console.log(`  ${m.substring(0, 100).trim()}`));
    }
    
    // Find links that look like housing detail pages
    let listingCount = 0;
    $('a').each((i, el) => {
      if (listingCount >= 8) return false;
      const href = $(el).attr('href') || '';
      const cls = $(el).attr('class') || '';
      if ((href.includes('/detail/') || href.includes('/house/') || href.includes('/item/') || /\/\d{5,}/.test(href)) && cls) {
        const parentClass = $(el).parent().attr('class') || '';
        console.log(`Link: href=${href.substring(0,80)}, class=${cls.substring(0,50)}, parentClass=${parentClass.substring(0,50)}`);
        listingCount++;
      }
    });
    
    if (listingCount === 0) {
      console.log('Searching for listing containers...');
      $('[class*="item"], [class*="card"], [class*="list"]').slice(0, 10).each((i, el) => {
        const cls = $(el).attr('class') || '';
        const tag = el.tagName;
        const text = $(el).text().trim().substring(0, 80);
        const aCount = $(el).find('a').length;
        console.log(`  ${tag}.${cls.substring(0,50)}: text="${text.substring(0,50)}", links=${aCount}`);
      });
    }
    
    // Check for embedded JSON data
    $('script').each((i, el) => {
      const text = $(el).text() || '';
      if ((text.includes('listData') || text.includes('houseList') || text.includes('searchData') || text.includes('__NUXT__') || text.includes('window.__')) && text.length < 50000) {
        console.log(`\nFound data script tag (${text.length} chars):`);
        console.log(text.substring(0, 600));
      }
    });
  } catch(e) {
    console.log('Error:', e.message);
  }
}

analyzePlatform('/tmp/591-rent.html', '591租房網');
analyzePlatform('/tmp/sinyi.html', '信義房屋');
analyzePlatform('/tmp/yungching.html', '永慶房屋');
analyzePlatform('/tmp/housefun.html', '好房網');
analyzePlatform('/tmp/hbhousing.html', '住商不動產');
