'use client';

import { SearchResult, HousingListing } from '@/types';
import { ResultCard } from './ResultCard';

interface ResultsGridProps {
  result: SearchResult | null;
  isLoading: boolean;
  onSelectListing?: (id: string) => void;
  onCalculateCost?: (listing: HousingListing) => void;
}

export function ResultsGrid({ result, isLoading, onSelectListing, onCalculateCost }: ResultsGridProps) {
  if (isLoading) {
    return (
      <div className="py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white overflow-hidden animate-pulse">
              <div className="aspect-[16/10] bg-gray-200" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-100 rounded w-16" />
                  <div className="h-6 bg-gray-100 rounded w-20" />
                  <div className="h-6 bg-gray-100 rounded w-14" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  if (result.listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 mb-6">
          <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">沒有找到符合的物件</h3>
        <p className="text-sm text-gray-500 max-w-md">
          請嘗試調整搜尋條件，例如放寬價格範圍、坪數限制或選擇不同區域
        </p>
      </div>
    );
  }

  // 分別顯示非置頂與置頂廣告
  const regularListings = result.listings.filter(l => !l.isSponsored);
  const sponsoredListings = result.listings.filter(l => l.isSponsored);

  return (
    <div className="space-y-8">
      {/* 一般列表 */}
      {regularListings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {regularListings.map((listing) => (
            <ResultCard key={listing.id} listing={listing} onViewOnMap={onSelectListing} onCalculateCost={onCalculateCost} />
          ))}
        </div>
      )}

      {/* 置頂廣告（如果有且使用者選擇顯示） */}
      {sponsoredListings.length > 0 && !result.filters.hideSponsored && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-red-100" />
            <span className="text-xs font-medium text-red-500 flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2L2 18h16L10 2z" />
              </svg>
              贊助內容
            </span>
            <div className="h-px flex-1 bg-red-100" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 opacity-80">
            {sponsoredListings.map((listing) => (
              <ResultCard key={listing.id} listing={listing} onViewOnMap={onSelectListing} onCalculateCost={onCalculateCost} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
