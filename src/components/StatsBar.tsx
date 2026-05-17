'use client';

import { SearchResult, PlatformStatus } from '@/types';

interface StatsBarProps {
  result: SearchResult | null;
  isLoading: boolean;
}

export function StatsBar({ result, isLoading }: StatsBarProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-4 py-3 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32" />
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="h-4 bg-gray-200 rounded w-28" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="py-3">
        <p className="text-xs text-gray-400">
          輸入搜尋條件後點擊「搜尋」按鈕，或直接按 Enter 鍵
        </p>
      </div>
    );
  }

  const realDataPlatforms = result.platforms.filter(p => p.isRealData && p.resultsCount > 0);
  const mockDataPlatforms = result.platforms.filter(p => !p.isRealData && p.resultsCount > 0);

  return (
    <div className="space-y-3">
      {/* 統計資訊 */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 text-sm font-bold">
            {result.listings.length}
          </div>
          <span className="text-sm text-gray-600">
            符合條件的物件
          </span>
        </div>

        {/* 真實資料統計 */}
        {realDataPlatforms.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 text-sm font-bold">
              {realDataPlatforms.reduce((sum, p) => sum + p.resultsCount, 0)}
            </div>
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              真實資料
            </span>
          </div>
        )}

        {/* 模擬資料統計 */}
        {mockDataPlatforms.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 text-sm font-bold">
              {mockDataPlatforms.reduce((sum, p) => sum + p.resultsCount, 0)}
            </div>
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              模擬資料
            </span>
          </div>
        )}

        {result.sponsoredCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 text-sm font-bold">
              {result.sponsoredCount}
            </div>
            <span className="text-sm text-gray-500">
              置頂廣告已{' '}
              <span className="font-medium text-green-600">
                過濾 {result.filteredCount}
              </span>
            </span>
          </div>
        )}

        <div className="text-xs text-gray-400">
          搜尋耗時 {result.searchTime}ms
        </div>
      </div>

      {/* 平台狀態 */}
      <div className="flex flex-wrap items-center gap-2">
        {result.platforms.map((platform) => (
          <PlatformBadge key={platform.name} platform={platform} />
        ))}
      </div>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: PlatformStatus }) {
  const colors: Record<string, string> = {
    '591房屋交易': 'ring-amber-200',
    '信義房屋': 'ring-blue-200',
    '永慶房屋': 'ring-emerald-200',
    '樂屋網': 'ring-purple-200',
    '好房網': 'ring-rose-200',
    '住商不動產': 'ring-cyan-200',
  };

  const bgColors: Record<string, string> = {
    '591房屋交易': 'bg-amber-50',
    '信義房屋': 'bg-blue-50',
    '永慶房屋': 'bg-emerald-50',
    '樂屋網': 'bg-purple-50',
    '好房網': 'bg-rose-50',
    '住商不動產': 'bg-cyan-50',
  };

  const textColors: Record<string, string> = {
    '591房屋交易': 'text-amber-700',
    '信義房屋': 'text-blue-700',
    '永慶房屋': 'text-emerald-700',
    '樂屋網': 'text-purple-700',
    '好房網': 'text-rose-700',
    '住商不動產': 'text-cyan-700',
  };

  const ringColor = colors[platform.name] || 'ring-gray-200';
  const bgColor = bgColors[platform.name] || 'bg-gray-50';
  const textColor = textColors[platform.name] || 'text-gray-600';

  // 資料來源戳記
  const dataBadge = platform.resultsCount > 0 ? (
    platform.isRealData ? (
      <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-100/80 px-1.5 py-0.5 rounded-full">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        真實
      </span>
    ) : (
      <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-100/80 px-1.5 py-0.5 rounded-full">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
        模擬
      </span>
    )
  ) : null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${bgColor} ${textColor} ${ringColor} ${
        platform.error ? 'opacity-50' : ''
      }`}
      title={
        platform.error ||
        `${platform.resultsCount} 筆結果${platform.searchTime ? ` · ${platform.searchTime}ms` : ''}`
      }
    >
      <span>{platform.icon}</span>
      <span>{platform.name}</span>
      <span className="font-bold ml-0.5">{platform.resultsCount}</span>
      {dataBadge}
      {platform.searchTime && platform.searchTime > 1000 && (
        <span className="text-[10px] opacity-60 ml-0.5">
          {platform.searchTime > 10000
            ? `>${(platform.searchTime / 1000).toFixed(0)}s`
            : `${(platform.searchTime / 1000).toFixed(1)}s`}
        </span>
      )}
      {platform.error && (
        <span className="text-red-400" title={platform.error}>
          ✕
        </span>
      )}
    </span>
  );
}
