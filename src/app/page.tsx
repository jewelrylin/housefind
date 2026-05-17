'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { SearchFilters, SearchResult, HousingListing, DEFAULT_FILTERS } from '@/types';
import { CostCalculator } from '@/components/CostCalculator';
import { Header } from '@/components/Header';
import { SearchForm } from '@/components/SearchForm';
import { StatsBar } from '@/components/StatsBar';
import { ResultsGrid } from '@/components/ResultsGrid';
import dynamic from 'next/dynamic';
import { geocodeAddress } from '@/utils/geocoding';

const MapView = dynamic(() => import('@/components/MapView').then(m => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <span className="text-xs text-gray-400">載入地圖中...</span>
      </div>
    </div>
  ),
});
import 'leaflet/dist/leaflet.css';

type ViewMode = 'grid' | 'map';

export default function Home() {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [costCalcListing, setCostCalcListing] = useState<HousingListing | null>(null);
  const lastSearchTime = useRef(0);

  // 為搜尋結果加入地理座標
  const geocodeListings = useCallback(async (listings: HousingListing[]) => {
    const listingsNeedingGeocode = listings.filter(l => !l.lat || !l.lng);
    if (listingsNeedingGeocode.length === 0) return;

    setIsGeocoding(true);
    try {
      // 分批進行地理編碼（避免 Nominatim 限流）
      const batchSize = 3;
      for (let i = 0; i < listingsNeedingGeocode.length; i += batchSize) {
        const batch = listingsNeedingGeocode.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(async (listing) => {
            const coords = await geocodeAddress(
              listing.address || listing.location,
              listing.city,
              listing.district
            );
            if (coords) {
              listing.lat = coords.lat;
              listing.lng = coords.lng;
            }
          })
        );
        // Nominatim 限速：每秒最多 1 請求
        if (i + batchSize < listingsNeedingGeocode.length) {
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      }

      // 觸發 re-render
      setResult(prev => prev ? { ...prev } : null);
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  // 當搜尋結果變更時，自動進行地理編碼
  useEffect(() => {
    if (result && result.listings.length > 0) {
      const now = Date.now();
      if (now - lastSearchTime.current > 1000) {
        lastSearchTime.current = now;
        geocodeListings(result.listings);
      }
    }
  }, [result, geocodeListings]);

  const handleSearch = useCallback(async (newFilters: SearchFilters) => {
    setIsLoading(true);
    setError(null);
    setFilters(newFilters);
    setSelectedListingId(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFilters),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '搜尋失敗');
      }

      const data: SearchResult = await response.json();
      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '發生未知錯誤';
      setError(message);
      console.error('Search failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectListing = useCallback((id: string) => {
    setSelectedListingId(prev => prev === id ? null : id);
    setViewMode('map');
  }, []);

  const handleCalculateCost = useCallback((listing: HousingListing) => {
    setCostCalcListing(listing);
  }, []);

  const listingsWithCoords = useMemo(() => {
    if (!result) return [];
    const withCoords = result.listings.filter(l => l.lat && l.lng);
    return withCoords;
  }, [result]);

  const geocodeProgress = useMemo(() => {
    if (!result || result.listings.length === 0) return null;
    const geocoded = result.listings.filter(l => l.lat && l.lng).length;
    if (geocoded === result.listings.length) return null;
    if (geocoded === 0 && isGeocoding) return '正在取得地理座標...';
    if (geocoded > 0 && isGeocoding) return `已定位 ${geocoded}/${result.listings.length} 個物件...`;
    return null;
  }, [result, isGeocoding]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Hero 搜尋區 */}
        <div className="relative -mx-4 sm:-mx-6 lg:-mx-8">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none" />
          <div className="relative px-4 sm:px-6 lg:px-8 pt-8 pb-6 sm:pt-12 sm:pb-10">
            <div className="max-w-4xl mx-auto text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-2">
                全台房市一站搜尋
              </h2>
              <p className="text-sm sm:text-base text-gray-500">
                整合 6 大房仲平台 × 自動過濾置頂廣告 × 精準配對理想物件
              </p>
            </div>
            <div className="max-w-4xl mx-auto">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-blue-500/5 ring-1 ring-gray-200/50 p-4 sm:p-6">
                <SearchForm
                  filters={filters}
                  onSearch={handleSearch}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 搜尋結果區 */}
        <div className="pb-16">
          {/* 統計資訊與視圖切換 */}
          <div className="border-b border-gray-100 mb-6">
            <div className="flex items-center justify-between gap-4">
              <StatsBar result={result} isLoading={isLoading} />

              {/* 視圖切換按鈕 */}
              {result && result.listings.length > 0 && (
                <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1 shrink-0">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      viewMode === 'grid'
                        ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                    <span>方格</span>
                  </button>
                  <button
                    onClick={() => setViewMode('map')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      viewMode === 'map'
                        ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                    </svg>
                    <span>地圖</span>
                    {isGeocoding && (
                      <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* 地理編碼進度提示 */}
            {geocodeProgress && (
              <div className="flex items-center gap-2 pb-2">
                <div className="h-1.5 w-full max-w-[200px] bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{
                      width: result ? `${((result.listings.filter(l => l.lat && l.lng).length) / result.listings.length) * 100}%` : '0%',
                    }}
                  />
                </div>
                <span className="text-xs text-gray-400">{geocodeProgress}</span>
              </div>
            )}
          </div>

          {/* 錯誤訊息 */}
          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <svg className="h-5 w-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">搜尋錯誤</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* 空狀態 */}
          {!isLoading && !result && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 mb-6">
                <svg className="h-12 w-12 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">開始搜尋您的理想家園</h3>
              <p className="text-sm text-gray-500 max-w-md">
                選擇交易類型、輸入關鍵字與區域，我們將自動從 591、信義、永慶、樂屋、好房、住商等平台為您蒐集房源
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                {['🏠 591', '🔵 信義', '🟢 永慶', '🎵 樂屋', '🏡 好房', '🏢 住商'].map((text, i) => (
                  <span key={i} className="inline-flex items-center px-3 py-1.5 rounded-full bg-white text-xs font-medium text-gray-600 ring-1 ring-gray-200 shadow-sm">
                    {text}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 結果列表 / 地圖 */}
          {result && (
            <>
              {viewMode === 'grid' ? (
                <ResultsGrid
                  result={result}
                  isLoading={isLoading}
                  onSelectListing={handleSelectListing}
                  onCalculateCost={handleCalculateCost}
                />
              ) : (
                <div className="space-y-4">
                  {/* 地圖 + 側邊列表 */}
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* 地圖 */}
                    <div className="lg:flex-1 min-h-[500px] lg:min-h-[600px]">
                      <MapView
                        listings={result.listings}
                        selectedId={selectedListingId}
                        onSelectListing={handleSelectListing}
                        className="h-full"
                      />
                    </div>

                    {/* 側邊列表（地圖模式時顯示精簡版清單） */}
                    <div className="lg:w-80 xl:w-96 space-y-3 max-h-[600px] overflow-y-auto pr-1">
                      <h3 className="text-sm font-semibold text-gray-700 sticky top-0 bg-gradient-to-b from-gray-50 to-gray-50/80 backdrop-blur-sm py-2 z-10">
                        {result.listings.length} 筆物件
                        {listingsWithCoords.length < result.listings.length && (
                          <span className="text-xs font-normal text-gray-400 ml-2">
                            （{listingsWithCoords.length} 個已定位）
                          </span>
                        )}
                      </h3>
                      {result.listings.map((listing) => {
                        const hasCoords = listing.lat && listing.lng;
                        return (
                          <button
                            key={listing.id}
                            onClick={() => handleSelectListing(listing.id)}
                            className={`w-full text-left rounded-xl border p-3 transition-all ${
                              selectedListingId === listing.id
                                ? 'border-blue-300 bg-blue-50 shadow-sm'
                                : hasCoords
                                ? 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                                : 'border-gray-100 bg-white/50 hover:border-gray-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-gray-900 line-clamp-1 mb-0.5">
                                  {listing.title}
                                </p>
                                <p className="text-[11px] text-gray-500 line-clamp-1 mb-1">
                                  📍 {listing.location}
                                </p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-blue-600">
                                    {listing.price.toLocaleString()} {listing.priceUnit}
                                  </span>
                                  {listing.size > 0 && (
                                    <span className="text-[10px] text-gray-400">
                                      {listing.size}坪
                                    </span>
                                  )}
                                  <span className="text-[10px] text-gray-400">
                                    {listing.platform}
                                  </span>
                                </div>
                              </div>
                              {!hasCoords && (
                                <span className="text-[10px] text-gray-300 shrink-0 mt-0.5" title="尚未定位">
                                  ○
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-400">
              HouseFind 全台房市搜尋引擎 — 資訊僅供參考，實際物件以各平台為準
            </p>
            <p className="text-xs text-gray-400">
              地圖資料 &copy; <a href="https://www.openstreetmap.org/copyright" className="underline hover:text-gray-600">OpenStreetMap</a> 貢獻者 · 支援平台：591、信義房屋、永慶房屋、樂屋網、好房網、住商不動產
            </p>
          </div>
        </div>
      </footer>
      {/* 購屋成本試算面板 */}
      {costCalcListing && (
        <CostCalculator
          listing={costCalcListing}
          onClose={() => setCostCalcListing(null)}
        />
      )}
    </div>
  );
}
