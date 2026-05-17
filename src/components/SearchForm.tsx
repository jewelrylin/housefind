'use client';

import { useState, useCallback } from 'react';
import { SearchFilters, TAIWAN_CITIES, TAIWAN_DISTRICTS, PlatformName, ListingType, PropertyType } from '@/types';

interface SearchFormProps {
  filters: SearchFilters;
  onSearch: (filters: SearchFilters) => void;
  isLoading: boolean;
}

const LISTING_TYPES: { value: ListingType; label: string; icon: string }[] = [
  { value: 'sale', label: '中古屋買賣', icon: '🏠' },
  { value: 'new', label: '新成屋', icon: '🏗️' },
  { value: 'rent', label: '租屋', icon: '🔑' },
];

const PROPERTY_TYPES: PropertyType[] = ['公寓', '大樓', '華廈', '透天', '整層住家', '別墅', '店面', '套房'];

const PLATFORMS: { name: PlatformName; icon: string }[] = [
  { name: '591房屋交易', icon: '🏠' },
  { name: '信義房屋', icon: '🔵' },
  { name: '永慶房屋', icon: '🟢' },
  { name: '樂屋網', icon: '🎵' },
  { name: '好房網', icon: '🏡' },
  { name: '住商不動產', icon: '🏢' },
];

const ROOM_OPTIONS = [
  { value: 0, label: '不限' },
  { value: 1, label: '1房以上' },
  { value: 2, label: '2房以上' },
  { value: 3, label: '3房以上' },
  { value: 4, label: '4房以上' },
  { value: 5, label: '5房以上' },
];

export function SearchForm({ filters, onSearch, isLoading }: SearchFormProps) {
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const districts = localFilters.city ? TAIWAN_DISTRICTS[localFilters.city] || [] : [];

  const toggleListingType = useCallback((type: ListingType) => {
    setLocalFilters(prev => ({ ...prev, listingType: type }));
  }, []);

  const togglePlatform = useCallback((name: PlatformName) => {
    setLocalFilters(prev => {
      const platforms = prev.platforms.includes(name)
        ? prev.platforms.filter(p => p !== name)
        : [...prev.platforms, name];
      return { ...prev, platforms };
    });
  }, []);

  const togglePropertyType = useCallback((type: PropertyType) => {
    setLocalFilters(prev => {
      const types = prev.propertyTypes.includes(type)
        ? prev.propertyTypes.filter(t => t !== type)
        : [...prev.propertyTypes, type];
      return { ...prev, propertyTypes: types };
    });
  }, []);

  const toggleDistrict = useCallback((district: string) => {
    setLocalFilters(prev => {
      const districts = prev.districts.includes(district)
        ? prev.districts.filter(d => d !== district)
        : [...prev.districts, district];
      return { ...prev, districts };
    });
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSearch(localFilters);
  }, [localFilters, onSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSearch(localFilters);
    }
  }, [localFilters, onSearch]);

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="space-y-4">
        {/* 交易類型切換 */}
        <div className="flex items-center gap-2 rounded-2xl bg-gray-100 p-1.5">
          {LISTING_TYPES.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleListingType(value)}
              className={`
                flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium
                transition-all duration-200
                ${localFilters.listingType === value
                  ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <span className="text-lg">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* 主要搜尋列 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="輸入關鍵字搜尋（例如：捷運、學區、社區名稱...）"
              value={localFilters.keyword}
              onChange={e => setLocalFilters(prev => ({ ...prev, keyword: e.target.value }))}
              onKeyDown={handleKeyDown}
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          {/* 縣市選擇 */}
          <div className="min-w-[140px]">
            <select
              value={localFilters.city}
              onChange={e => setLocalFilters(prev => ({ ...prev, city: e.target.value, districts: [] }))}
              className="w-full rounded-xl border border-gray-200 bg-white py-3 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer"
            >
              <option value="">全台</option>
              {TAIWAN_CITIES.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
          >
            {isLoading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>搜尋中...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <span>搜尋</span>
              </>
            )}
          </button>
        </div>

        {/* 進階過濾切換 */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
          進階過濾
          {(localFilters.minPrice > 0 || localFilters.maxPrice > 0 || localFilters.minSize > 0 || localFilters.rooms > 0 || localFilters.districts.length > 0) && (
            <span className="flex h-2 w-2 rounded-full bg-blue-500" />
          )}
        </button>

        {/* 進階過濾面板 */}
        {showAdvanced && (
          <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-5 space-y-5 animate-fadeIn">
            {/* 價格區間 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">
                {localFilters.listingType === 'rent' ? '租金範圍（元/月）' : '價格範圍（萬）'}
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    placeholder="最低"
                    value={localFilters.minPrice || ''}
                    onChange={e => setLocalFilters(prev => ({ ...prev, minPrice: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <span className="text-gray-400 text-sm">~</span>
                <div className="relative flex-1">
                  <input
                    type="number"
                    placeholder="最高"
                    value={localFilters.maxPrice || ''}
                    onChange={e => setLocalFilters(prev => ({ ...prev, maxPrice: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            {/* 坪數與房數 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">坪數範圍</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    placeholder="最小"
                    value={localFilters.minSize || ''}
                    onChange={e => setLocalFilters(prev => ({ ...prev, minSize: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="text-gray-400 text-sm">~</span>
                  <input
                    type="number"
                    placeholder="最大"
                    value={localFilters.maxSize || ''}
                    onChange={e => setLocalFilters(prev => ({ ...prev, maxSize: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">最少房間數</label>
                <select
                  value={localFilters.rooms}
                  onChange={e => setLocalFilters(prev => ({ ...prev, rooms: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {ROOM_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 行政區選擇 */}
            {localFilters.city && districts.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">行政區（可複選）</label>
                <div className="flex flex-wrap gap-1.5">
                  {districts.map(district => (
                    <button
                      key={district}
                      type="button"
                      onClick={() => toggleDistrict(district)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        localFilters.districts.includes(district)
                          ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                          : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {district}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 房屋類型 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">房屋類型（可複選）</label>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => togglePropertyType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      localFilters.propertyTypes.includes(type)
                        ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                        : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* 平台選擇 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">搜尋平台（點擊切換）</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(({ name, icon }) => {
                  const isSelected = localFilters.platforms.length === 0 || localFilters.platforms.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => togglePlatform(name)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-white text-gray-700 ring-1 ring-gray-200 shadow-sm'
                          : 'bg-gray-100 text-gray-400 ring-1 ring-gray-100 line-through'
                      }`}
                    >
                      <span>{icon}</span>
                      <span>{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 排序與過濾選項 */}
            <div className="flex items-center flex-wrap gap-y-3 justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localFilters.hideSponsored}
                  onChange={e => setLocalFilters(prev => ({ ...prev, hideSponsored: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-medium text-gray-600">過濾不符合條件的置頂廣告</span>
              </label>

              <select
                value={localFilters.sortBy}
                onChange={e => setLocalFilters(prev => ({ ...prev, sortBy: e.target.value as SearchFilters['sortBy'] }))}
                className="rounded-lg border border-gray-200 bg-white py-1.5 px-2.5 text-xs text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="default">預設排序</option>
                <option value="price_asc">價格低至高</option>
                <option value="price_desc">價格高至低</option>
                <option value="size_desc">坪數大至小</option>
                <option value="newest">最新刊登</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
