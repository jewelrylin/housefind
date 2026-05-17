// ====== 房屋搜尋平台統一型別定義 ======

/** 交易類型 */
export type ListingType = 'sale' | 'rent' | 'new';

/** 房屋類型 */
export type PropertyType =
  | '公寓'
  | '大樓'
  | '華廈'
  | '透天'
  | '別墅'
  | '店面'
  | '土地'
  | '辦公'
  | '套房'
  | '車位';

/** 支援的房仲平台 */
export type PlatformName =
  | '591房屋交易'
  | '信義房屋'
  | '永慶房屋'
  | '樂屋網'
  | '好房網'
  | '住商不動產';

/** 平台狀態 */
export interface PlatformStatus {
  name: PlatformName;
  icon: string;
  enabled: boolean;
  resultsCount: number;
  error?: string;
  isRealData?: boolean;     // 是否為真實爬蟲資料（非模擬資料）
  searchTime?: number;      // 該平台搜尋耗時(ms)
}

/** 單筆房屋列表資料 */
export interface HousingListing {
  id: string;
  title: string;
  price: number;
  priceUnit: '萬' | '元/月';
  pricePerPing?: number;       // 單價（萬/坪）
  location: string;
  city: string;
  district: string;
  address?: string;
  propertyType: PropertyType;
  size: number;                // 坪數
  rooms: number;               // 房
  livingRooms: number;         // 廳
  bathrooms: number;           // 衛
  floor?: string;              // e.g. "3/12"
  year?: number;               // 屋齡（年）
  listingType: ListingType;
  isSponsored: boolean;        // 是否為置頂/付費廣告
  platform: PlatformName;
  url: string;
  imageUrl?: string;
  images?: string[];
  description?: string;
  tags?: string[];
  postedDays?: number;         // 刊登天數
  contact?: string;

  /** 地理座標（經緯度） */
  lat?: number;
  lng?: number;
}

/** 搜尋過濾條件 */
export interface SearchFilters {
  listingType: ListingType;
  keyword: string;
  city: string;
  districts: string[];
  minPrice: number;
  maxPrice: number;
  minSize: number;
  maxSize: number;
  rooms: number;               // 0 = 不限
  propertyTypes: PropertyType[];
  hideSponsored: boolean;
  platforms: PlatformName[];
  sortBy: 'default' | 'price_asc' | 'price_desc' | 'size_desc' | 'newest';
}

/** 搜尋結果 */
export interface SearchResult {
  listings: HousingListing[];
  platforms: PlatformStatus[];
  totalCount: number;
  filteredCount: number;
  sponsoredCount: number;
  searchTime: number;          // ms
  filters: SearchFilters;
}

/** 預設搜尋過濾條件 */
export const DEFAULT_FILTERS: SearchFilters = {
  listingType: 'sale',
  keyword: '',
  city: '',
  districts: [],
  minPrice: 0,
  maxPrice: 0,
  minSize: 0,
  maxSize: 0,
  rooms: 0,
  propertyTypes: [],
  hideSponsored: true,
  platforms: [],
  sortBy: 'default',
};

/** 台灣縣市列表 */
export const TAIWAN_CITIES = [
  '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市',
  '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '台東縣', '澎湖縣', '金門縣', '連江縣',
];

/** 各縣市行政區 */
export const TAIWAN_DISTRICTS: Record<string, string[]> = {
  '台北市': [
    '中正區', '大同區', '中山區', '松山區', '大安區', '萬華區',
    '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區',
  ],
  '新北市': [
    '板橋區', '三重區', '中和區', '永和區', '新莊區', '新店區',
    '土城區', '蘆洲區', '樹林區', '汐止區', '鶯歌區', '三峽區',
    '淡水區', '瑞芳區', '五股區', '泰山區', '林口區', '深坑區',
    '八里區', '金山區', '萬里區',
  ],
  '桃園市': [
    '桃園區', '中壢區', '平鎮區', '八德區', '楊梅區', '蘆竹區',
    '大溪區', '龍潭區', '龜山區', '大園區', '觀音區', '新屋區',
    '復興區',
  ],
  '台中市': [
    '中區', '東區', '南區', '西區', '北區', '北屯區', '西屯區',
    '南屯區', '豐原區', '大里區', '太平區', '清水區', '沙鹿區',
    '大甲區', '東勢區', '梧棲區', '烏日區', '神岡區', '大肚區',
    '龍井區', '霧峰區', '潭子區', '大雅區', '新社區', '石岡區',
    '后里區',
  ],
  '台南市': [
    '中西區', '東區', '南區', '北區', '安平區', '安南區',
    '永康區', '歸仁區', '新化區', '仁德區', '關廟區', '善化區',
    '新市區', '安定區',
  ],
  '高雄市': [
    '鹽埕區', '鼓山區', '左營區', '楠梓區', '三民區', '新興區',
    '前金區', '苓雅區', '前鎮區', '旗津區', '小港區', '鳳山區',
    '大寮區', '大樹區', '大社區', '仁武區', '鳥松區', '岡山區',
    '橋頭區', '路竹區', '湖內區',
  ],
  '基隆市': ['仁愛區', '信義區', '中正區', '中山區', '安樂區', '暖暖區', '七堵區'],
  '新竹市': ['東區', '北區', '香山區'],
  '新竹縣': ['竹北市', '竹東鎮', '新埔鎮', '關西鎮', '湖口鄉', '新豐鄉'],
  '苗栗縣': ['苗栗市', '頭份市', '竹南鎮', '通霄鎮', '苑裡鎮'],
  '彰化縣': ['彰化市', '員林市', '鹿港鎮', '和美鎮', '北斗鎮'],
  '南投縣': ['南投市', '埔里鎮', '草屯鎮', '竹山鎮', '集集鎮'],
  '雲林縣': ['斗六市', '虎尾鎮', '西螺鎮', '土庫鎮', '北港鎮'],
  '嘉義市': ['東區', '西區'],
  '嘉義縣': ['太保市', '朴子市', '布袋鎮', '民雄鄉'],
  '屏東縣': ['屏東市', '潮州鎮', '東港鎮', '恆春鎮'],
  '宜蘭縣': ['宜蘭市', '羅東鎮', '蘇澳鎮', '頭城鎮', '礁溪鄉'],
  '花蓮縣': ['花蓮市', '鳳林鎮', '玉里鎮', '新城鄉', '吉安鄉'],
  '台東縣': ['台東市', '成功鎮', '關山鎮'],
  '澎湖縣': ['馬公市', '湖西鄉'],
  '金門縣': ['金城鎮', '金湖鎮', '金沙鎮'],
  '連江縣': ['南竿鄉', '北竿鄉'],
};

/** 平台配置 */
export interface PlatformConfig {
  name: PlatformName;
  icon: string;
  color: string;
  searchUrl: string;
  enabled: boolean;
  priority: number;
}
