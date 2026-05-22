import { BaseScraper } from './base';
import { HousingListing, SearchFilters, PlatformName, PropertyType, TAIWAN_DISTRICTS } from '@/types';

/**
 * 永慶房屋爬蟲
 * 使用 Playwright 瀏覽器自動化處理 SPA 頁面
 * 備援：模擬資料
 */
export class YungchingScraper extends BaseScraper {
  protected platformName: PlatformName = '永慶房屋';
  protected baseUrl = 'https://www.yungching.com.tw';
  public enabled = true;

  async search(filters: SearchFilters): Promise<HousingListing[]> {
    // 嘗試真實 API 串接
    try {
      const apiListings = await this.tryAPIScraping(filters);
      if (apiListings.length > 0) return apiListings;
    } catch (err) {
      console.error(`[永慶房屋] API error:`, err);
    }

    // 嘗試 Playwright 瀏覽器自動化
    try {
      const browserListings = await this.tryBrowserScraping(filters);
      if (browserListings.length > 0) return browserListings;
    } catch (err) {
      console.error(`[永慶房屋] Browser scraping error:`, err);
    }

    return [];
  }

  /**
   * 嘗試使用永慶房屋的搜尋 API（Next.js SSR）
   * 永慶使用 Next.js，可使用 /buy 和 /rent 路徑
   */
  private async tryAPIScraping(filters: SearchFilters): Promise<HousingListing[]> {
    // 平行嘗試多個 URL 路徑（先回傳成功的那一個）
    const paths = [
      { type: filters.listingType === 'rent' ? 'rent' : 'buy', params: `?city=${encodeURIComponent(filters.city || '台北市')}` },
      { type: 'sale', params: '' },
      { type: 'buy', params: '' },
    ];

    const tasks = paths.map(async (path) => {
      const url = `${this.baseUrl}/${path.type}${path.params}`;
      const html = await this.fetch(url, {
        Accept: 'text/html,application/xhtml+xml,*/*',
      });

      const nextListings = this.parseNextJSData(html, filters);
      if (nextListings.length > 0) {
        console.log(`[永慶房屋] Next.js data at /${path.type} returned ${nextListings.length} listings`);
        return nextListings;
      }

      const htmlListings = this.parseListings(html, filters);
      if (htmlListings.length > 0) {
        console.log(`[永慶房屋] HTML parse at /${path.type} returned ${htmlListings.length} listings`);
        return htmlListings;
      }

      throw new Error(`[永慶房屋] /${path.type} no listings`);
    });

    try {
      return await Promise.any(tasks);
    } catch {
      return [];
    }
  }

  /**
   * 從 Next.js __NEXT_DATA__ 解析永慶房屋資料
   */
  private parseNextJSData(html: string, filters: SearchFilters): HousingListing[] {
    const nextData = this.parseNextData(html);
    if (!nextData) return [];

    try {
      let listingsData: any[] | null = null;

      // 嘗試常見路徑
      const searchPaths = [
        ['props', 'pageProps', 'list'],
        ['props', 'pageProps', 'houseList'],
        ['props', 'pageProps', 'data', 'list'],
        ['props', 'pageProps', 'items'],
        ['props', 'pageProps', 'searchResult'],
        ['props', 'pageProps', 'result'],
        ['pageProps', 'list'],
        ['pageProps', 'houseList'],
        ['pageProps', 'items'],
      ];

      for (const path of searchPaths) {
        const data = this.getNestedValue(nextData, path);
        if (Array.isArray(data) && data.length > 0) {
          listingsData = data;
          break;
        }
      }

      // 自動搜尋
      if (!listingsData) {
        const foundArrays = this.findListingArrays(nextData);
        for (const found of foundArrays) {
          if (found.data.length >= 2) {
            listingsData = found.data;
            console.log(`[永慶房屋] Auto-found data at ${found.path}`);
            break;
          }
        }
      }

      if (!listingsData || !Array.isArray(listingsData) || listingsData.length === 0) {
        return [];
      }

      return this.parseAPIItems(listingsData, filters);
    } catch (err) {
      console.error(`[永慶房屋] Next.js parse error:`, err);
      return [];
    }
  }

