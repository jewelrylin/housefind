import { PropertyType, TAIWAN_DISTRICTS } from '@/types';

/** 判斷房屋類型 */
export function detectPropertyType(text: string): PropertyType {
  if (text.includes('套房') || text.includes('套')) return '套房';
  if (text.includes('透天')) return '透天';
  if (text.includes('別墅') || text.includes('別莊')) return '別墅';
  if (text.includes('公寓')) return '公寓';
  if (text.includes('華廈')) return '華廈';
  if (text.includes('店面') || text.includes('店鋪')) return '店面';
  if (text.includes('辦公') || text.includes('商辦')) return '辦公';
  if (text.includes('土地')) return '土地';
  if (text.includes('大樓') || text.includes('電梯')) return '大樓';
  return '大樓';
}

/** 取隨機行政區 */
export function getRandomDistrict(city?: string): string {
  if (!city) return '大安區';
  const districts = TAIWAN_DISTRICTS[city];
  if (!districts || districts.length === 0) return '大安區';
  return districts[Math.floor(Math.random() * districts.length)];
}
