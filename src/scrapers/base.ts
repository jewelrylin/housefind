import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import type { Browser, Page } from 'playwright';
import { HousingListing, SearchFilters, PlatformName } from '@/types';
import { generateId } from '@/utils/formatters';

/** 基礎爬蟲類別 - 所有平台爬蟲繼承此類別 */
export abstract class BaseScraper {
  protected client: AxiosInstance;
  protected abstract platformName: PlatformName;
  protected abstract baseUrl: string;
  public abstract enabled: boolean;
  /** Promise-based singleton：確保並行呼叫時只啟動一個瀏覽器實例 */
  private static browserPromise: Promise<Browser> | null = null;

  constructor() {
    this.client = axios.create({
      timeout: 8000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Cache-Control': 'max-age=0',
      },
    });
  }

  /** 取得平台名稱 */
  getPlatformName(): PlatformName {
    return this.platformName;
  }

  /** 各平台實作搜尋邏輯 */
  abstract search(filters: SearchFilters): Promise<HousingListing[]>;

  /** 從 HTML 解析列表 */
  abstract parseListings(html: string, filters: SearchFilters): HousingListing[];

  /** 載入 cheerio */
  protected loadHTML(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  /** 發送 GET 請求 */
  protected async fetch(url: string, extraHeaders: Record<string, string> = {}): Promise<string> {
    try {
      const defaultHeaders = this.client.defaults.headers as Record<string, string>;
      const response = await this.client.get(url, {
        headers: { ...defaultHeaders, ...extraHeaders },
      });
      return response.data;
    } catch (error) {
      console.error(`[${this.platformName}] Fetch error:`, (error as Error).message);
      throw error;
    }
  }

  /** 發送 POST 請求 (form data) */
  protected async fetchPost(
    url: string,
    data: Record<string, string>,
    extraHeaders: Record<string, string> = {}
  ): Promise<string> {
    try {
      const params = new URLSearchParams();
      Object.entries(data).forEach(([k, v]) => params.set(k, v));
      const response = await this.client.post(url, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          ...extraHeaders,
        },
      });
      return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    } catch (error) {
      console.error(`[${this.platformName}] POST error:`, (error as Error).message);
      throw error;
    }
  }

  /**
   * 取得共享的 Playwright 瀏覽器實例
   * 使用 Promise-based singleton 確保並行呼叫時只啟動一個 Chrome，
   * 所有爬蟲共用避免資源競爭。
   */
  protected async getBrowser(): Promise<Browser> {
    if (!BaseScraper.browserPromise) {
      BaseScraper.browserPromise = (async () => {
        const { chromium } = await import('playwright');
        return chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
        });
      })().catch((err) => {
        console.error(`[Browser] Failed to launch Chromium:`, (err as Error).message);
        BaseScraper.browserPromise = null;
        throw err;
      });
    }
    return BaseScraper.browserPromise;
  }

  /**
   * 使用 Playwright 獲取頁面內容（處理 SPA / Cloudflare）
   * @param waitForSelector 等待此 selector 出現後再回傳 HTML
   * @param waitTimeout selector 等待逾時 (ms)，預設 5000；Cloudflare 通常需要 ≥10000
   */
  protected async fetchWithBrowser(url: string, waitForSelector?: string, waitTimeout = 5000): Promise<string> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'zh-TW',
      timezoneId: 'Asia/Taipei',
    });

    const page = await context.newPage();
    try {
      // domcontentloaded 比 load 更快，Cloudflare 挑戰時 load 可能永遠不觸發
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

      // 等待特定選擇器或等待載入完成
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: waitTimeout }).catch(() => {});
      } else {
        // 等待至少 1.5 秒讓 JavaScript 執行完成
        await page.waitForTimeout(1500);
      }

      const content = await page.content();
      return content;
    } finally {
      await page.close();
      await context.close();
    }
  }

  /** 使用 Playwright 獲取 API JSON 回應（攔截 XHR） */
  protected async fetchApiWithBrowser(
    url: string,
    apiPattern: string
  ): Promise<any> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'zh-TW',
      timezoneId: 'Asia/Taipei',
    });

    const page = await context.newPage();
    try {
      // 攔截 API 回應
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(apiPattern) &&
          response.status() === 200 &&
          response.headers()['content-type']?.includes('json')
      );

      await page.goto(url, { waitUntil: 'load', timeout: 15000 }).catch(() => {});

      const apiResponse = await responsePromise;
      const jsonData = await apiResponse.json();
      return jsonData;
    } finally {
      await page.close();
      await context.close();
    }
  }

  /** 關閉共享瀏覽器 */
  static async closeSharedBrowser(): Promise<void> {
    if (BaseScraper.browserPromise) {
      const browser = await BaseScraper.browserPromise;
      await browser.close();
      BaseScraper.browserPromise = null;
    }
  }

  /** 從 HTML 中提取 JSON-LD 結構化資料 */
  protected extractJSONLD($: cheerio.CheerioAPI): any[] {
    const results: any[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        results.push(data);
      } catch {}
    });
    return results;
  }

  /** 嘗試解析 Nuxt.js __NUXT__ 嵌入資料 */
  protected parseNuxtData<T = any>(html: string): T | null {
    const patterns = [
      /<script[^>]*>window\.__NUXT__\s*=\s*(\{[^;]+\})<\/script>/,
      /<script[^>]*>window\.__NUXT__\s*=\s*(\{[^<]+\})<\/script>/,
      /__NUXT__\s*=\s*(\{[^;]+\})/,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          return JSON.parse(match[1]);
        } catch {}
      }
    }
    return null;
  }

  /** 嘗試解析 Next.js __NEXT_DATA__ 嵌入資料 */
  protected parseNextData<T = any>(html: string): T | null {
    const match = html.match(
      /<script id="__NEXT_DATA__"[^>]*type="application\/json">([^<]+)<\/script>/
    );
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }

  /** 安全地獲取巢狀物件值 */
  protected getNestedValue(obj: any, keys: string[]): any {
    let current = obj;
    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      current = current[key];
    }
    return current;
  }

  /** 遞迴搜尋物件中符合條件的陣列（用於自動探索 SSR 資料結構） */
  protected findListingArrays(
    obj: any,
    maxDepth = 4,
    path = '',
    depth = 0
  ): { path: string; data: any[] }[] {
    const results: { path: string; data: any[] }[] = [];
    if (depth > maxDepth || typeof obj !== 'object' || obj === null) return results;

    for (const [k, v] of Object.entries(obj)) {
      const cp = path ? `${path}.${k}` : k;
      if (Array.isArray(v) && v.length > 0 && v.length < 300 && typeof v[0] === 'object') {
        const sampleKeys = Object.keys(v[0]);
        if (sampleKeys.some(key =>
          ['price', 'totalPrice', 'name', 'address', 'area', 'title', 'layout', 'houseNo'].includes(key)
        )) {
          results.push({ path: cp, data: v });
        }
      }
      if (typeof v === 'object' && !Array.isArray(v)) {
        const subResults = this.findListingArrays(v, maxDepth, cp, depth + 1);
        results.push(...subResults);
      }
    }

    return results;
  }

  /** 檢查是否為置頂廣告 */
  protected isSponsored($el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): boolean {
    const html = $.html($el).toLowerCase();
    const indicators = [
      '置頂', '廣告', 'vip', 'top', 'featured', 'sponsored',
      'highlight', 'premium', 'promoted', 'hot',
    ];
    return indicators.some((indicator) => html.includes(indicator));
  }

  /** 建立標準化的 HousingListing */
  protected createListing(data: Partial<HousingListing> & { index: number }): HousingListing {
    return {
      id: generateId(this.platformName, data.index),
      title: data.title || '',
      price: data.price || 0,
      priceUnit: data.priceUnit || '萬',
      location: data.location || '',
      city: data.city || '',
      district: data.district || '',
      propertyType: data.propertyType || '大樓',
      size: data.size || 0,
      rooms: data.rooms || 0,
      livingRooms: data.livingRooms ?? 1,
      bathrooms: data.bathrooms || 1,
      listingType: data.listingType || 'sale',
      isSponsored: data.isSponsored ?? false,
      platform: this.platformName,
      url: data.url || '',
      ...data,
    };
  }

  /** 解析數字（處理 "萬", "坪", 逗號等） */
  protected parseNumber(text: string): number {
    const cleaned = text
      .replace(/[,，\s]/g, '')
      .replace(/萬/g, '0000')
      .replace(/億/g, '00000000')
      .replace(/坪/g, '')
      .replace(/元/g, '')
      .replace(/月/g, '')
      .replace(/NT\$?/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /** 從完整地址中提取縣市與行政區 */
  protected extractLocation(address: string): { city: string; district: string; rest: string } {
    // 台灣縣市正則
    const match = address.match(
      /^([臺台新桃台基高][北中中南東雄]?[市縣]?)?([\u4e00-\u9fff]+[區市鎮鄉]?)?\s*(.*)$/
    );
    return {
      city: match?.[1]?.replace('臺', '台') || '',
      district: match?.[2] || '',
      rest: match?.[3] || address,
    };
  }
}
