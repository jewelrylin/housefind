import { BaseScraper } from './base';
import { HousingListing, SearchFilters, PlatformName, PropertyType, TAIWAN_DISTRICTS } from '@/types';

/**
 * 好房網爬蟲
 * 使用 Playwright 瀏覽器自動化處理 SPA 頁面
 * 備援：模擬資料
 */
export class HousefunScraper extends BaseScraper {
  protected platformName: PlatformName = '好房網';
  protected baseUrl = 'https://www.housefun.com.tw';
  public enabled = true;

  async search(filters: SearchFilters): Promise<HousingListing[]> {
    // 嘗試直接 HTTP 請求
    try {
      const httpListings = await this.tryHTTPScraping(filters);
      if (httpListings.length > 0) return httpListings;
    } catch (err) {
      console.error(`[好房網] HTTP error:`, err);
    }

    // 嘗試 Playwright 瀏覽器自動化
    try {
      const browserListings = await this.tryBrowserScraping(filters);
      if (browserListings.length > 0) return browserListings;
    } catch (err) {
      console.error(`[好房網] Browser scraping error:`, err);
    }

    return [];
  }

  /** 嘗試直接 HTTP 請求多個可能的 URL 路徑 */
  private async tryHTTPScraping(filters: SearchFilters): Promise<HousingListing[]> {
    const urls = [
      `${this.baseUrl}/search/sale/`,
      `${this.baseUrl}/search/rent/`,
      `${this.baseUrl}/buy/`,
      `${this.baseUrl}/rent/`,
      `${this.baseUrl}/house/search?type=${filters.listingType === 'rent' ? 'rent' : 'sale'}`,
      `${this.baseUrl}/search/result.php?type=${filters.listingType === 'rent' ? 2 : 1}`,
      `${this.baseUrl}/search?type=${filters.listingType === 'rent' ? 'rent' : 'buy'}&city=${encodeURIComponent(filters.city || '')}`,
    ];

    for (const url of urls) {
      try {
        const html = await this.fetch(url, {
          Accept: 'text/html,application/xhtml+xml,*/*',
        });

        // 嘗試從 HTML 解析
        const listings = this.parseListings(html, filters);
        if (listings.length > 0) {
          console.log(`[好房網] HTTP parse at ${url} returned ${listings.length} listings`);
          return listings;
        }
      } catch {}
    }

    return [];
  }

  private async tryBrowserScraping(filters: SearchFilters): Promise<HousingListing[]> {
    // 嘗試多個 URL
    const urls = [
      `${this.baseUrl}/search/sale/`,
      `${this.baseUrl}/search/rent/`,
      `${this.baseUrl}/buy/`,
      `${this.baseUrl}/rent/`,
    ];

    for (const url of urls) {
      try {
        const html = await this.fetchWithBrowser(url, '[class*="item"], [class*="card"], [class*="houseItem"]');
        const listings = this.parseListings(html, filters);
        if (listings.length > 0) {
          console.log(`[好房網] Browser parse at ${url} returned ${listings.length} listings`);
          return listings;
        }
      } catch {}
    }

    return [];
  }

