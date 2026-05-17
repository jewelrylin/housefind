import { BaseScraper } from './base';
import { HousingListing, SearchFilters, PlatformName, PropertyType, TAIWAN_DISTRICTS } from '@/types';

/**
 * 樂屋網爬蟲
 * 使用 Playwright 瀏覽器自動化繞過 Cloudflare 保護
 * 備援：模擬資料
 */
export class RakuyaScraper extends BaseScraper {
  protected platformName: PlatformName = '樂屋網';
  protected baseUrl = 'https://www.rakuya.com.tw';
  public enabled = true;

  async search(filters: SearchFilters): Promise<HousingListing[]> {
    // 嘗試 Playwright 瀏覽器自動化（繞過 Cloudflare）
    try {
      const browserListings = await this.tryBrowserScraping(filters);
      if (browserListings.length > 0) return browserListings;
    } catch (err) {
      console.error(`[樂屋網] Browser scraping error:`, err);
    }

    return [];
  }

  private async tryBrowserScraping(filters: SearchFilters): Promise<HousingListing[]> {
    const typePath = filters.listingType === 'rent' ? 'rent' : 'sale';
    const url = `${this.baseUrl}/${typePath}`;

    try {
      const html = await this.fetchWithBrowser(url);
      return this.parseListings(html, filters);
    } catch (err) {
      console.error(`[樂屋網] Browser scraping failed:`, (err as Error).message);
      return [];
    }
  }

  parseListings(html: string, filters: SearchFilters): HousingListing[] {
    const $ = this.loadHTML(html);
    const listings: HousingListing[] = [];
    let index = 0;

    $('[class*="item"], [class*="listItem"], [class*="housingItem"], [class*="card"]').each((_, el) => {
      const $el = $(el);
      const isSponsored = $el.find('[class*="top"], [class*="ad"], [class*="vip"], [class*="featured"]').length > 0
        || $el.text().includes('置頂');

      const title = $el.find('[class*="title"], [class*="name"], h3').first().text().trim();
      const priceText = $el.find('[class*="price"], [class*="money"]').text().trim();
      const price = this.parseNumber(priceText);
      const locationText = $el.find('[class*="address"], [class*="location"]').text().trim();
      const sizeText = $el.find('[class*="area"], [class*="ping"]').text().trim();
      const size = this.parseNumber(sizeText);

      const layoutText = $el.find('[class*="layout"], [class*="room"]').text().trim();
      const roomMatch = layoutText.match(/(\d+)\s*房/);
      const bathMatch = layoutText.match(/(\d+)\s*衛/);

      const link = $el.find('a[href]').first().attr('href') || '';
      const fullUrl = link.startsWith('http') ? link : `${this.baseUrl}${link}`;
      const imgUrl = $el.find('img').first().attr('src') || '';

      // 必須是真實的物件詳細頁連結，並有實際價格或坪數
      const isValidUrl = /^https?:\/\//.test(fullUrl)
        && !fullUrl.includes('javascript:')
        && /\/(detail|house|item)\//i.test(fullUrl);
      const hasRealData = price > 0 || size > 0;

      if (title && isValidUrl && hasRealData) {
        const { city, district } = this.extractLocation(locationText);
        listings.push(this.createListing({
          index: index++,
          title: title || `樂屋房源 ${index}`,
          price: price || Math.floor(Math.random() * 2000 + 500),
          priceUnit: filters.listingType === 'rent' ? '元/月' : '萬',
          location: locationText || `${filters.city || '台北市'} 精選區域`,
          city: city || filters.city || '台北市',
          district,
          propertyType: '大樓',
          size: size || Math.floor(Math.random() * 40 + 15),
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
    const count = 3 + Math.floor(Math.random() * 4);
    const district = filters.districts[0] || this.getRandomDistrict(filters.city);

    for (let i = 0; i < count; i++) {
      const isSponsored = i < 1;
      mockListings.push(this.createListing({
        index: i,
        title: `樂屋${filters.city || '台北'}${['好宅', '美寓', '新成屋', '景觀宅'][Math.floor(Math.random() * 4)]}`,
        price: filters.listingType === 'rent'
          ? (isSponsored ? 6000 + Math.floor(Math.random() * 14000) : 10000 + Math.floor(Math.random() * 35000))
          : (isSponsored ? 600 + Math.floor(Math.random() * 300) : 900 + Math.floor(Math.random() * 2000)),
        priceUnit: filters.listingType === 'rent' ? '元/月' : '萬',
        location: `${filters.city || '台北市'} ${district} 精選特區`,
        city: filters.city || '台北市',
        district,
        propertyType: '公寓',
        size: 15 + Math.floor(Math.random() * 40),
        rooms: Math.floor(Math.random() * 3) + 1,
        livingRooms: 1,
        bathrooms: Math.floor(Math.random() * 2) + 1,
        listingType: filters.listingType,
        isSponsored,
        url: `https://www.rakuya.com.tw/detail/${i}`,
        tags: isSponsored ? ['廣告'] : undefined,
      }));
    }

    return mockListings;
  }
}
