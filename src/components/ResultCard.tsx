'use client';

import { HousingListing } from '@/types';
import { formatPrice, formatSize, formatLayout, formatAge } from '@/utils/formatters';
import { useState } from 'react';

interface ResultCardProps {
  listing: HousingListing;
  onViewOnMap?: (id: string) => void;
  onCalculateCost?: (listing: HousingListing) => void;
}

const PROPERTY_TYPE_COLORS: Record<string, string> = {
  '公寓': 'bg-orange-100 text-orange-700',
  '大樓': 'bg-blue-100 text-blue-700',
  '華廈': 'bg-green-100 text-green-700',
  '透天': 'bg-purple-100 text-purple-700',
  '整層住家': 'bg-violet-100 text-violet-700',
  '別墅': 'bg-pink-100 text-pink-700',
  '店面': 'bg-yellow-100 text-yellow-700',
  '套房': 'bg-cyan-100 text-cyan-700',
};

const PLATFORM_BADGES: Record<string, { bg: string; text: string }> = {
  '591房屋交易': { bg: 'bg-amber-50', text: 'text-amber-700' },
  '信義房屋': { bg: 'bg-blue-50', text: 'text-blue-700' },
  '永慶房屋': { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  '樂屋網': { bg: 'bg-purple-50', text: 'text-purple-700' },
  '好房網': { bg: 'bg-rose-50', text: 'text-rose-700' },
  '住商不動產': { bg: 'bg-cyan-50', text: 'text-cyan-700' },
};

export function ResultCard({ listing, onViewOnMap, onCalculateCost }: ResultCardProps) {
  const [imageError, setImageError] = useState(false);
  const badge = PLATFORM_BADGES[listing.platform] || { bg: 'bg-gray-50', text: 'text-gray-700' };
  const typeColor = PROPERTY_TYPE_COLORS[listing.propertyType] || 'bg-gray-100 text-gray-700';

  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-lg hover:border-gray-200 transition-all duration-300 overflow-hidden"
    >
      {/* 圖片區域 */}
      <div className="relative aspect-[16/10] bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        {listing.imageUrl && !imageError ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
          </div>
        )}

        {/* 平台標籤 */}
        <div className={`absolute top-3 left-3 ${badge.bg} ${badge.text} px-2.5 py-1 rounded-lg text-xs font-semibold shadow-sm`}>
          {listing.platform}
        </div>

        {/* 置頂廣告標記 */}
        {listing.isSponsored && (
          <div className="absolute top-3 right-3 bg-red-500 text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-md flex items-center gap-1">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2L2 18h16L10 2z" />
            </svg>
            廣告
          </div>
        )}

        {/* 價格浮層 */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 pt-8">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">
              {listing.price.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-white/80">
              {listing.priceUnit}
            </span>
            {listing.pricePerPing && (
              <span className="text-xs text-white/60 ml-2">
                {listing.pricePerPing}萬/坪
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 內容區域 */}
      <div className="p-4 space-y-3">
        {/* 標題 */}
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
          {listing.title}
        </h3>

        {/* 位置 */}
        <div className="flex items-start gap-1.5 text-xs text-gray-500">
          <svg className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <span className="line-clamp-1">{listing.location}</span>
        </div>

        {/* 格局與規格 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${typeColor}`}>
            {listing.propertyType}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-xs font-medium">
            {formatLayout(listing.rooms, listing.livingRooms, listing.bathrooms)}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-xs font-medium">
            {formatSize(listing.size)}
          </span>
          {listing.floor && (
            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-xs font-medium">
              {listing.floor}樓
            </span>
          )}
          {listing.year && (
            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-xs font-medium">
              {formatAge(listing.year)}
            </span>
          )}
        </div>

        {/* 標籤 */}
        {listing.tags && listing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {listing.tags.map((tag, i) => (
              <span
                key={i}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  tag.includes('廣告') || tag.includes('置頂')
                    ? 'bg-red-50 text-red-600'
                    : tag.includes('新')
                    ? 'bg-green-50 text-green-600'
                    : 'bg-blue-50 text-blue-600'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 操作按鈕 */}
      {(onViewOnMap || onCalculateCost) && (
        <div className="px-4 pb-3 pt-0 space-y-1.5">
          {onViewOnMap && (
            <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onViewOnMap(listing.id);
            }}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 py-1.5 text-xs font-medium text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
            顯示在地圖
          </button>
        )}
        {onCalculateCost && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCalculateCost(listing);
            }}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            計算購屋成本
          </button>
          )}
        </div>
      )}
    </a>
  );
}