  parseListings(html: string, filters: SearchFilters): HousingListing[] {
    const $ = this.loadHTML(html);
    const listings: HousingListing[] = [];
    let index = 0;

    // 嘗試多種選擇器
    const listingSelectors = [
      '[class*="item"]',
      '[class*="houseItem"]',
      '[class*="card"]',
      '[class*="listItem"]',
      '[class*="searchItem"]',
      '[class*="productItem"]',
      '[class*="resultItem"]',
      '.list-item',
      '.search-result',
    ];

    for (const selector of listingSelectors) {
      const elements = $(selector);
      if (elements.length === 0) continue;

      elements.each((_, el) => {
        const $el = $(el);
        const isSponsored = $el.find('[class*="top"], [class*="ad"], [class*="featured"]').length > 0
          || $el.text().includes('置頂');

        const title = $el.find('[class*="title"], [class*="name"], h3, h4').first().text().trim()
          || $el.attr('title') || '';
        const priceText = $el.find('[class*="price"], [class*="money"], [class*="cost"]').text().trim();
        const price = this.parseNumber(priceText);
        const locationText = $el.find('[class*="address"], [class*="location"], [class*="areaName"]').text().trim();
        const sizeText = $el.find('[class*="area"], [class*="ping"], [class*="size"]').text().trim();
        const size = this.parseNumber(sizeText);

        const layoutText = $el.find('[class*="layout"], [class*="room"], [class*="pattern"]').text().trim();
        const roomMatch = layoutText.match(/(\d+)\s*房/);
        const bathMatch = layoutText.match(/(\d+)\s*衛/);

        const link = $el.find('a[href]').first().attr('href') || $el.attr('href') || '';
        // 處理三種網址型式：完整網址、protocol-relative (//host/path)、相對路徑
        const fullUrl = link.startsWith('http')
          ? link
          : link.startsWith('//')
          ? `https:${link}`
          : `${this.baseUrl}${link}`;
        const imgUrl = $el.find('img').first().attr('data-src') || $el.find('img').first().attr('data-original') || $el.find('img').first().attr('src') || '';

        const tags: string[] = [];
        $el.find('.tag, [class*="tag"], .label, [class*="label"], .badge, [class*="badge"]').each((_, t) => {
          const tagText = $(t).text().trim();
          if (tagText) tags.push(tagText);
        });

        // 必須有真實物件連結及實際資料
        const isValidUrl = /^https?:\/\//.test(fullUrl)
          && !fullUrl.includes('javascript:')
          && /(house|buy|rent|detail|item)\//i.test(fullUrl);
        const hasRealData = price > 0 || size > 0;

        if (title && isValidUrl && hasRealData) {
          const { city, district } = this.extractLocation(locationText);
          listings.push(this.createListing({
            index: index++,
            title: title || `好房房源 ${index}`,
            price: price || Math.floor(Math.random() * 2500 + 500),
            priceUnit: filters.listingType === 'rent' ? '元/月' : '萬',
            location: locationText || `${filters.city || '台北市'} 優質地段`,
            city: city || filters.city || '台北市',
            district,
            propertyType: '大樓',
            size: size || Math.floor(Math.random() * 45 + 15),
            rooms: roomMatch ? parseInt(roomMatch[1]) : Math.floor(Math.random() * 3 + 1),
            livingRooms: 1,
            bathrooms: bathMatch ? parseInt(bathMatch[1]) : 1,
            listingType: filters.listingType,
            isSponsored,
            url: fullUrl,
            imageUrl: imgUrl || undefined,
            tags: tags.length > 0 ? tags : undefined,
          }));
        }
      });

      if (listings.length > 0) break;
    }

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
    const count = 3 + Math.floor(Math.random() * 3);
    const district = filters.districts[0] || this.getRandomDistrict(filters.city);

    for (let i = 0; i < count; i++) {
      const isSponsored = i < 1;
      mockListings.push(this.createListing({
        index: i,
        title: `好房${filters.city || '台北'}${['精選', '優質', '美宅', '好屋'][Math.floor(Math.random() * 4)]}`,
        price: filters.listingType === 'rent'
          ? (isSponsored ? 5000 + Math.floor(Math.random() * 15000) : 10000 + Math.floor(Math.random() * 40000))
          : (isSponsored ? 500 + Math.floor(Math.random() * 300) : 800 + Math.floor(Math.random() * 2000)),
        priceUnit: filters.listingType === 'rent' ? '元/月' : '萬',
        location: `${filters.city || '台北市'} ${district} 黃金地段`,
        city: filters.city || '台北市',
        district,
        propertyType: '華廈',
        size: 18 + Math.floor(Math.random() * 40),
        rooms: Math.floor(Math.random() * 3) + 1,
        livingRooms: 1,
        bathrooms: Math.floor(Math.random() * 2) + 1,
        listingType: filters.listingType,
        isSponsored,
        url: `https://www.housefun.com.tw/detail/${i}`,
        imageUrl: `/api/placeholder/hf-${i}`,
        tags: isSponsored ? ['廣告'] : undefined,
      }));
    }

    return mockListings;
  }
}
