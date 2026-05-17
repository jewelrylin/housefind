/**
 * 地理編碼工具 - 使用 Nominatim (OpenStreetMap 免費 API)
 * 將台灣地址轉換為經緯度座標
 */

interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
  importance: number;
}

/** 台灣各縣市的主要中心座標（備援用） */
const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  '台北市': { lat: 25.0375, lng: 121.5637 },
  '新北市': { lat: 25.0169, lng: 121.4628 },
  '桃園市': { lat: 24.9937, lng: 121.3010 },
  '台中市': { lat: 24.1477, lng: 120.6736 },
  '台南市': { lat: 22.9997, lng: 120.2270 },
  '高雄市': { lat: 22.6273, lng: 120.3014 },
  '基隆市': { lat: 25.1276, lng: 121.7392 },
  '新竹市': { lat: 24.8138, lng: 120.9675 },
  '新竹縣': { lat: 24.8278, lng: 121.0092 },
  '苗栗縣': { lat: 24.5602, lng: 120.8229 },
  '彰化縣': { lat: 24.0758, lng: 120.5341 },
  '南投縣': { lat: 23.8398, lng: 120.9858 },
  '雲林縣': { lat: 23.7209, lng: 120.5214 },
  '嘉義市': { lat: 23.4800, lng: 120.4491 },
  '嘉義縣': { lat: 23.4518, lng: 120.2559 },
  '屏東縣': { lat: 22.5519, lng: 120.5488 },
  '宜蘭縣': { lat: 24.6929, lng: 121.7195 },
  '花蓮縣': { lat: 23.9871, lng: 121.6100 },
  '台東縣': { lat: 22.7547, lng: 121.1202 },
  '澎湖縣': { lat: 23.5711, lng: 119.5793 },
  '金門縣': { lat: 24.4497, lng: 118.3767 },
  '連江縣': { lat: 26.1505, lng: 119.9483 },
};

/** 各行政區的概略中心座標（更精細的備援） */
const DISTRICT_CENTERS: Record<string, { lat: number; lng: number }> = {
  // 台北市
  '大安區': { lat: 25.0264, lng: 121.5434 },
  '信義區': { lat: 25.0330, lng: 121.5645 },
  '中山區': { lat: 25.0711, lng: 121.5363 },
  '中正區': { lat: 25.0324, lng: 121.5195 },
  '松山區': { lat: 25.0525, lng: 121.5597 },
  '萬華區': { lat: 25.0366, lng: 121.5007 },
  '大同區': { lat: 25.0625, lng: 121.5145 },
  '士林區': { lat: 25.0926, lng: 121.5253 },
  '北投區': { lat: 25.1325, lng: 121.5172 },
  '內湖區': { lat: 25.0687, lng: 121.5875 },
  '南港區': { lat: 25.0375, lng: 121.6058 },
  '文山區': { lat: 24.9912, lng: 121.5623 },
  // 新北市
  '板橋區': { lat: 25.0111, lng: 121.4644 },
  '三重區': { lat: 25.0606, lng: 121.4894 },
  '中和區': { lat: 24.9990, lng: 121.4990 },
  '永和區': { lat: 25.0086, lng: 121.5186 },
  '新莊區': { lat: 25.0389, lng: 121.4472 },
  '新店區': { lat: 24.9500, lng: 121.5417 },
  '土城區': { lat: 24.9878, lng: 121.4433 },
  '蘆洲區': { lat: 25.0872, lng: 121.4722 },
  '汐止區': { lat: 25.0717, lng: 121.6464 },
  '淡水區': { lat: 25.1783, lng: 121.4442 },
  '林口區': { lat: 25.0817, lng: 121.3944 },
  // 台中市
  '西屯區': { lat: 24.1778, lng: 120.6417 },
  '北屯區': { lat: 24.1833, lng: 120.7333 },
  '南屯區': { lat: 24.1389, lng: 120.6361 },
  // 高雄市
  '左營區': { lat: 22.6833, lng: 120.3000 },
  '鼓山區': { lat: 22.6444, lng: 120.2833 },
  '三民區': { lat: 22.6500, lng: 120.3333 },
  '鳳山區': { lat: 22.6250, lng: 120.3500 },
  // 桃園市
  '桃園區': { lat: 25.0000, lng: 121.3083 },
  '中壢區': { lat: 24.9667, lng: 121.2167 },
};

/** 快取已查過的地址經緯度 */
const geocodeCache = new Map<string, GeocodeResult>();

/**
 * 使用 Nominatim API 將地址轉換為經緯度
 * 限制：每秒最多 1 個請求（Nominatim 使用規範）
 */
async function nominatimGeocode(address: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    address + ' 台灣'
  )}&limit=1&accept-language=zh`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HouseFind/1.0 (Taiwan Housing Search)',
        'Accept-Language': 'zh-TW,zh;q=0.9',
      },
    });

    if (!response.ok) return null;

    const data: NominatimResponse[] = await response.json();
    if (!data || data.length === 0) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch {
    return null;
  }
}

/**
 * 從快取或已知的行政區中心取得座標
 * 這是快速的備援方式，不需 API 呼叫
 */
function getFallbackCoords(city: string, district: string, location: string): { lat: number; lng: number } | null {
  // 先試行政區
  const districtKey = `${city}${district}`;
  for (const [key, coords] of Object.entries(DISTRICT_CENTERS)) {
    if (district.includes(key) || districtKey.includes(key)) {
      return coords;
    }
  }

  // 再試城市
  for (const [key, coords] of Object.entries(CITY_CENTERS)) {
    if (city.includes(key) || key.includes(city)) {
      return coords;
    }
  }

  // 最後從 location 字串中猜
  for (const [key, coords] of Object.entries(CITY_CENTERS)) {
    if (location.includes(key)) {
      return coords;
    }
  }

  return null;
}

/**
 * 將地址轉換為經緯度座標
 * 先檢查快取，再嘗試 Nominatim API，最後使用備援座標
 */
export async function geocodeAddress(
  address: string,
  city: string,
  district: string
): Promise<{ lat: number; lng: number } | null> {
  // 快取檢查
  const cacheKey = `${city}|${district}|${address}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached) return { lat: cached.lat, lng: cached.lng };

  // 嘗試 Nominatim（限速 1 req/sec）
  const result = await nominatimGeocode(`${city} ${district} ${address}`);
  if (result) {
    geocodeCache.set(cacheKey, result);
    return { lat: result.lat, lng: result.lng };
  }

  // 用城市+行政區再試一次
  const result2 = await nominatimGeocode(`${city} ${district}`);
  if (result2) {
    geocodeCache.set(cacheKey, result2);
    return { lat: result2.lat, lng: result2.lng };
  }

  // 備援：從已知行政區中心取得座標
  const fallback = getFallbackCoords(city, district, address);
  if (fallback) {
    geocodeCache.set(cacheKey, { lat: fallback.lat, lng: fallback.lng, displayName: '' });
    return fallback;
  }

  // 最後備援：台北101
  return { lat: 25.0339, lng: 121.5645 };
}


