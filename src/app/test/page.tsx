'use client';

import { useState, useCallback } from 'react';

interface TestStep {
  name: string;
  duration: number;
  success: boolean;
  detail?: string;
}

interface SampleListing {
  title: string;
  price: number;
  priceUnit: string;
  location: string;
  city: string;
  district: string;
  propertyType: string;
  size: number;
  rooms: number;
  bathrooms: number;
  floor?: string;
  year?: number;
  isSponsored: boolean;
  url: string;
  tags?: string[];
  description?: string;
}

interface TestResult {
  platform: string;
  success: boolean;
  totalTime: number;
  listingCount: number;
  isRealData: boolean;
  sampleListings: SampleListing[];
  steps: TestStep[];
  error?: string;
  errorStack?: string;
}

type TestStatus = 'idle' | 'testing' | 'done' | 'error';

interface PlatformState {
  status: TestStatus;
  result: TestResult | null;
}

const ALL_PLATFORMS = [
  { name: '591房屋交易', icon: '🏠', color: 'sky', gradient: 'from-sky-500 to-cyan-600' },
  { name: '信義房屋', icon: '🔵', color: 'blue', gradient: 'from-blue-500 to-blue-700' },
  { name: '永慶房屋', icon: '🟢', color: 'emerald', gradient: 'from-emerald-500 to-green-600' },
  { name: '樂屋網', icon: '🎵', color: 'violet', gradient: 'from-violet-500 to-purple-600' },
  { name: '好房網', icon: '🏡', color: 'orange', gradient: 'from-orange-500 to-red-500' },
  { name: '住商不動產', icon: '🏢', color: 'slate', gradient: 'from-slate-600 to-gray-700' },
];

