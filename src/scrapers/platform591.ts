import { BaseScraper } from './base';
import { HousingListing, SearchFilters, PlatformName, PropertyType, TAIWAN_DISTRICTS } from '@/types';
import { runInNewContext } from 'vm';

/**
 * 591房屋交易爬蟲
 * 
 * 資料來源策略（依優先順序）：
 * 1. Nuxt SSR 資料提取 — 從 window.__NUXT__ 或 Pinia store 取得 SSR 內嵌的真實資料
 * 2. 真實 API 端點 (GET rsList + POST doList)
 * 3. Playwright API 攔截
 * 4. Playwright HTML 解析
 * 5. 模擬資料
 * 
 * 注意：591 使用 Nuxt 3 框架，售屋頁面 (sale.591.com.tw) 架構可能完全不同
 */
export class Platform591Scraper extends BaseScraper {
  protected platformName: PlatformName = '591房屋交易';
  protected baseUrl = 'https://rent.591.com.tw';
  private saleBaseUrl = 'https://sale.591.com.tw';
  public enabled = true;

  /**
   * 591 sale 與 rent 的搜尋 URL 結構不同：
   *   sale: https://sale.591.com.tw/?regionid=1&shType=list&firstRow=0
   *   rent: https://rent.591.com.tw/list?region=1
   */
  private buildSearchUrl(filters: SearchFilters): string {
    const isRent = filters.listingType === 'rent';
    const base = isRent ? this.baseUrl : this.saleBaseUrl;
    const region = filters.city ? this.getRegionId(filters.city) : '1';

    let url: string;
    if (isRent) {
      url = `${base}/list?region=${region}`;
    } else {
      url = `${base}/?regionid=${region}&shType=list&firstRow=0`;
    }
    if (filters.minPrice > 0 || filters.maxPrice > 0) {
      url += `&price=${filters.minPrice || ''}-${filters.maxPrice || ''}`;
    }
    if (filters.rooms > 0) url += `&room=${filters.rooms}`;
    if (filters.keyword) url += `&keyword=${encodeURIComponent(filters.keyword)}`;
    return url;
  }

  async search(filters: SearchFilters): Promise<HousingListing[]> {
    // 策略1：從 HTML 中的 Nuxt SSR 資料提取（最快、無須 Playwright，避開瀏覽器競爭）
    try {
      const htmlNuxtListings = await this.tryNuxtFromHTML(filters);
      if (htmlNuxtListings.length > 0) {
        console.log(`[591] HTML Nuxt SSR extraction returned ${htmlNuxtListings.length} listings`);
        return htmlNuxtListings;
      }
    } catch (err) {
      console.error(`[591] HTML Nuxt extraction error:`, (err as Error).message);
    }

    // 策略2：使用 Playwright 提取 __NUXT__（SSR 提取失敗時備援，逾時短）
    try {
      const nuxtListings = await this.tryNuxtExtraction(filters);
      if (nuxtListings.length > 0) {
        console.log(`[591] Playwright Nuxt extraction returned ${nuxtListings.length} listings`);
        return nuxtListings;
      }
    } catch (err) {
      console.error(`[591] Playwright Nuxt error:`, (err as Error).message);
    }

    // 策略3：嘗試真實 API 端點（無需 Playwright，GET 與 POST 並行）
    const apiListings = await Promise.any([
      this.tryGetAPI(filters),
      this.tryPostAPI(filters),
    ]).catch(() => [] as HousingListing[]);
    if (apiListings.length > 0) return apiListings;

    // 全部失敗，回傳空陣列（不再使用模擬資料以避免誤導使用者）
    return [];
  }

  /**
   * 從 HTML 中的 Nuxt SSR 資料提取房源（主要策略，無需 Playwright）
   * 
   * 591 使用 Nuxt 3 SSR，但 window.__NUXT__ 被包裝成 IIFE：
   *   window.__NUXT__=(function(a,b,c,...){...})(data1,data2,...)
   * 因此無法直接用 JSON.parse，必須透過 Node.js vm 模組執行此 IIFE 來取得資料。
   * 
   * 此方式完全避開 Playwright 瀏覽器競爭問題，僅需 ~3-4 秒。
   */
  private async tryNuxtFromHTML(filters: SearchFilters): Promise<HousingListing[]> {
    const searchUrl = this.buildSearchUrl(filters);

    // 1. 使用 axios 直接抓取 HTML（比 Playwright 快數倍、無瀏覽器競爭）
    const response = await this.client.get(searchUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      validateStatus: (status) => status < 500,
      timeout: 10000,
    });

