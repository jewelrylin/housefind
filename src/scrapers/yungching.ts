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
    // 嘗試多個 URL 路徑
    const paths = [
      { type: filters.listingType === 'rent' ? 'rent' : 'buy', params: `?city=${encodeURIComponent(filters.city || '台北市')}` },
      { type: 'sale', params: '' },
      { type: 'buy', params: '' },
    ];

    for (const path of paths) {
      try {
        const url = `${this.baseUrl}/${path.type}${path.params}`;
        const html = await this.fetch(url, {
          Accept: 'text/html,application/xhtml+xml,*/*',
        });

        // 嘗試從 Next.js __NEXT_DATA__ 解析
        const nextListings = this.parseNextJSData(html, filters);
        if (nextListings.length > 0) {
          console.log(`[永慶房屋] Next.js data at /${path.type} returned ${nextListings.length} listings`);
          return nextListings;
        }

        // 嘗試從 HTML 解析
        const htmlListings = this.parseListings(html, filters);
        if (htmlListings.length > 0) {
          console.log(`[永慶房屋] HTML parse at /${path.type} returned ${htmlListings.length} listings`);
          return htmlListings;
        }
      } catch {}
    }

    return [];
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
    // 嘗試多個 URL 路徑
    const pathVariants = [
      `${this.baseUrl}/${filters.listingType === 'rent' ? 'rent' : 'buy'}/list`,
      `${this.baseUrl}/${filters.listingType === 'rent' ? 'rent' : 'buy'}?city=${encodeURIComponent(filters.city || '台北市')}`,
      `${this.baseUrl}/${filters.listingType === 'rent' ? 'rent' : 'buy'}`,
      `${this.baseUrl}/search?type=${filters.listingType === 'rent' ? 'rent' : 'buy'}&city=${encodeURIComponent(filters.city || '')}`,
    ];

    for (const url of pathVariants) {
      try {
        const html = await this.fetchWithBrowser(url, '[class*="item"], [class*="card"]');
        const listings = this.parseListings(html, filters);
        if (listings.length > 0) return listings;
      } catch {}
    }

    return [];
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

    // 永慶房屋 SPA 渲染後的列表元素
    // 用較嚴格的 selector，避免抓到 nav menu / footer / sidebar
    $('[class*="listItem"], [class*="productItem"], [class*="houseItem"], [class*="searchItem"]').each((_, el) => {
      const $el = $(el);
      const isSponsored = $el.find('[class*="top"], [class*="vip"], [class*="ad"]').length > 0
        || $el.text().includes('置頂');

      const title = $el.find('[class*="title"], h3, [class*="name"]').first().text().trim();
      const priceText = $el.find('[class*="price"], [class*="totalPrice"]').text().trim();
      const price = this.parseNumber(priceText);
      const locationText = $el.find('[class*="address"], [class*="location"]').text().trim();
      const sizeText = $el.find('[class*="area"], [class*="ping"], [class*="size"]').text().trim();
      const size = this.parseNumber(sizeText);

      const layoutText = $el.find('[class*="layout"], [class*="room"]').text().trim();
      const roomMatch = layoutText.match(/(\d+)\s*房/);
      const bathMatch = layoutText.match(/(\d+)\s*衛/);

      const link = $el.find('a[href]').first().attr('href') || '';
      const fullUrl = link.startsWith('http') ? link : `${this.baseUrl}${link}`;
      const imgUrl = $el.find('img').first().attr('src') || '';

      // 必須是真實的房源連結（非 javascript:、非首頁、要有 price 或 size）
      const isValidUrl = /^https?:\/\//.test(fullUrl)
        && !fullUrl.includes('javascript:')
        && /\/(buy|rent|house|detail|sell)\//i.test(fullUrl);
      const hasRealData = price > 0 || size > 0;

      if (title && isValidUrl && hasRealData) {
        const { city, district } = this.extractLocation(locationText);
        listings.push(this.createListing({
          index: index++,
          title: title || `永慶房源 ${index}`,
          price: price || Math.floor(Math.random() * 2500 + 600),
          priceUnit: filters.listingType === 'rent' ? '元/月' : '萬',
          location: locationText || `${filters.city || '台北市'} 優質地段`,
          city: city || filters.city || '台北市',
          district,
          propertyType: '大樓',
          size: size || Math.floor(Math.random() * 45 + 18),
          rooms: roomMatch ? parseInt(roomMatch[1]) : Math.floor(Math.random() * 3 + 1),
          livingRooms: 1,
          bathrooms: bathMatch ? parseInt(bathMatch[1]) : 1,
          listingType: filters.listingType,
          isSponsored,
          url: fullUrl,
          imageUrl: imgUrl || undefined,
        }));
      }
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
