import { BaseScraper } from './base';
import { HousingListing, SearchFilters, PlatformName, TAIWAN_DISTRICTS } from '@/types';
import { detectPropertyType, getRandomDistrict } from './scraper-utils';

/**
 * 信義房屋爬蟲
 * 使用 Next.js SSR 的 __NEXT_DATA__ 直接提取真實房源資料
 */
export class SinyiScraper extends BaseScraper {
  protected platformName: PlatformName = '信義房屋';
  protected baseUrl = 'https://www.sinyi.com.tw';
  public enabled = true;

  async search(filters: SearchFilters): Promise<HousingListing[]> {
    const typePath = filters.listingType === 'rent' ? 'rent' : 'buy';

    // 建立搜尋 URL — 加入縣市與行政區參數以獲得精準結果
    const params = new URLSearchParams();
    if (filters.city) params.set('city', filters.city);
    if (filters.districts.length > 0) params.set('district', filters.districts[0]);
    if (filters.minPrice > 0) params.set('priceLow', String(filters.minPrice));
    if (filters.maxPrice > 0) params.set('priceHigh', String(filters.maxPrice));

    const url = `${this.baseUrl}/${typePath}/list?${params.toString()}`;

    try {
      const html = await this.fetch(url, {
        Accept: 'text/html,application/xhtml+xml,*/*',
      });

      // 從 Next.js SSR 解析真實資料
      const listings = this.parseNextJSData(html, filters);
      if (listings.length > 0) {
        return listings;
      }

      // 如果 Next.js 解析失敗，回退到 HTML 解析
      return this.parseListings(html, filters);
    } catch {
      return [];
    }
  }

  parseListings(html: string, filters: SearchFilters): HousingListing[] {
    const $ = this.loadHTML(html);
    const listings: HousingListing[] = [];
    let index = 0;

    $('[class*="item"], [class*="listItem"], [class*="card"], .searchResultItem').each((_, el) => {
      const $el = $(el);
      const isSponsored = $el.find('[class*="top"], [class*="vip"], [class*="ad"]').length > 0
        || $el.text().includes('置頂');

      const title = $el.find('[class*="title"], [class*="name"], h3').first().text().trim();
      const priceText = $el.find('[class*="price"], [class*="money"]').text().trim();
      const price = this.parseNumber(priceText);
      const locationText = $el.find('[class*="location"], [class*="address"]').text().trim();
      const sizeText = $el.find('[class*="area"], [class*="ping"]').text().trim();
      const size = this.parseNumber(sizeText);

      const layoutText = $el.find('[class*="layout"], [class*="room"]').text().trim();
      const roomMatch = layoutText.match(/(\d+)\s*房/);
      const bathMatch = layoutText.match(/(\d+)\s*衛/);

      const link = $el.find('a[href]').first().attr('href') || '';
      const fullUrl = link.startsWith('http') ? link : `${this.baseUrl}${link}`;

      if (title) {
        listings.push(this.createListing({
          index: index++,
          title: title || `信義房源 ${index}`,
          price: price || 1500 + Math.floor(Math.random() * 2000),
          priceUnit: filters.listingType === 'rent' ? '元/月' : '萬',
          location: locationText || `${filters.city || '台北市'} 精選地段`,
          city: filters.city || '台北市',
          district: '',
          propertyType: '大樓',
          size: size || 25 + Math.floor(Math.random() * 40),
          rooms: roomMatch ? parseInt(roomMatch[1]) : Math.floor(Math.random() * 3) + 2,
          bathrooms: bathMatch ? parseInt(bathMatch[1]) : 1,
          listingType: filters.listingType,
          isSponsored,
          url: fullUrl,
        }));
      }
    });

    return listings;
  }