  /** 解析永慶 API/Next.js 房源項目 */
  private parseAPIItems(items: any[], filters: SearchFilters): HousingListing[] {
    const listings: HousingListing[] = [];

    items.forEach((item: any, index: number) => {
      try {
        const title = item.title || item.name || item.houseName || '';
        const price = item.price || item.totalPrice || item.priceFirst || 0;
        const unit = filters.listingType === 'rent' ? '元/月' : '萬';

        const address = item.address || item.fullAddress || item.location || '';
        const { city, district } = this.extractLocation(address);

        const size = item.area || item.buildingArea || item.ping || item.size || 0;

        const layout = item.layout || item.roomLayout || item.pattern || '';
        const roomMatch = String(layout).match(/(\d+)\s*房/);
        const livingMatch = String(layout).match(/(\d+)\s*廳/);
        const bathMatch = String(layout).match(/(\d+)\s*衛/);

        const floor = item.floor || item.floorInfo || '';
        const imageUrl = item.imgSrc || item.pic || item.image || item.picture || '';

        const tags: string[] = [];
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach((t: any) => {
            if (typeof t === 'string') tags.push(t);
            else if (t?.name) tags.push(t.name);
          });
        }

        const isSponsored = !!(item.is_top || item.isvip || item.top) ||
          tags.some(t => t.includes('置頂') || t.includes('廣告'));

        const link = item.url || item.link || item.detailUrl || '';
        const fullUrl = link.startsWith('http') ? link : `${this.baseUrl}${link.startsWith('/') ? link : '/' + link}`;

        const propertyType = this.detectPropertyType(
          (item.houseType || item.type || item.kind || '') + ' ' + title
        );

        const listing = this.createListing({
          index,
          title: title || `永慶精選物件`,
          price: Number(price) || 0,
          priceUnit: unit,
          pricePerPing: item.unitPrice ? Number(item.unitPrice) : undefined,
          location: address,
          city: city || filters.city || '台北市',
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
          url: fullUrl,
          imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
          tags: tags.length > 0 ? tags : undefined,
          description: item.description || item.commName || undefined,
        });

        listings.push(listing);
      } catch (err) {
        console.error(`[永慶房屋] Parse item error:`, err);
      }
    });

