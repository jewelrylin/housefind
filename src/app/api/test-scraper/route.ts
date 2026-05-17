import { NextRequest, NextResponse } from 'next/server';
import { SearchFilters, HousingListing, DEFAULT_FILTERS } from '@/types';
import { Platform591Scraper } from '@/scrapers/platform591';
import { SinyiScraper } from '@/scrapers/sinyi';
import { YungchingScraper } from '@/scrapers/yungching';
import { RakuyaScraper } from '@/scrapers/rakuya';
import { HousefunScraper } from '@/scrapers/housefun';
import { HBHousingScraper } from '@/scrapers/hbhousing';

interface TestStep {
  name: string;
  duration: number;
  success: boolean;
  detail?: string;
}

interface TestPlatformResult {
  platform: string;
  success: boolean;
  totalTime: number;
  listingCount: number;
  isRealData: boolean;
  sampleListings: any[];
  steps: TestStep[];
  error?: string;
  errorStack?: string;
}

/** 判斷資料是否為模擬資料（根據特徵） */
function isMockListing(listing: HousingListing, platform: string): boolean {
  const url = listing.url || '';
  const title = listing.title || '';

  // 591 模擬資料 URL 特徵
  if (platform === '591房屋交易' && url.includes('www.591.com.tw/search/')) return true;
  // 信義房屋模擬資料 URL 特徵
  if (platform === '信義房屋' && url.includes('www.sinyi.com.tw/detail/')) return true;
  // 永慶房屋模擬資料 URL 特徵
  if (platform === '永慶房屋' && url.includes('www.yungching.com.tw/detail/')) return true;
  // 樂屋網模擬資料 URL 特徵
  if (platform === '樂屋網' && url.includes('www.rakuya.com.tw/detail/')) return true;
  // 好房網模擬資料 URL 特徵
  if (platform === '好房網' && url.includes('www.housefun.com.tw/detail/')) return true;
  // 住商不動產模擬資料 URL 特徵
  if (platform === '住商不動產' && url.includes('www.hbhousing.com.tw/detail/')) return true;

  // 檢查標題是否包含通用的模擬關鍵字
  if (
    title.includes('模擬') ||
    title.includes('mock') ||
    listing.price === 0
  ) return true;

  // 如果沒有任何 URL（空字串）也是模擬資料
  if (!url && !title) return true;

  return false;
}

/** 分析整個結果集，判斷資料是否真實 */
function isDataReal(listings: HousingListing[], platform: string): boolean {
  if (listings.length === 0) return false;
  // 如果超過一半的資料是模擬的，判定為模擬
  let mockCount = 0;
  for (const listing of listings) {
    if (isMockListing(listing, platform)) mockCount++;
  }
  return mockCount <= listings.length / 2;
}

const SCRAPERS: Record<string, new () => any> = {
  '591房屋交易': Platform591Scraper,
  '信義房屋': SinyiScraper,
  '永慶房屋': YungchingScraper,
  '樂屋網': RakuyaScraper,
  '好房網': HousefunScraper,
  '住商不動產': HBHousingScraper,
};

export const maxDuration = 60; // Vercel timeout

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform');
  const listingType = (searchParams.get('listingType') || 'sale') as SearchFilters['listingType'];
  const city = searchParams.get('city') || '台北市';

  if (!platform) {
    return NextResponse.json(
      { error: '請指定 platform 參數' },
      { status: 400 }
    );
  }

  const ScraperClass = SCRAPERS[platform];
  if (!ScraperClass) {
    return NextResponse.json(
      { error: `不支援的平台: ${platform}，可用平台: ${Object.keys(SCRAPERS).join(', ')}` },
      { status: 400 }
    );
  }

  // 記錄每個步驟的詳細資訊
  const steps: TestStep[] = [];
  const result: TestPlatformResult = {
    platform,
    success: false,
    totalTime: 0,
    listingCount: 0,
    isRealData: false,
    sampleListings: [],
    steps: [],
  };

  try {
    const scraper = new ScraperClass();
    const startTime = Date.now();

    // 第一步：初始化
    steps.push({ name: '初始化', duration: 0, success: true, detail: '爬蟲實例已建立' });

    // 第二步：執行搜尋
    const searchStart = Date.now();
    let listings: HousingListing[] = [];

    try {
      const filters: SearchFilters = {
        ...DEFAULT_FILTERS,
        listingType,
        city,
        hideSponsored: false,
      };

      listings = await scraper.search(filters);

      const searchDuration = Date.now() - searchStart;
      const isSearchReal = isDataReal(listings, platform);

      steps.push({
        name: '執行搜尋',
        duration: searchDuration,
        success: true,
        detail: `搜尋完成，取得 ${listings.length} 筆資料（${isSearchReal ? '真實' : '模擬'}）`,
      });

      result.isRealData = isSearchReal;
      result.listingCount = listings.length;

      // 取前 5 筆作為樣本
      result.sampleListings = listings.slice(0, 5).map(l => ({
        id: l.id,
        title: l.title,
        price: l.price,
        priceUnit: l.priceUnit,
        pricePerPing: l.pricePerPing,
        location: l.location,
        city: l.city,
        district: l.district,
        propertyType: l.propertyType,
        size: l.size,
        rooms: l.rooms,
        bathrooms: l.bathrooms,
        floor: l.floor,
        year: l.year,
        isSponsored: l.isSponsored,
        url: l.url,
        tags: l.tags,
        description: l.description,
      }));

      result.success = listings.length > 0;
    } catch (err) {
      const searchDuration = Date.now() - searchStart;
      steps.push({
        name: '執行搜尋',
        duration: searchDuration,
        success: false,
        detail: `搜尋拋出異常: ${(err as Error).message}`,
      });
      result.error = (err as Error).message;
      result.errorStack = (err as Error).stack;
    }

    // 第三步：清理資源
    const cleanupStart = Date.now();
    try {
      if (typeof (scraper as any).closeBrowser === 'function') {
        await (scraper as any).closeBrowser();
      }
      steps.push({ name: '清理資源', duration: Date.now() - cleanupStart, success: true });
    } catch (err) {
      steps.push({
        name: '清理資源',
        duration: Date.now() - cleanupStart,
        success: false,
        detail: (err as Error).message,
      });
    }

    result.totalTime = Date.now() - startTime;
    result.steps = steps;

    return NextResponse.json(result);
  } catch (err) {
    result.error = (err as Error).message;
    result.errorStack = (err as Error).stack;
    result.steps = steps;
    result.totalTime = steps.reduce((sum, s) => sum + s.duration, 0);
    return NextResponse.json(result);
  }
}