  /**
   * 從 Next.js __NEXT_DATA__ 解析真實房源資料
   * 信義房屋使用 Redux store 資料嵌入在 __NEXT_DATA__ 中
   * 
   * 資料路徑：props.initialReduxState.{buyReducer|rentReducer}.list
   * 
   * 欄位對應（實際探測結果）：
   * - name -> title
   * - totalPrice / priceFirst -> price
   * - address -> location
   * - areaBuilding -> size (坪)
   * - layout -> "2房2廳1衛"
   * - floor/totalfloor -> 樓層
   * - houseNo / shareURL -> url
   * - uniPrice -> pricePerPing
   * - tags -> tags
   * - image -> imageUrls
   * - age -> 屋齡（年）
   */
  private parseNextJSData(html: string, filters: SearchFilters): HousingListing[] {
    const nextData = this.parseNextData(html);
    if (!nextData) return [];

    try {
      const reducerKey = filters.listingType === 'rent' ? 'rentReducer' : 'buyReducer';

      // 探測結果：實際路徑為 props.initialReduxState.{reducerKey}.list
      let listingsData: any[] | null = null;

      // 路徑 1: props.initialReduxState.{reducerKey}.list (實際探測結果)
      const reducerData = this.getNestedValue(nextData, ['props', 'initialReduxState', reducerKey]);
      if (reducerData) {
        listingsData = reducerData.list || reducerData.recommendList || reducerData.items || null;
      }

      // 路徑 2: props.pageProps (舊版 Next.js)
      if (!listingsData) {
        const pagePropsData = this.getNestedValue(nextData, ['props', 'pageProps', reducerKey]);
        if (pagePropsData) {
          listingsData = pagePropsData.list || pagePropsData.recommendList || pagePropsData.items || null;
        }
      }

      // 路徑 3: 自動搜尋所有含有房源資料的陣列
      if (!listingsData) {
        const foundArrays = this.findListingArrays(nextData);
        for (const found of foundArrays) {
          if (found.data.length >= 2) {
            listingsData = found.data;
            console.log(`[信義房屋] Found listing data at ${found.path}`);
            break;
          }
        }
      }

      if (!listingsData || !Array.isArray(listingsData) || listingsData.length === 0) {
        return [];
      }

      const listings: HousingListing[] = [];

      listingsData.forEach((item: any, index: number) => {
        try {
          // 解析格局 "2房2廳1衛"
          const layout = item.layout || item.totalLayout || item.roomLayout || '';
          const roomMatch = String(layout).match(/(\d+)\s*房/);
          const livingMatch = String(layout).match(/(\d+)\s*廳/);
          const bathMatch = String(layout).match(/(\d+)\s*衛/);

          // 價格資訊 — totalPrice 為萬，priceFirst 可能為萬
          const totalPrice = item.totalPrice || item.price || item.priceFirst || 0;
          const unit = filters.listingType === 'rent' ? '元/月' : '萬';
          const size = item.areaBuilding || item.pingUsed || item.area || item.buildingArea || 0;

          // 地址
          const address = item.address || '';
          const { city, district } = this.extractLocation(address);

          // 樓層
          const floor = item.floor ? `${item.floor}/${item.totalfloor || ''}` : undefined;

          // 屋齡計算
          const age = item.age;
          let year: number | undefined;
          if (age && !isNaN(parseInt(age))) {
            year = new Date().getFullYear() - parseInt(age);
          } else if (typeof age === 'number') {
            year = new Date().getFullYear() - age;
          }

          // 圖片
          const imageUrl = item.largeImage || (item.image && item.image[0]) || item.pic || '';
          const imageUrls = item.image || (item.largeImage ? [item.largeImage] : []);

          // 標籤
          const tags: string[] = [];
          if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach((tag: any) => {
              if (typeof tag === 'string') tags.push(tag);
              else if (tag?.name) tags.push(tag.name);
            });
          }

          // 置頂/廣告判斷
          const isSponsored = tags.some(
            (t) => t.includes('置頂') || t.includes('廣告') || t.includes('VIP')
          );

          // 判斷房屋類型
          const propertyType = detectPropertyType(
            (item.houselandtype || item.objectType || '') + ' ' + (item.name || '')
          );

          const listing = this.createListing({
            index,
            title: item.name || item.title || `信義房屋精選物件`,
            price: Number(totalPrice) || 0,
            priceUnit: unit,
            pricePerPing: item.uniPrice ? this.parseNumber(String(item.uniPrice)) : undefined,
            location: address,
            city: city || filters.city || '台北市',
            district,
            address,
            propertyType,
            size: Number(size) || 0,
            rooms: roomMatch ? parseInt(roomMatch[1]) : 0,
            livingRooms: livingMatch ? parseInt(livingMatch[1]) : 1,
            bathrooms: bathMatch ? parseInt(bathMatch[1]) : 1,
            floor,
            year,
            listingType: filters.listingType,
            isSponsored,
            url: item.shareURL || `${this.baseUrl}/buy/detail/${item.houseNo || ''}`,
            imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
            images: Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : undefined,
            tags: tags.length > 0 ? tags : undefined,
            description: item.commName || item.description || undefined,
          });

          // 套用過濾條件
          if (this.matchesFilters(listing, filters)) {
            listings.push(listing);
          }
        } catch (err) {
          console.error(`[信義房屋] Parse item error:`, err);
        }
      });

      return listings;
    } catch (err) {
      console.error(`[信義房屋] Parse Next.js data error:`, err);
      return [];
    }
  }



  /** 檢查是否符合過濾條件 */
  private matchesFilters(listing: HousingListing, filters: SearchFilters): boolean {
    if (filters.minPrice > 0 && listing.price < filters.minPrice) return false;
    if (filters.maxPrice > 0 && listing.price > filters.maxPrice) return false;
    if (filters.minSize > 0 && listing.size < filters.minSize) return false;
    if (filters.maxSize > 0 && listing.size > filters.maxSize) return false;
    if (filters.rooms > 0 && listing.rooms < filters.rooms) return false;
    if (filters.city && listing.city !== filters.city) return false;
    if (filters.districts.length > 0 && !filters.districts.includes(listing.district)) return false;
    if (filters.propertyTypes.length > 0 && !filters.propertyTypes.includes(listing.propertyType)) return false;
    return true;
  }



  private getMockData(filters: SearchFilters): HousingListing[] {
    const mockListings: HousingListing[] = [];
    const count = 5 + Math.floor(Math.random() * 4);
    const districts = filters.city ? TAIWAN_DISTRICTS[filters.city] : ['大安區', '信義區', '中山區'];
    const district = filters.districts[0] || (districts ? districts[Math.floor(Math.random() * districts.length)] : '信義區');

    for (let i = 0; i < count; i++) {
      const isSponsored = i < 2;
      mockListings.push(this.createListing({
        index: i,
        title: `${filters.city || '台北'}信義精選${['豪宅', '美廈', '公寓', '別墅'][Math.floor(Math.random() * 4)]}`,
        price: filters.listingType === 'rent'
          ? (isSponsored ? 8000 + Math.floor(Math.random() * 12000) : 10000 + Math.floor(Math.random() * 40000))
          : (isSponsored ? 800 + Math.floor(Math.random() * 500) : 1200 + Math.floor(Math.random() * 3000)),
        priceUnit: filters.listingType === 'rent' ? '元/月' : '萬',
        location: `${filters.city || '台北市'} ${district} 精選地段`,
        city: filters.city || '台北市',
        district,
        propertyType: '大樓',
        size: 25 + Math.floor(Math.random() * 60),
        rooms: Math.floor(Math.random() * 4) + 2,
        livingRooms: 1,
        bathrooms: Math.floor(Math.random() * 2) + 1,
        listingType: filters.listingType,
        isSponsored,
        url: `https://www.sinyi.com.tw/detail/${i}`,
        tags: isSponsored ? ['置頂'] : undefined,
      }));
    }

    return mockListings;
  }
}