    return listings;
  }

  private async tryBrowserScraping(filters: SearchFilters): Promise<HousingListing[]> {
    // 永慶實際房源頁面位於 buy.yungching.com.tw / rent.yungching.com.tw
    // 使用真實 subdomain 並等待真實 listing card class 出現
    const sub = filters.listingType === 'rent' ? 'rent' : 'buy';
    const url = `https://${sub}.yungching.com.tw/list`;
    try {
      const html = await this.fetchWithBrowser(url, '.yc-ng-buy-house-card:not(.loading)');
      return this.parseListings(html, filters);
    } catch {
      return [];
    }
  }

  /** 判斷房屋類型 */
  private detectPropertyType(text: string): PropertyType {
    const combined = text.toLowerCase();
    if (combined.includes('套房') || combined.includes('套')) return '套房';
    if (combined.includes('透天')) return '透天';
    if (combined.includes('別墅') || combined.includes('別莊')) return '別墅';
    if (combined.includes('公寓')) return '公寓';
    if (combined.includes('華廈')) return '華廈';
    if (combined.includes('店面') || combined.includes('店鋪')) return '店面';
    if (combined.includes('辦公') || combined.includes('商辦')) return '辦公';
    if (combined.includes('土地')) return '土地';
    if (combined.includes('大樓') || combined.includes('電梯')) return '大樓';
    return '大樓';
  }

  parseListings(html: string, filters: SearchFilters): HousingListing[] {
    const $ = this.loadHTML(html);
    const listings: HousingListing[] = [];
    let index = 0;

    // 永慶 (Angular SPA) 真實渲染後的卡片結構：
    //   .yc-ng-buy-house-card.card
    //     .caseName       房名
    //     .address        地址
    //     .caseType       房屋類型 (e.g. 住宅大樓)
    //     .regArea        坪數 (e.g. 建坪50.36)
    //     .floor / .room  樓層 / 格局
    //     .price          價格 (萬)
    //     .tag-list .tag-item
    //   a[href^="house/..."]   詳細頁
    const sub = filters.listingType === 'rent' ? 'rent' : 'buy';
    const detailBase = `https://${sub}.yungching.com.tw`;

    $('.yc-ng-buy-house-card.card').each((_, el) => {
      const $el = $(el);

      // 過濾仍在 loading 的 skeleton
      if ($el.hasClass('loading')) return;

      const title = $el.find('.caseName').first().text().trim();
      const address = $el.find('.address').first().text().trim();
      const caseType = $el.find('.caseType').first().text().trim();
      const regAreaText = $el.find('.regArea').first().text().trim();
      const sizeMatch = regAreaText.match(/([0-9]+(?:\.[0-9]+)?)/);
      const size = sizeMatch ? parseFloat(sizeMatch[1]) : 0;

      const layoutText = $el.find('.room').first().text().trim();
      const roomMatch = layoutText.match(/(\d+)\s*房/);
      const livingMatch = layoutText.match(/(\d+)\s*廳/);
      const bathMatch = layoutText.match(/(\d+)\s*衛/);

      const floorText = $el.find('.floor').first().text().trim();

      // 價格 (.price) e.g. "5,980萬" 或 "2,968"
      const priceText = $el.find('.price').last().text().trim();
      const priceNum = priceText.replace(/[,\s萬元月\/]/g, '');
      const price = parseFloat(priceNum) || 0;

      const tags: string[] = [];
      $el.find('.tag-item').each((_, t) => {
        const txt = $(t).text().trim();
        if (txt) tags.push(txt);
      });
      const isSponsored = $el.hasClass('isTopPicks') || tags.some(t => t.includes('置頂') || t.includes('推薦'));

      // 詳細頁連結：a[href="house/<id>"] (相對網址)
      const link = $el.find('a[href]').first().attr('href')
        || $el.closest('a').attr('href') || '';
      const fullUrl = /^https?:\/\//.test(link)
        ? link
        : link
        ? `${detailBase}/${link.replace(/^\//, '')}`
        : '';

      const imgUrl = $el.find('img').first().attr('src') || '';

      if (!title || price <= 0 || !fullUrl || !/\/house\//.test(fullUrl)) return;

      const { city, district } = this.extractLocation(address);
      listings.push(this.createListing({
        index: index++,
        title,
        price,
        priceUnit: filters.listingType === 'rent' ? '元/月' : '萬',
        location: address,
        city: city || filters.city || '',
        district,
        address,
        propertyType: this.detectPropertyType(caseType + ' ' + title),
        size,
        rooms: roomMatch ? parseInt(roomMatch[1]) : 0,
        livingRooms: livingMatch ? parseInt(livingMatch[1]) : 1,
        bathrooms: bathMatch ? parseInt(bathMatch[1]) : 1,
        floor: floorText || undefined,
        listingType: filters.listingType,
        isSponsored,
        url: fullUrl,
        imageUrl: imgUrl || undefined,
        tags: tags.length > 0 ? tags : undefined,
      }));
    });

    return listings;
  }

  private getRandomDistrict(city?: string): string {
    if (!city) return '大安區';
    const districts = TAIWAN_DISTRICTS[city];
    if (!districts || districts.length === 0) return '大安區';
    return districts[Math.floor(Math.random() * districts.length)];
  }

  private getMockData(filters: SearchFilters): HousingListing[] {
    const mockListings: HousingListing[] = [];
    const count = 4 + Math.floor(Math.random() * 4);
    const district = filters.districts[0] || this.getRandomDistrict(filters.city);

    for (let i = 0; i < count; i++) {
      const isSponsored = i < 2;
      mockListings.push(this.createListing({
        index: i,
        title: `永慶${filters.city || '台北'}${['實品屋', '新裝潢', '優質華廈', '邊間採光'][Math.floor(Math.random() * 4)]}`,
        price: filters.listingType === 'rent'
          ? (isSponsored ? 7000 + Math.floor(Math.random() * 13000) : 12000 + Math.floor(Math.random() * 38000))
          : (isSponsored ? 700 + Math.floor(Math.random() * 400) : 1000 + Math.floor(Math.random() * 2500)),
        priceUnit: filters.listingType === 'rent' ? '元/月' : '萬',
        location: `${filters.city || '台北市'} ${district} 優質地段`,
        city: filters.city || '台北市',
        district,
        propertyType: '華廈',
        size: 20 + Math.floor(Math.random() * 50),
        rooms: Math.floor(Math.random() * 4) + 1,
        livingRooms: 1,
        bathrooms: Math.floor(Math.random() * 2) + 1,
        listingType: filters.listingType,
        isSponsored,
        url: `https://www.yungching.com.tw/detail/${i}`,
        tags: isSponsored ? ['置頂推薦'] : undefined,
      }));
    }

    return mockListings;
  }
}
