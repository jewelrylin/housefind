import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  viewport: { width: 1440, height: 900 },
  locale: 'zh-TW',
});
const page = await context.newPage();

try {
  await page.goto('https://www.hbhousing.com.tw/renthouse', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(5000);

  const html = await page.content();
  const match = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) { console.log('No __NUXT_DATA__ found'); process.exit(1); }

  const raw = match[1];
  console.log('Raw payload length:', raw.length);

  const payload = JSON.parse(raw);
  console.log('Payload is array of length:', payload.length);

  // Nuxt 3 payload resolver
  function resolveNuxtPayload(arr, idx) {
    const val = arr[idx];
    if (val === null || val === undefined) return val;
    if (typeof val !== 'object') return val;
    if (Array.isArray(val)) {
      return val.map(v => resolveNuxtPayload(arr, v));
    }
    // Object: keys map to indices
    const resolved = {};
    for (const [key, valueIdx] of Object.entries(val)) {
      resolved[key] = resolveNuxtPayload(arr, valueIdx);
    }
    return resolved;
  }

  // Find housing arrays by looking for objects with rentPrice/objName keys
  let housingArray = null;
  let housingArrayIdx = -1;
  for (let i = 0; i < payload.length; i++) {
    const item = payload[i];
    if (Array.isArray(item) && item.length > 0) {
      // Try resolving first item to see if they're housing objects
      const firstVal = item[0];
      if (typeof firstVal !== 'number' && firstVal !== undefined) continue;
      const firstResolved = resolveNuxtPayload(payload, firstVal);
      if (firstResolved && typeof firstResolved === 'object' && !Array.isArray(firstResolved)) {
        const keys = Object.keys(firstResolved);
        const housingKeys = ['rentPrice', 'objName', 'photo1', 'area', 'floor', 'address', 'sn', 'room', 'hall', 'bath'];
        const matchCount = keys.filter(k => housingKeys.includes(k)).length;
        if (matchCount >= 4) {
          housingArray = item;
          housingArrayIdx = i;
          console.log(`\n=== Found housing array at index ${i}, length: ${item.length} ===`);
          console.log('Housing keys found:', keys.filter(k => housingKeys.includes(k)));
          console.log('All keys:', keys);
          break;
        }
      }
    }
  }

  if (!housingArray) {
    console.log('\nNo housing array found with direct matching. Searching all arrays...');
    for (let i = 0; i < payload.length; i++) {
      const item = payload[i];
      if (Array.isArray(item) && item.length >= 5) {
        try {
          const resolved = resolveNuxtPayload(payload, item);
          if (Array.isArray(resolved) && resolved.length > 0 && typeof resolved[0] === 'object' && resolved[0] !== null) {
            const keys = Object.keys(resolved[0]);
            console.log(`Array at ${i}: length=${item.length}, first item keys=${JSON.stringify(keys.slice(0,12))}`);
          }
        } catch(e) {}
      }
    }
    process.exit(1);
  }

  // Resolve all items
  const resolvedItems = [];
  for (let i = 0; i < housingArray.length; i++) {
    try {
      const resolved = resolveNuxtPayload(payload, housingArray[i]);
      if (resolved && typeof resolved === 'object') {
        resolvedItems.push(resolved);
      }
    } catch(e) {
      console.log(`Error resolving item ${i}:`, e.message);
    }
  }
  
  console.log(`\nResolved ${resolvedItems.length} items`);

  // Show first item completely
  console.log('\n=== First item (full) ===');
  console.log(JSON.stringify(resolvedItems[0], null, 2));

  // Show all items summary
  console.log('\n=== All items summary ===');
  resolvedItems.forEach((item, i) => {
    console.log(`\n--- Item ${i + 1} ---`);
    console.log(`  sn: ${item.sn}`);
    console.log(`  name: ${item.objName}`);
    console.log(`  rentPrice: ${item.rentPrice}`);
    console.log(`  area: ${item.area} | room: ${item.room} | hall: ${item.hall} | bath: ${item.bath}`);
    console.log(`  address: ${item.address} | floor: ${item.floor}/${item.floorTotal}`);
    console.log(`  type: ${item.type} | age: ${item.age}`);
    console.log(`  photo: ${(item.photo1 || '').slice(0, 80)}`);
    console.log(`  lat: ${item.lat} | lon: ${item.lon}`);
  });

} catch (e) {
  console.error('Error:', e.message);
}

await browser.close();
