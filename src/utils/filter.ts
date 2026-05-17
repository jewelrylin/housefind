import { HousingListing, SearchFilters } from '@/types';

/**
 * 過濾不符合使用者條件的置頂廣告物件
 * 
 * 房仲平台的置頂廣告（贊助物件）通常會出現在搜尋結果最前面，
 * 但這些物件可能不完全符合使用者的搜尋條件（例如價格範圍、坪數等）。
 * 此函數會判斷置頂廣告是否符合所有搜尋條件，若不符合則將其過濾掉。
 */
export function filterSponsoredListings(
  listings: HousingListing[],
  filters: SearchFilters
): HousingListing[] {
  return listings.filter((listing) => {
    // 如果使用者選擇隱藏所有置頂廣告，直接過濾掉
    if (filters.hideSponsored && listing.isSponsored) {
      return false;
    }

    // 如果使用者不隱藏置頂廣告，但我們仍要確保置頂廣告符合搜尋條件
    if (listing.isSponsored) {
      return isListingMatchFilters(listing, filters);
    }

    return true;
  });
}

/**
 * 檢查單一列表是否符合所有搜尋過濾條件
 */
export function isListingMatchFilters(
  listing: HousingListing,
  filters: SearchFilters
): boolean {
  // 關鍵字比對（標題或描述中包含關鍵字）
  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase();
    const titleMatch = listing.title.toLowerCase().includes(keyword);
    const descMatch = listing.description?.toLowerCase().includes(keyword) ?? false;
    const locationMatch = listing.location.toLowerCase().includes(keyword);
    if (!titleMatch && !descMatch && !locationMatch) {
      return false;
    }
  }

  // 縣市比對
  if (filters.city && listing.city !== filters.city) {
    return false;
  }

  // 行政區比對
  if (filters.districts.length > 0 && !filters.districts.includes(listing.district)) {
    return false;
  }

  // 最低價格比對
  if (filters.minPrice > 0 && listing.price < filters.minPrice) {
    return false;
  }

  // 最高價格比對
  if (filters.maxPrice > 0 && listing.price > filters.maxPrice) {
    return false;
  }

  // 最小坪數比對
  if (filters.minSize > 0 && listing.size < filters.minSize) {
    return false;
  }

  // 最大坪數比對
  if (filters.maxSize > 0 && listing.size > filters.maxSize) {
    return false;
  }

  // 房間數比對（0 表示不限）
  if (filters.rooms > 0 && listing.rooms < filters.rooms) {
    return false;
  }

  // 房屋類型比對
  if (filters.propertyTypes.length > 0 && !filters.propertyTypes.includes(listing.propertyType)) {
    return false;
  }

  return true;
}

/**
 * 根據排序條件排序列表
 */
export function sortListings(
  listings: HousingListing[],
  sortBy: SearchFilters['sortBy']
): HousingListing[] {
  const sorted = [...listings];

  switch (sortBy) {
    case 'price_asc':
      sorted.sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      sorted.sort((a, b) => b.price - a.price);
      break;
    case 'size_desc':
      sorted.sort((a, b) => b.size - a.size);
      break;
    case 'newest':
      sorted.sort((a, b) => (b.postedDays ?? 999) - (a.postedDays ?? 999));
      break;
    default:
      // 非置頂廣告優先，再依價格排序
      sorted.sort((a, b) => {
        if (a.isSponsored !== b.isSponsored) {
          return a.isSponsored ? 1 : -1;
        }
        return a.price - b.price;
      });
  }

  return sorted;
}