    const html: string = typeof response.data === 'string' ? response.data : String(response.data);

    // 2. 從 HTML 中提取 window.__NUXT__ 的 IIFE 原始碼
    const idx = html.indexOf('window.__NUXT__=');
    if (idx < 0) return [];

    const iifeStart = idx + 'window.__NUXT__='.length;
    const scriptEnd = html.indexOf('</script>', iifeStart);
    if (scriptEnd < 0) return [];

    const iifeCode = html.substring(iifeStart, scriptEnd).replace(/;\s*$/, '').trim();
    if (!iifeCode.startsWith('(function')) return [];

    // 3. 透過 vm 模組執行 IIFE，取得 Nuxt 資料
    //    注意：591 使用產線打包 (minified bundle)，IIFE 可能參照多種全域物件
    const urlParams = searchUrl.includes('?') ? '?' + searchUrl.split('?')[1] : '';
    const sandbox: Record<string, any> = {
      window: {},
      document: { currentScript: null, createElement: () => ({}) },
      location: { href: searchUrl, search: urlParams, pathname: '/list' },
      navigator: { userAgent: 'Node.js' },
      setTimeout: () => 0,
      clearTimeout: () => {},
      setInterval: () => 0,
      clearInterval: () => {},
      console: { log: () => {}, error: () => {}, warn: () => {} },
      // 常用全域建構子
      Math, Array, Object, String, Number, Boolean, Date, RegExp, JSON,
      Error, TypeError, RangeError, SyntaxError, ReferenceError,
      Symbol, Map, Set, WeakMap, WeakSet, Promise, Proxy,
      parseInt, parseFloat, isNaN, isFinite,
      encodeURI, encodeURIComponent, decodeURI, decodeURIComponent,
      Infinity, NaN, undefined,
    };

    try {
      runInNewContext('window.__NUXT__=' + iifeCode + ';', sandbox, { timeout: 5000 });
    } catch (err) {
      console.error(`[591] VM evaluation error:`, (err as Error).message);
      return [];
    }

    const nuxtData = sandbox.window.__NUXT__;
    if (!nuxtData || typeof nuxtData !== 'object') return [];

    // 4. 從 Nuxt data 尋找房源陣列
    const nuxtItems = this.extractNuxtListings(nuxtData);
    if (!nuxtItems || nuxtItems.length === 0) return [];

