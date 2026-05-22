import { BaseScraper } from './base';
import { HousingListing, SearchFilters, PlatformName } from '@/types';

/**
 * 樂屋網爬蟲
 *
 * 實際搜尋頁面：
 *   sale: https://www.rakuya.com.tw/sell/result?city=<n>&display=list&sort=11
 *   rent: https://www.rakuya.com.tw/rent/result?city=<n>&display=list&sort=11
 *
 * 房源卡片：`.grid-item.search-obj` (data-ehid=<id>)
 * 詳細頁：  https://www.rakuya.com.tw/sell_item/info?ehid=<ehid>
 *
 * 樂屋網有 Cloudflare JS Challenge，需要 Playwright 等待約 5-10 秒才能拿到資料。
 */
export class RakuyaScraper extends BaseScraper {
  protected platformName: PlatformName = '樂屋網';
  protected baseUrl = 'https://www.rakuya.com.tw';
  public enabled = true;

  /** 樂屋網的縣市代碼（從 city 下拉選單擷取） */
  private static readonly CITY_CODE: Record<string, string> = {
    '台北市': '0',
    '基隆市': '1',
    '新北市': '2',
    '宜蘭縣': '3',
    '桃園市': '4',
    '新竹市': '5',
    '新竹縣': '6',
    '苗栗縣': '7',
    '台中市': '8',
    '彰化縣': '9',
    '南投縣': '10',
    '雲林縣': '11',
    '嘉義市': '12',
    '嘉義縣': '13',
    '台南市': '14',
    '高雄市': '15',
    '澎湖縣': '16',
    '屏東縣': '17',
    '台東縣': '18',
    '花蓮縣': '19',
    '金門縣': '20',
    '連江縣': '21',
  };

  async search(filters: SearchFilters): Promise<HousingListing[]> {
    try {
      const browserListings = await this.tryBrowserScraping(filters);
      if (browserListings.length > 0) return browserListings;
    } catch (err) {
      console.error(`[樂屋網] Browser scraping error:`, (err as Error).message);
    }
    return [];
  }

  private async tryBrowserScraping(filters: SearchFilters): Promise<HousingListing[]> {
    const cityCode = RakuyaScraper.CITY_CODE[filters.city] ?? '0';
    const typePath = filters.listingType === 'rent' ? 'rent' : 'sell';
    const url = `${this.baseUrl}/${typePath}/result?city=${cityCode}&display=list&sort=11`;

    // Cloudflare JS challenge 需要約 5-10 秒；放寬 selector 等待逾時
    const html = await this.fetchWithBrowser(url, '.grid-item.search-obj', 12000);
    return this.parseListings(html, filters);
  }

  parseListings(html: string, filters: SearchFilters): HousingListing[] {
    const $ = this.loadHTML(html);
    const listings: HousingListing[] = [];
    let index = 0;

    $('.grid-item.search-obj').each((_, el) => {
      const $el = $(el);
      const ehid = $el.attr('data-ehid') || '';

      const title = $el.find('.card__head').first().text().trim();
      const district = $el.find('.info__geo--area').first().text().trim();
      const road = $el.find('.info__geo--road').first().text().trim();
      const detailText = $el.find('.info__detail-info').first().text().trim();
      // detailText 範例："公寓 3房2廳1衛 47年 5/5樓"

      const propertyTypeMatch = detailText.match(/(公寓|大樓|華廈|透天|別墅|店面|套房|辦公|土地)/);
      const roomMatch = detailText.match(/(\d+)\s*房/);
      const livingMatch = detailText.match(/(\d+)\s*廳/);
      const bathMatch = detailText.match(/(\d+)\s*衛/);
      const ageMatch = detailText.match(/(\d+(?:\.\d+)?)\s*年/);
      const floorMatch = detailText.match(/(\d+\/\d+)\s*樓/);

      // 坪數：總建坪 (.info__space 中第一個)
      const totalSpaceText = $el.find('.info__space').first().text().trim();
      const sizeMatch = totalSpaceText.match(/([0-9]+(?:\.[0-9]+)?)\s*坪/);
      const size = sizeMatch ? parseFloat(sizeMatch[1]) : 0;

      // 單價 (.info__price--unit) e.g. "53.68萬/坪"
      const unitText = $el.find('.info__price--unit').first().text().trim();
      const unitMatch = unitText.match(/([0-9]+(?:\.[0-9]+)?)\s*萬/);
      const pricePerPing = unitMatch ? parseFloat(unitMatch[1]) : undefined;

      // 總價 (.info__price) e.g. "1998萬 1,750萬"
      //  最後一個數字通常是「目前售價」，第一個是「原價」
      const priceBlock = $el.find('.info__price').first().text().trim();
      const allPriceMatches = Array.from(priceBlock.matchAll(/([0-9,]+(?:\.[0-9]+)?)\s*萬/g));
      const price = allPriceMatches.length > 0
        ? parseFloat(allPriceMatches[allPriceMatches.length - 1][1].replace(/,/g, ''))
        : 0;

      // 標籤
      const tags: string[] = [];
      $el.find('.tag, [class*="tag__"]').each((_, t) => {
        const txt = $(t).text().trim();
        if (txt && txt.length < 30 && !tags.includes(txt)) tags.push(txt);
      });
      const isSponsored = tags.some(t => t.includes('置頂') || t.includes('精選') || t.includes('廣告') || t.includes('VIP'));

      // 圖片
      const imgUrl = $el.find('img').first().attr('data-src')
        || $el.find('img').first().attr('src') || '';

      if (!title || !ehid || price <= 0) return;

      listings.push(this.createListing({
        index: index++,
        title,
        price,
        priceUnit: filters.listingType === 'rent' ? '元/月' : '萬',
        pricePerPing,
        location: [district, road].filter(Boolean).join(' '),
        city: filters.city || '',
        district,
        address: road,
        propertyType: (propertyTypeMatch?.[1] as never) || '大樓',
        size,
        rooms: roomMatch ? parseInt(roomMatch[1]) : 0,
        livingRooms: livingMatch ? parseInt(livingMatch[1]) : 1,
        bathrooms: bathMatch ? parseInt(bathMatch[1]) : 1,
        floor: floorMatch ? floorMatch[1] : undefined,
        year: ageMatch ? new Date().getFullYear() - parseFloat(ageMatch[1]) : undefined,
        listingType: filters.listingType,
        isSponsored,
        url: `${this.baseUrl}/${filters.listingType === 'rent' ? 'rent' : 'sell'}_item/info?ehid=${ehid}`,
        imageUrl: imgUrl || undefined,
        tags: tags.length > 0 ? tags : undefined,
      }));
    });

    return listings;
  }
}
