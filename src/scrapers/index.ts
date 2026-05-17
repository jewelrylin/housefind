import { SearchFilters, HousingListing, SearchResult, PlatformStatus, PlatformName, DEFAULT_FILTERS } from '@/types';
import { isListingMatchFilters, sortListings } from '@/utils/filter';
import { TAIWAN_DISTRICTS } from '@/types';
import { Platform591Scraper } from './platform591';
import { SinyiScraper } from './sinyi';
import { YungchingScraper } from './yungching';
import { RakuyaScraper } from './rakuya';
import { HousefunScraper } from './housefun';
import { HBHousingScraper } from './hbhousing';

export { TAIWAN_DISTRICTS };

/** 每平台搜尋逾時（毫秒）— 部分爬蟲會嘗試多個 URL，axios 單次 timeout 為 8-10s */
const SCRAPER_TIMEOUT = 12_000;

/** 已知可回傳真實資料的平台 */
const KNOWN_REAL_PLATFORMS = ['信義房屋', '永慶房屋', '好房網'];

/** 判斷平台是否已知為真實資料來源 */
function isPlatformKnownReal(name: string): boolean {
  return KNOWN_REAL_PLATFORMS.includes(name);
}

/**
 * 判斷單筆房源是否為模擬資料
 * 透過檢查 URL、ID、圖片網址等特徵
 */
function isMockListing(listing: HousingListing): boolean {
  // 1. 圖片網址為佔位圖
  if (listing.imageUrl?.includes('/api/placeholder/') ||
      listing.imageUrl?.includes('via.placeholder.com') ||
      listing.imageUrl?.includes('dummyimage') ||
      listing.imageUrl?.includes('placehold')) return true;

  // 2. 網址包含 mock/example/placeholder 等關鍵字
  if (/mock|example|placeholder/i.test(listing.url)) return true;

  // 3. 網址為「/detail/1~2位數字」模式（模擬資料 index 為 0-7）
  //    避免誤判真實的長數字編號（如 /detail/12345678 是正常的房源 ID）
  if (/\/detail\/\d{1,2}$/.test(listing.url)) return true;

  // 4. ID 為純數字且過於規律（新 createListing 可能產生此模式）
  if (/^\d{6,}$/.test(listing.id)) {
    if (listing.price === 1500 && listing.size === 40 && listing.rooms === 3) return true;
  }

  // 5. 所有必填欄位都是預設值（0, '', 等），強烈暗示為未正確初始化的模擬資料
  const requiredDefaults =
    listing.price === 0 &&
    listing.size === 0 &&
    listing.rooms === 0 &&
    !listing.title;
  if (requiredDefaults) return true;

  return false;
}

/**
 * 為爬蟲加上逾時控制的包裝器
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[${label}] 搜尋逾時 (${ms}ms)`)), ms)
    ),
  ]);
}

/**
 * 搜尋引擎聚合器
 * 統籌所有平台的搜尋，將結果彙整並過濾
 */
export class SearchAggregator {
  private scrapers = [
    new Platform591Scraper(),
    new SinyiScraper(),
    new YungchingScraper(),
    new RakuyaScraper(),
    new HousefunScraper(),
    new HBHousingScraper(),
  ];

  /**
   * 執行多平台搜尋
   */
  async search(filters: Partial<SearchFilters>): Promise<SearchResult> {
    const startTime = Date.now();
    const mergedFilters: SearchFilters = { ...DEFAULT_FILTERS, ...filters };

    // 如果沒有指定平台，使用所有平台
    const activeScrapers = mergedFilters.platforms.length > 0
      ? this.scrapers.filter(s => mergedFilters.platforms.includes(s.getPlatformName()))
      : this.scrapers.filter(s => s.enabled);

    const platforms: PlatformStatus[] = activeScrapers.map(s => ({
      name: s.getPlatformName(),
      icon: getPlatformIcon(s.getPlatformName()),
      enabled: true,
      resultsCount: 0,
    }));

    // 並行搜尋所有平台（每個有逾時控制）
    const results = await Promise.allSettled(
      activeScrapers.map(async (scraper) => {
        const name = scraper.getPlatformName();
        const scraperStart = Date.now();
        try {
          const listings = await withTimeout(
            scraper.search(mergedFilters),
            SCRAPER_TIMEOUT,
            name
          );
          const duration = Date.now() - scraperStart;
          return { name, listings, duration, error: undefined as string | undefined };
        } catch (error) {
          const duration = Date.now() - scraperStart;
          return { name, listings: [] as HousingListing[], duration, error: (error as Error).message };
        }
      })
    );

    // 彙整結果
    let allListings: HousingListing[] = [];
    let totalSponsored = 0;

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { name, listings, duration, error } = result.value;

        // 判斷資料是否真實：先檢查實際房源 URL 特徵，再回退到已知平台名單
        const hasRealListings = listings.length > 0 && listings.some(l => !isMockListing(l));
        const hasRealData = hasRealListings || (isPlatformKnownReal(name) && listings.length > 0);

        allListings = [...allListings, ...listings];

        const platformStatus = platforms.find(p => p.name === name);
        if (platformStatus) {
          platformStatus.resultsCount = listings.length;
          platformStatus.error = error;
          platformStatus.isRealData = hasRealData && listings.length > 0;
          platformStatus.searchTime = duration;
        }

        totalSponsored += listings.filter(l => l.isSponsored).length;
      }
    });

    const totalBeforeFilter = allListings.length;

    // 過濾掉模擬資料（在 Netlify 等無瀏覽器環境中，爬蟲會回退到假資料）
    const mockFilteredCount = allListings.filter(l => isMockListing(l)).length;
    if (mockFilteredCount > 0) {
      console.log(`[Aggregator] Filtered out ${mockFilteredCount} mock listings`);
    }
    allListings = allListings.filter(l => !isMockListing(l));

    // 過濾所有房源
    allListings = allListings.filter((listing) => {
      if (mergedFilters.hideSponsored && listing.isSponsored) return false;
      return isListingMatchFilters(listing, mergedFilters);
    });

    // 排序
    allListings = sortListings(allListings, mergedFilters.sortBy);

    const searchTime = Date.now() - startTime;

    return {
      listings: allListings,
      platforms,
      totalCount: totalBeforeFilter,
      filteredCount: totalBeforeFilter - allListings.length,
      sponsoredCount: totalSponsored,
      searchTime,
      filters: mergedFilters,
      mockFilteredCount,
    };
  }
}

/** 取得平台圖示 emoji */
function getPlatformIcon(name: PlatformName): string {
  const icons: Record<PlatformName, string> = {
    '591房屋交易': '🏠',
    '信義房屋': '🔵',
    '永慶房屋': '🟢',
    '樂屋網': '🎵',
    '好房網': '🏡',
    '住商不動產': '🏢',
  };
  return icons[name] || '🏘️';
}
