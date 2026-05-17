/** 格式化價格顯示 */
export function formatPrice(price: number, unit: '萬' | '元/月'): string {
  if (unit === '萬') {
    if (price >= 10000) {
      return `${(price / 10000).toFixed(1)} 億`;
    }
    return `${price.toLocaleString()} 萬`;
  }
  // 元/月
  if (price >= 10000) {
    return `${(price / 10000).toFixed(1)} 萬/月`;
  }
  return `${price.toLocaleString()} 元/月`;
}

/** 格式化坪數 */
export function formatSize(size: number): string {
  return `${size.toFixed(1)} 坪`;
}

/** 格式化單價（萬/坪） */
export function formatPricePerPing(price: number): string {
  return `${price.toFixed(1)} 萬/坪`;
}

/** 格式化格局 */
export function formatLayout(
  rooms: number,
  livingRooms: number,
  bathrooms: number
): string {
  return `${rooms}房${livingRooms}廳${bathrooms}衛`;
}

/** 格式化屋齡 */
export function formatAge(year?: number): string {
  if (!year) return '未知';
  const age = new Date().getFullYear() - year;
  if (age <= 0) return '新成屋';
  return `${age} 年`;
}

/** 將搜尋字串轉為 URL 參數 */
export function toQueryString(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 0) {
      searchParams.set(key, String(value));
    }
  });
  return searchParams.toString();
}

/** 產生唯一 ID */
export function generateId(platform: string, index: number): string {
  return `${platform}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 從地址/位置字串中擷取縣市 */
export function extractCity(location: string): { city: string; district: string; rest: string } {
  const match = location.match(/^([臺台新高桃台基](?:北市|中市|南市|北市|中市|南市|東縣|竹市|竹縣|苗縣|彰縣|投縣|雲縣|嘉市|嘉縣|屏縣|宜縣|花縣|東縣|澎縣)?)((?:[^\s\d]+[區市鎮鄉里]?)?)\s*(.*)$/);
  if (match) {
    return {
      city: match[1].replace('臺', '台'),
      district: match[2] || '',
      rest: match[3] || '',
    };
  }
  return { city: '', district: '', rest: location };
}

/** 延遲函數 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