    console.log(`[591] HTML Nuxt data found: ${nuxtItems.length} items`);
    return this.parseNuxtItems(nuxtItems, filters);
  }

  /**
   * 從 Nuxt SSR data 中提取房源陣列（在 Node.js 端執行）
   */
  private extractNuxtListings(nuxtData: any): any[] | null {
    // 工具函式：精確辨識 591 房源物件
    const is591HousingObject = (obj: any): boolean => {
      if (typeof obj !== 'object' || obj === null) return false;
      const keys = Object.keys(obj);
      const distinctiveKeys = ['kind_name', 'price_unit', 'photoList', 'floor_name', 'layoutStr', 'regionid', 'sectionid', 'community_name', 'refresh_time', 'area_name'];
      const strictMatch = distinctiveKeys.filter(k => keys.includes(k)).length;
      if (strictMatch >= 4 && keys.includes('title') && keys.includes('price')) return true;
      const basicKeys = ['id', 'area', 'address', 'kind', 'type', 'url', 'room'];
      const basicMatch = basicKeys.filter(k => keys.includes(k)).length;
      if (keys.includes('title') && keys.includes('price') && basicMatch >= 3) return true;
      return false;
    };

    // 深度搜尋符合條件的陣列
    const findArrays = (obj: any, depth = 0): any[][] => {
      if (depth > 8 || typeof obj !== 'object' || obj === null) return [];
      if (Array.isArray(obj)) {
        if (obj.length > 0 && typeof obj[0] === 'object' && is591HousingObject(obj[0])) {
          return [obj];
        }
        return [];
      }
      const results: any[][] = [];
      for (const v of Object.values(obj)) {
        results.push(...findArrays(v, depth + 1));
      }
      return results;
    };

    // 先在 Pinia store 中搜尋
    try {
      const pinia = nuxtData.pinia;
      if (pinia && typeof pinia === 'object') {
        for (const storeKey of Object.keys(pinia)) {
          const store = pinia[storeKey];
          if (!store || typeof store !== 'object') continue;
          
          const listCandidates = ['dataList', 'listData', 'items', 'list', 'dataItems', 'listItems'];
          for (const candidate of listCandidates) {
            const dataList = store[candidate];
            if (!dataList) continue;
            const itemsArray = dataList._value || dataList._rawValue || dataList;
            if (Array.isArray(itemsArray) && itemsArray.length > 0 && is591HousingObject(itemsArray[0])) {
              return itemsArray.slice(0, 60);
            }
          }
        }
      }
    } catch {}

    // 在 data 區塊中深度搜尋
    try {
      if (nuxtData.data) {
        const arrays = findArrays(nuxtData.data);
        if (arrays.length > 0) {
          arrays.sort((a, b) => b.length - a.length);
          return arrays[0].slice(0, 60);
        }
      }
    } catch {}

    // 在全域物件中深度搜尋
    try {
      const arrays = findArrays(nuxtData);
      if (arrays.length > 0) {
        arrays.sort((a, b) => b.length - a.length);
        return arrays[0].slice(0, 60);
      }
    } catch {}

    return null;
  }

  /**
   * 使用 Playwright 從頁面提取 Nuxt SSR 資料（備援策略，僅在 HTML 提取失敗時使用）
   * 注意：在並行搜尋時 Playwright 可能有資源競爭問題
   */
  private async tryNuxtExtraction(filters: SearchFilters): Promise<HousingListing[]> {
    const searchUrl = this.buildSearchUrl(filters);

    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'zh-TW',
      timezoneId: 'Asia/Taipei',
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 6000 }).catch(() => {});
      // 縮短等候時間以盡快取得資料
      await page.waitForTimeout(1000);

      const nuxtItems = await page.evaluate(() => {
        const n = (window as any).__NUXT__;
        if (!n) return null;

        function is591HousingArray(arr: any[]): boolean {
          if (!Array.isArray(arr) || arr.length === 0) return false;
          const first = arr[0];
          if (typeof first !== 'object' || first === null) return false;
          const keys = Object.keys(first);
          const distinctiveKeys = ['kind_name', 'price_unit', 'photoList', 'floor_name', 'layoutStr', 'regionid', 'sectionid', 'community_name', 'refresh_time', 'area_name'];
          const strictMatch = distinctiveKeys.filter(k => keys.includes(k)).length;
          if (strictMatch >= 4 && keys.includes('title') && keys.includes('price')) return true;
          const basicKeys = ['id', 'area', 'address', 'kind', 'type', 'url', 'room'];
          const basicMatch = basicKeys.filter(k => keys.includes(k)).length;
          if (keys.includes('title') && keys.includes('price') && basicMatch >= 3) return true;
          return false;
        }

        function findArrays(obj: any, depth = 0): any[][] {
          if (depth > 5 || typeof obj !== 'object' || obj === null) return [];
          if (Array.isArray(obj)) {
            if (obj.length > 0 && typeof obj[0] === 'object' && is591HousingArray(obj)) {
              return [obj];
            }
            return [];
          }
          const results: any[][] = [];
          for (const v of Object.values(obj)) {
            results.push(...findArrays(v, depth + 1));
          }
          return results;
        }

        try {
          const pinia = n.pinia;
          if (pinia) {
            for (const sk of Object.keys(pinia)) {
              const store = pinia[sk];
              if (!store) continue;
              for (const c of ['dataList', 'listData', 'items', 'list']) {
                const dl = store[c];
                if (dl) {
                  const arr = dl._value || dl._rawValue || dl;
                  if (is591HousingArray(arr)) return arr.slice(0, 60);
                }
              }
            }
          }
        } catch {}

        try {
          if (n.data) {
            const arrays = findArrays(n.data);
            if (arrays.length > 0) {
              arrays.sort((a, b) => b.length - a.length);
              return arrays[0].slice(0, 60);
            }
          }
        } catch {}

        return null;
      });

      if (!nuxtItems || !Array.isArray(nuxtItems) || nuxtItems.length === 0) return [];
      console.log(`[591] PW Nuxt data: ${nuxtItems.length} items`);
      return this.parseNuxtItems(nuxtItems, filters);

    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }
  }

  /** 解析從 Nuxt SSR 取得的 591 房源資料 */
  private parseNuxtItems(items: any[], filters: SearchFilters): HousingListing[] {
    const listings: HousingListing[] = [];

    items.forEach((item: any, index: number) => {
      try {
        const title = item.title || '';
        if (!title) return;

        // 價格：591 的 price 是字串如 "130,000"，需要清理逗號後轉為數字
        const rawPrice = typeof item.price === 'string'
          ? parseInt(item.price.replace(/,/g, ''), 10)
          : Number(item.price || 0);
        const price = isNaN(rawPrice) ? 0 : rawPrice;
        const priceUnit = item.price_unit || (filters.listingType === 'rent' ? '元/月' : '萬');

        // 地址解析：591 格式為 "中山區-吉林路"，城市需從 regionid 推斷
        const address = item.address || '';
        const city = this.getCityFromRegion(item.regionid) || filters.city || '';
        const district = this.extractDistrict(address, item.sectionid) || '';
        const fullLocation = [city, district, address.replace(/^[^-]+-/, '')].filter(Boolean).join(' ');

        // 坪數
        const size = Number(item.area || item.ping || 0);

        // 格局字串 (e.g., "3房2廳")
        const layoutStr = item.layoutStr || item.layout || item.room_str || '';
        const roomMatch = String(layoutStr).match(/(\d+)\s*房/);
        const livingMatch = String(layoutStr).match(/(\d+)\s*廳/);
        const bathMatch = String(layoutStr).match(/(\d+)\s*衛/);

        // 樓層 (floor_name 格式 "11F/14F")
        const floor = item.floor_name || item.floor || '';

        // 圖片
        const photoList = item.photoList || item.photos || item.images || [];
        const cover = item.cover || '';
        const imageUrl = Array.isArray(photoList) && photoList.length > 0
          ? (typeof photoList[0] === 'string' ? photoList[0] : photoList[0]?.url || cover)
          : cover;
        const images = Array.isArray(photoList)
          ? photoList.map((p: any) => typeof p === 'string' ? p : p.url || '').filter(Boolean)
          : (imageUrl ? [imageUrl] : []);

        // 標籤
        const tags: string[] = [];
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach((t: any) => {
            if (typeof t === 'string') tags.push(t);
            else if (t?.name) tags.push(t.name);
          });
        }
        if (item.is_top || item.is_vip) tags.push('置頂');
        if (item.is_new) tags.push('新上架');
        if (item.is_hurry) tags.push('急租');
        
        // 從 kind_name 判斷房屋類型
        const kindName = item.kind_name || item.role_name || item.type_name || '';
        const propertyType = this.detectPropertyType(kindName, title);

        // 贊助判斷
        const isSponsored = item.is_top || item.is_vip || item.is_ad || item.preferred === 1 ||
          tags.some(t => t.includes('置頂') || t.includes('廣告'));

        // 連結：sale 與 rent 的詳細頁網址不同
        //   sale: https://sale.591.com.tw/home/house/detail/2/<houseid>.html
        //   rent: https://rent.591.com.tw/<id>
        const itemId = item.id || item.houseid || item.post_id || item.houseId || item.detail_id;
        let url = item.url || item.shareUrl || '';
        if (!url && itemId) {
          url = filters.listingType === 'rent'
            ? `https://rent.591.com.tw/${itemId}`
            : `https://sale.591.com.tw/home/house/detail/2/${itemId}.html`;
        }

        listings.push(this.createListing({
          index,
          title,
          price,
          priceUnit,
          pricePerPing: item.price_per ? Number(item.price_per) : undefined,
          location: fullLocation,
          city,
          district,
          address,
          propertyType,
          size,
          rooms: roomMatch ? parseInt(roomMatch[1]) : (item.room || 0),
          livingRooms: livingMatch ? parseInt(livingMatch[1]) : 1,
          bathrooms: bathMatch ? parseInt(bathMatch[1]) : 1,
          floor: floor || undefined,
          listingType: filters.listingType,
          isSponsored,
          url,
          imageUrl: imageUrl || undefined,
          images: images.length > 0 ? images : undefined,
          tags: tags.length > 0 ? tags : undefined,
          postedDays: item.post_day || item.post_days || undefined,
          year: item.build_year ? Number(item.build_year) : undefined,
        }));
      } catch (err) {
        console.error(`[591] Parse Nuxt item error (${index}):`, (err as Error).message);
      }
    });

    return listings;
  }

  /** 從 regionid 推斷城市名稱 */
  private getCityFromRegion(regionid?: number): string {
    const cityMap: Record<number, string> = {
      1: '台北市', 2: '基隆市', 3: '新北市', 4: '桃園市',
      5: '台中市', 6: '台南市', 7: '高雄市', 9: '新竹縣/市',
      10: '苗栗縣', 11: '彰化縣', 12: '南投縣',
      13: '雲林縣', 14: '嘉義縣/市', 15: '屏東縣',
      16: '宜蘭縣', 17: '花蓮縣', 18: '台東縣',
      19: '澎湖縣', 20: '金門縣', 21: '連江縣',
    };
    return regionid ? (cityMap[regionid] || '') : '';
  }

  /** 從 591 的 sectionid 或地址字串提取行政區 */
  private extractDistrict(address: string, sectionid?: number): string {
    // 先從地址提取 "中山區" 這類字串
    const districtMatch = address.match(/[\u4e00-\u9fff]{2,3}[區鄉鎮市]/);
    if (districtMatch) return districtMatch[0];
    return '';
  }

  /**
   * 嘗試使用真實 API 端點 (GET + POST)
   * 591 使用多種 API 端點：
   * - /home/search/rsList (GET) - 舊版 API
   * - /home/search/doList (POST) - 目前主要 API
   */
  private async tryRealAPI(filters: SearchFilters): Promise<HousingListing[]> {
    const methods = [
      () => this.tryGetAPI(filters),
      () => this.tryPostAPI(filters),
    ];

    for (const method of methods) {
      try {
        const listings = await method();
        if (listings.length > 0) return listings;
      } catch {}
    }
    return [];
  }

  /** GET API: /home/search/rsList */
  private async tryGetAPI(filters: SearchFilters): Promise<HousingListing[]> {
    const base = filters.listingType === 'rent' ? this.baseUrl : this.saleBaseUrl;

    await this.fetch(`${base}/`, {
      Accept: 'text/html,application/xhtml+xml,*/*',
    });

    const params: Record<string, string> = {};
    if (filters.city) params.region = this.getRegionId(filters.city);
    params.firstRow = '0';
    params.totalRows = '30';
    if (filters.minPrice > 0 || filters.maxPrice > 0) {
      params.price = `${filters.minPrice || ''}-${filters.maxPrice || ''}`;
    }
    if (filters.rooms > 0) params.room = String(filters.rooms);
    if (filters.keyword) params.keyword = filters.keyword;

    const queryString = new URLSearchParams(params).toString();
    const apiUrl = `${base}/home/search/rsList?${queryString}`;

    const apiResponse = await this.client.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `${base}/list`,
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      },
      validateStatus: (status) => status < 500,
    });

    const items = this.extractItems(apiResponse.data);
    if (items.length === 0) return [];
    return this.parseAPIResponse(items, filters);
  }

  /** POST API: /home/search/doList */
  private async tryPostAPI(filters: SearchFilters): Promise<HousingListing[]> {
    const base = filters.listingType === 'rent' ? this.baseUrl : this.saleBaseUrl;

    await this.fetch(`${base}/`, {
      Accept: 'text/html,application/xhtml+xml,*/*',
    });

    const data: Record<string, string> = {};
    if (filters.city) data.region = this.getRegionId(filters.city);
    data.firstRow = '0';
    data.totalRows = '30';
    if (filters.minPrice > 0 || filters.maxPrice > 0) {
      data.price = `${filters.minPrice || ''}-${filters.maxPrice || ''}`;
    }
    if (filters.rooms > 0) data.room = String(filters.rooms);
    if (filters.keyword) data.keyword = filters.keyword;

    const deviceId = `d${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

    const response = await this.client.post(
      `${base}/home/search/doList`,
      new URLSearchParams(data).toString(),
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: `${base}/list?region=${data.region || '1'}`,
          'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
          'device-id': deviceId,
        },
        validateStatus: (status) => status < 500,
      }
    );

    const items = this.extractItems(response.data);
    if (items.length === 0) return [];
    return this.parseAPIResponse(items, filters);
  }

  /** 從 API 回應中提取房源陣列 */
  private extractItems(data: any): any[] {
    if (typeof data !== 'object' || data === null) return [];

    const candidates = [
      data.data,
      data.records,
      data.list,
      data.items,
      data.Result,
      data.rows,
      data.houseList,
      data.resultList,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length > 0) {
        return candidate;
      }
    }

    for (const v of Object.values(data)) {
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        return v;
      }
    }

    return [];
  }

  /** 解析 591 API 回應 */
  private parseAPIResponse(items: any[], filters: SearchFilters): HousingListing[] {
    const listings: HousingListing[] = [];

    items.forEach((item: any, index: number) => {
      try {
        const title = item.title || item.name || item.houseName || '';
        const price = item.price || item.totalPrice || item.priceFirst || 0;
        const priceUnit = filters.listingType === 'rent' ? '元/月' : '萬';

        const address = item.address || item.location || item.fulladdress || '';
        const { city, district } = this.extractLocation(address);

        const size = item.area || item.ping || item.areaBuilding || item.size || 0;

        const layout = item.layout || item.roomLayout || item.room || '';
        const roomMatch = String(layout).match(/(\d+)\s*房/);
        const livingMatch = String(layout).match(/(\d+)\s*廳/);
        const bathMatch = String(layout).match(/(\d+)\s*衛/);

        const floor = item.floor || item.floorInfo || '';

        const imageUrl = item.imgSrc || item.coverImage || item.pic || item.image || '';
        const imgUrls = item.imgSrcList || item.images || (imageUrl ? [imageUrl] : []);

        const tags: string[] = [];
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach((t: any) => {
            if (typeof t === 'string') tags.push(t);
            else if (t?.name) tags.push(t.name);
          });
        }
        if (item.is_top || item.isvip || item.top) tags.push('置頂');
        if (item.is_new) tags.push('新上架');

        const isSponsored = !!(item.is_top || item.isvip || item.top || item.isad) ||
          tags.some(t => t.includes('置頂') || t.includes('廣告'));

        const link = item.url || item.link || item.shareURL || 
          (item.id ? `https://rent.591.com.tw/list/${item.id}` : '');

        const kind = item.kind || item.type || item.housetype || '';
        const propertyType = this.detectPropertyType(kind, title);

        listings.push(this.createListing({
          index,
          title: title || '591精選房源',
          price: Number(price) || 0,
          priceUnit,
          pricePerPing: item.unitprice || item.uniPrice ? this.parseNumber(String(item.unitprice || item.uniPrice)) : undefined,
          location: address,
          city: city || filters.city || '',
          district,
          address,
          propertyType,
          size: Number(size) || 0,
          rooms: roomMatch ? parseInt(roomMatch[1]) : 0,
          livingRooms: livingMatch ? parseInt(livingMatch[1]) : 1,
          bathrooms: bathMatch ? parseInt(bathMatch[1]) : 1,
          floor: floor || undefined,
          listingType: filters.listingType,
          isSponsored,
          url: link,
          imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
          images: Array.isArray(imgUrls) ? imgUrls.filter(Boolean) : undefined,
          tags: tags.length > 0 ? tags : undefined,
          postedDays: item.postDays || item.postedDays || undefined,
        }));
      } catch (err) {
        console.error(`[591] Parse item error:`, err);
      }
    });

    return listings;
  }

  /**
   * 使用 Playwright 攔截 591 的 XHR API 回應
   */
  private async tryApiInterception(filters: SearchFilters): Promise<HousingListing[]> {
    const searchUrl = this.buildSearchUrl(filters);
    const base = filters.listingType === 'rent' ? this.baseUrl : this.saleBaseUrl;

    const apiPatterns = [
      '/home/search/rsList',
      '/home/search/doList',
      '/home/search/',
      '/api/search',
    ];

    for (const apiPattern of apiPatterns) {
      try {
        const result = await this.interceptSingleApi(base, searchUrl, apiPattern, filters);
        if (result && result.length > 0) {
          return result;
        }
      } catch {}
    }

    return [];
  }

  /** 攔截單一 API 端點 */
  private async interceptSingleApi(
    base: string,
    searchUrl: string,
    apiPattern: string,
    filters: SearchFilters
  ): Promise<HousingListing[] | null> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'zh-TW',
      timezoneId: 'Asia/Taipei',
    });
    const page = await context.newPage();

    try {
      const responsePromise = new Promise<any>((resolve) => {
        page.on('response', async (response) => {
          const url = response.url();
          if (url.includes(apiPattern) && response.status() === 200) {
            try {
              const contentType = response.headers()['content-type'] || '';
              if (contentType.includes('json')) {
                const json = await response.json();
                resolve(json);
              } else {
                const text = await response.text();
                if (text.startsWith('{') || text.startsWith('[')) {
                  resolve(JSON.parse(text));
                }
              }
            } catch {}
          }
        });
      });

      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 12000)
      );

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      const data = await Promise.race([responsePromise, timeoutPromise]);

      if (!data || typeof data !== 'object') return null;
      const items = this.extractItems(data);
      if (items.length === 0) return null;

      return this.parseAPIResponse(items, filters);
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }
  }

  /** 使用 Playwright 瀏覽器自動化獲取資料 */
  private async tryBrowserScraping(filters: SearchFilters): Promise<HousingListing[]> {
    const searchUrl = this.buildSearchUrl(filters);

    try {
      const html = await this.fetchWithBrowser(searchUrl, '[class*="listItem"], [class*="itemInfo"], .vue-list-rent-item');
      return this.parseListings(html, filters);
    } catch (err) {
      console.error(`[591] Browser scraping error:`, (err as Error).message);
      return [];
    }
  }

  parseListings(html: string, filters: SearchFilters): HousingListing[] {
    const $ = this.loadHTML(html);
    const listings: HousingListing[] = [];
    let index = 0;

    const listingSelectors = [
      '.vue-list-rent-item',
      '.vue-list-sale-item',
      '.listInfo-item',
      '[class*="listItem"]',
      '[class*="itemInfo"]',
      '[class*="houseItem"]',
      '.item[data-id]',
      '.item[data-houseid]',
      'li.item',
      'div.item',
      '[class*="searchItem"]',
      '.cards-item',
      '[class*="cardItem"]',
    ];

    for (const selector of listingSelectors) {
      const elements = $(selector);
      if (elements.length === 0) continue;

      elements.each((_, el) => {
        const $el = $(el);

        const isSponsored = $el.find('[class*="top"], [class*="vip"], [class*="ad"]').length > 0
          || $el.find('.tag-vip, .is-top, .highlight').length > 0
          || $el.text().includes('置頂');

        const title = $el.find('.title a, [class*="title"] a, h3 a, a[class*="title"]').text().trim()
          || $el.find('.title, [class*="title"]').first().text().trim()
          || $el.attr('title') || '';

        const priceText = $el.find('.price, [class*="price"], [class*="money"]').text().trim()
          || $el.attr('data-price') || '';
        const price = this.parseNumber(priceText);

        const locationText = $el.find('.location, [class*="location"], .address, [class*="address"]').text().trim();
        const sizeText = $el.find('.area, [class*="area"], .size, [class*="size"], [class*="ping"]').text().trim();
        const size = this.parseNumber(sizeText);

        const layoutText = $el.find('.layout, [class*="layout"], .room, [class*="room"]').text().trim();
        const roomMatch = layoutText.match(/(\d+)\s*房/);
        const bathMatch = layoutText.match(/(\d+)\s*衛/);

        const link = $el.find('a[href]').first().attr('href') || $el.attr('href') || '';
        const fullUrl = link.startsWith('http') ? link : `${this.baseUrl}${link}`;

        const imgUrl = $el.find('img').first().attr('data-original')
          || $el.find('img').first().attr('data-src')
          || $el.find('img').first().attr('src') || '';

        const tags: string[] = [];
        $el.find('.tag, [class*="tag"], .label, [class*="label"], .badge, [class*="badge"]').each((_, t) => {
          const tagText = $(t).text().trim();
          if (tagText) tags.push(tagText);
        });

        if (title || priceText) {
          const { city, district } = this.extractLocation(locationText);
          listings.push(this.createListing({
            index: index++,
            title: title || `591房源 ${index}`,
            price: price || Math.floor(Math.random() * 3000 + 500),
            priceUnit: filters.listingType === 'rent' ? '元/月' : '萬',
            location: locationText,
            city: city || filters.city || '台北市',
            district,
            propertyType: '大樓',
            size: size || Math.floor(Math.random() * 50 + 15),
            rooms: roomMatch ? parseInt(roomMatch[1]) : Math.floor(Math.random() * 3 + 1),
            livingRooms: 1,
            bathrooms: bathMatch ? parseInt(bathMatch[1]) : 1,
            listingType: filters.listingType,
            isSponsored,
            url: fullUrl,
            imageUrl: imgUrl,
            tags: tags.length > 0 ? tags : undefined,
          }));
        }
      });

      if (listings.length > 0) break;
    }

    return listings;
  }

  /** 判斷房屋類型 */
  private detectPropertyType(kind: string, title: string): PropertyType {
    const combined = `${kind} ${title}`;
    if (combined.includes('套房') || combined.includes('套')) return '套房';
    if (combined.includes('透天')) return '整層住家';
    if (combined.includes('別墅')) return '別墅';
    if (combined.includes('公寓')) return '公寓';
    if (combined.includes('華廈')) return '華廈';
    if (combined.includes('店面')) return '店面';
    if (combined.includes('辦公') || combined.includes('商辦')) return '辦公';
    if (combined.includes('土地')) return '土地';
    if (combined.includes('整層住家')) return '大樓';
    if (combined.includes('獨立套房')) return '套房';
    if (combined.includes('分租套房')) return '套房';
    return '大樓';
  }

  private getRegionId(city: string): string {
    const regionMap: Record<string, string> = {
      '台北市': '1', '新北市': '3', '桃園市': '4',
      '台中市': '5', '台南市': '6', '高雄市': '7',
      '基隆市': '2', '新竹市': '9', '新竹縣': '9',
      '苗栗縣': '10', '彰化縣': '11', '南投縣': '12',
      '雲林縣': '13', '嘉義市': '14', '嘉義縣': '14',
      '屏東縣': '15', '宜蘭縣': '16', '花蓮縣': '17',
      '台東縣': '18', '澎湖縣': '19', '金門縣': '20',
      '連江縣': '21',
    };
    return regionMap[city] || '1';
  }

  private getRandomDistrict(city?: string): string {
    if (!city) return '大安區';
    const districts = TAIWAN_DISTRICTS[city];
    if (!districts || districts.length === 0) return '大安區';
    return districts[Math.floor(Math.random() * districts.length)];
  }

  private getMockData(filters: SearchFilters): HousingListing[] {
    const mockListings: HousingListing[] = [];
    const count = 8 + Math.floor(Math.random() * 5);

    for (let i = 0; i < count; i++) {
      const isSponsored = i < 3;
      const basePrice = filters.listingType === 'rent'
        ? 15000 + Math.floor(Math.random() * 35000)
        : 500 + Math.floor(Math.random() * 3000);

      const district = filters.districts[0] || this.getRandomDistrict(filters.city);

      mockListings.push(this.createListing({
        index: i,
        title: `${filters.city || '台北'}精美${['電梯大樓', '公寓', '華廈', '別墅'][Math.floor(Math.random() * 4)]}${isSponsored ? '【置頂推薦】' : ''}`,
        price: isSponsored ? basePrice * 0.85 : basePrice,
        priceUnit: filters.listingType === 'rent' ? '元/月' : '萬',
        location: `${filters.city || '台北市'} ${district} 核心地段`,
        city: filters.city || '台北市',
        district,
        propertyType: (['公寓', '大樓', '華廈', '別墅'] as const)[Math.floor(Math.random() * 4)],
        size: 15 + Math.floor(Math.random() * 50),
        rooms: Math.floor(Math.random() * 4) + 1,
        livingRooms: 1,
        bathrooms: Math.floor(Math.random() * 2) + 1,
        listingType: filters.listingType,
        isSponsored,
        url: `https://www.591.com.tw/search/${i}`,
        imageUrl: `/api/placeholder/house-${i}`,
        tags: isSponsored ? ['置頂廣告'] : ['新上架'],
        floor: `${Math.floor(Math.random() * 12) + 1}/${Math.floor(Math.random() * 3 + 12)}`,
        year: 2000 + Math.floor(Math.random() * 24),
      }));
    }

    return mockListings;
  }
}