export default function TestPage() {
  const [platforms, setPlatforms] = useState<Record<string, PlatformState>>(() => {
    const initial: Record<string, PlatformState> = {};
    ALL_PLATFORMS.forEach(p => { initial[p.name] = { status: 'idle', result: null }; });
    return initial;
  });
  const [testingAll, setTestingAll] = useState(false);
  const [city, setCity] = useState('台北市');
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});

  const runTest = useCallback(async (platformName: string) => {
    setPlatforms(prev => ({
      ...prev,
      [platformName]: { status: 'testing', result: null },
    }));

    try {
      const response = await fetch(`/api/test-scraper?platform=${encodeURIComponent(platformName)}&city=${encodeURIComponent(city)}&listingType=sale`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setPlatforms(prev => ({
          ...prev,
          [platformName]: {
            status: 'error',
            result: {
              platform: platformName,
              success: false,
              totalTime: 0,
              listingCount: 0,
              isRealData: false,
              sampleListings: [],
              steps: [],
              error: errData.error || `HTTP ${response.status}`,
            },
          },
        }));
        return;
      }

      const result: TestResult = await response.json();
      setPlatforms(prev => ({
        ...prev,
        [platformName]: {
          status: result.success ? 'done' : 'error',
          result,
        },
      }));
    } catch (err) {
      setPlatforms(prev => ({
        ...prev,
        [platformName]: {
          status: 'error',
          result: {
            platform: platformName,
            success: false,
            totalTime: 0,
            listingCount: 0,
            isRealData: false,
            sampleListings: [],
            steps: [],
            error: err instanceof Error ? err.message : '未知錯誤',
          },
        },
      }));
    }
  }, [city]);

  const testAll = useCallback(async () => {
    setTestingAll(true);
    for (const platform of ALL_PLATFORMS) {
      await runTest(platform.name);
    }
    setTestingAll(false);
  }, [runTest]);

  const resetAll = useCallback(() => {
    const initial: Record<string, PlatformState> = {};
    ALL_PLATFORMS.forEach(p => { initial[p.name] = { status: 'idle', result: null }; });
    setPlatforms(initial);
    setShowDetails({});
  }, []);

  const toggleDetails = useCallback((platform: string) => {
    setShowDetails(prev => ({ ...prev, [platform]: !prev[platform] }));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 002.25-2.25v-1.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 18v1.5a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </a>
              <div className="h-6 w-px bg-gray-200" />
              <h1 className="text-lg font-bold text-gray-900">爬蟲測試</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={resetAll}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
              >
                重設
              </button>
              <a
                href="/"
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
              >
                返回首頁
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">測試縣市</label>
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all"
                >
                  {['台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市', '基隆市', '新竹市'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">交易類型</label>
                <div className="text-sm text-gray-700 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                  買屋 (sale)
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={testAll}
                disabled={testingAll}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                {testingAll ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    測試中...
                  </>
                ) : (
                  '🔍 測試全部平台'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Platform Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {ALL_PLATFORMS.map((platform) => {
            const state = platforms[platform.name];
            const isIdle = state.status === 'idle';
            const isTesting = state.status === 'testing';
            const isDone = state.status === 'done';
            const isError = state.status === 'error';
            const result = state.result;
            const detailsOpen = showDetails[platform.name];

            return (
              <div
                key={platform.name}
                className={`bg-white rounded-2xl border transition-all ${
                  isTesting
                    ? 'border-blue-200 shadow-md shadow-blue-500/5'
                    : isDone && result?.isRealData
                    ? 'border-emerald-200 shadow-sm'
                    : isDone
                    ? 'border-amber-200 shadow-sm'
                    : isError
                    ? 'border-red-200 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 shadow-sm'
                }`}
              >
                {/* Card Header */}
                <div className={`p-4 border-b border-gray-100 bg-gradient-to-r ${platform.gradient} rounded-t-2xl text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{platform.icon}</span>
                      <h3 className="font-semibold text-sm">{platform.name}</h3>
                    </div>
                    {isDone && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        result?.isRealData
                          ? 'bg-white/20 text-white'
                          : 'bg-white/20 text-white'
                      }`}>
                        {result?.isRealData ? '✅ 真實' : '🔄 模擬'}
                      </span>
                    )}
                    {isError && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-400/30 text-[10px] font-medium text-white">
                        ❌ 失敗
                      </span>
                    )}
                    {isTesting && (
                      <span className="flex items-center gap-1.5 text-[10px] text-white/80">
                        <span className="flex h-2 w-2 rounded-full bg-white animate-pulse" />
                        爬取中...
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4">
                  {isIdle && (
                    <div className="flex flex-col items-center py-6 text-center">
                      <div className="text-3xl mb-2 opacity-30">{platform.icon}</div>
                      <p className="text-xs text-gray-400 mb-4">點擊按鈕開始測試</p>
                      <button
                        onClick={() => runTest(platform.name)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-xs font-medium rounded-xl hover:bg-gray-800 transition-all active:scale-[0.98]"
                      >
                        🧪 開始測試
                      </button>
                    </div>
                  )}

                  {isTesting && (
                    <div className="flex flex-col items-center py-8">
                      <div className="relative mb-4">
                        <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                      <p className="text-xs text-gray-500">正在向各平台發送請求...</p>
                      <p className="text-[10px] text-gray-400 mt-1">可能需要 10-30 秒</p>
                    </div>
                  )}

                  {(isDone || isError) && result && (
                    <div className="space-y-3">
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                          <div className={`text-lg font-bold ${
                            result.isRealData ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {result.listingCount}
                          </div>
                          <div className="text-[10px] text-gray-400">筆資料</div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                          <div className="text-lg font-bold text-gray-700">
                            {(result.totalTime / 1000).toFixed(1)}
                          </div>
                          <div className="text-[10px] text-gray-400">秒</div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                          <div className={`text-lg font-bold ${
                            result.isRealData ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {result.isRealData ? '真實' : '模擬'}
                          </div>
                          <div className="text-[10px] text-gray-400">資料來源</div>
                        </div>
                      </div>

                      {/* Steps */}
                      {result.steps.length > 0 && (
                        <div className="bg-gray-50 rounded-xl p-3">
                          <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">執行步驟</h4>
                          <div className="space-y-1.5">
                            {result.steps.map((step, i) => (
                              <div key={i} className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={step.success ? 'text-emerald-500' : 'text-red-500'}>
                                    {step.success ? '✓' : '✗'}
                                  </span>
                                  <span className="text-gray-600 truncate">{step.name}</span>
                                </div>
                                <span className="text-gray-400 shrink-0 ml-2">
                                  {(step.duration / 1000).toFixed(1)}s
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Error */}
                      {result.error && (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                          <p className="text-[11px] font-medium text-red-700 mb-1">錯誤</p>
                          <p className="text-[10px] text-red-600 font-mono break-all">{result.error}</p>
                        </div>
                      )}

                      {/* Sample Data Toggle */}
                      {result.sampleListings.length > 0 && (
                        <>
                          <button
                            onClick={() => toggleDetails(platform.name)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl text-[11px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <span>📋 查看前 {result.sampleListings.length} 筆資料</span>
                            <svg
                              className={`h-3.5 w-3.5 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
                              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>

                          {detailsOpen && (
                            <div className="space-y-2 max-h-80 overflow-y-auto">
                              {result.sampleListings.map((item, i) => (
                                <div key={i} className="bg-gray-50 rounded-xl p-3 text-[11px] space-y-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="font-medium text-gray-800 line-clamp-1">{item.title}</span>
                                    <span className="shrink-0 font-bold text-gray-700">
                                      {item.price.toLocaleString()} {item.priceUnit}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500">
                                    <span>📍 {item.location || `${item.city} ${item.district}`}</span>
                                    {item.size > 0 && <span>• {item.size}坪</span>}
                                    {item.rooms > 0 && <span>• {item.rooms}房{item.bathrooms}衛</span>}
                                    {item.floor && <span>• {item.floor}樓</span>}
                                    <span>• {item.propertyType}</span>
                                  </div>
                                  {item.isSponsored && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-[9px] text-amber-700 font-medium">
                                      置頂廣告
                                    </span>
                                  )}
                                  {item.tags && item.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {item.tags.map((tag, j) => (
                                        <span key={j} className="px-1.5 py-0.5 bg-gray-200/50 rounded text-[9px] text-gray-600">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <div className="text-[9px] text-gray-400 truncate">
                                    URL: {item.url || '(無)'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {/* Retry Button */}
                      <button
                        onClick={() => runTest(platform.name)}
                        className="w-full py-2 text-[11px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                      >
                        🔄 重新測試
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {Object.values(platforms).some(p => p.status !== 'idle') && (
          <div className="mt-8 bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">測試結果摘要</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {['全部', '成功(真實)', '成功(模擬)', '失敗'].map((label, i) => {
                const count = label === '全部'
                  ? Object.values(platforms).filter(p => p.status !== 'idle').length
                  : label === '成功(真實)'
                  ? Object.values(platforms).filter(p => p.status === 'done' && p.result?.isRealData).length
                  : label === '成功(模擬)'
                  ? Object.values(platforms).filter(p => p.status === 'done' && !p.result?.isRealData).length
                  : Object.values(platforms).filter(p => p.status === 'error').length;
                const colors = ['text-gray-700', 'text-emerald-600', 'text-amber-600', 'text-red-600'];
                return (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className={`text-2xl font-bold ${colors[i]}`}>{count}</div>
                    <div className="text-[10px] text-gray-400">{label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
