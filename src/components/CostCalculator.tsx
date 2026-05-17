'use client';

import { useState, useMemo, useCallback } from 'react';
import { HousingListing } from '@/types';
import {
  calculateTotalCost,
  formatCurrency,
  formatCurrencyDetail,
  MortgageParams,
  TaxFeeParams,
  CostSummary,
  DEFAULT_MORTGAGE_PARAMS,
  DEFAULT_TAX_FEE_PARAMS,
} from '@/utils/costCalculator';
import { formatSize } from '@/utils/formatters';
import { MortgageChart } from '@/components/MortgageChart';

interface CostCalculatorProps {
  listing: HousingListing;
  onClose: () => void;
}

/** 將萬為單位的價格轉換為元（內部計算用） */
function priceToYuan(price: number): number {
  return price * 10000;
}

export function CostCalculator({ listing, onClose }: CostCalculatorProps) {
  // 房屋總價（萬元）- 從 listing 取得
  const basePrice = listing.price;
  const [showAllFees, setShowAllFees] = useState(false);

  // ====== 參數狀態 ======
  const [downPaymentRatio, setDownPaymentRatio] = useState(0.2);
  const [annualRate, setAnnualRate] = useState(2.185);
  const [loanYears, setLoanYears] = useState(30);
  const [gracePeriod, setGracePeriod] = useState(0);
  const [repaymentMethod, setRepaymentMethod] = useState<'interest_equal' | 'principal_equal'>('interest_equal');
  const [assessedValueRatio, setAssessedValueRatio] = useState(0.25);
  const [buyerAgencyRate, setBuyerAgencyRate] = useState(0.02);
  const [hasInvoice, setHasInvoice] = useState(false);

  // ====== 即時計算 ======
  const costSummary = useMemo<CostSummary>(() => {
    return calculateTotalCost(basePrice, {
      downPaymentRatio,
      annualRate,
      loanYears,
      gracePeriod,
      repaymentMethod,
    }, {
      assessedValueRatio,
      buyerAgencyRate,
      hasInvoice,
    });
  }, [basePrice, downPaymentRatio, annualRate, loanYears, gracePeriod, repaymentMethod, assessedValueRatio, buyerAgencyRate, hasInvoice]);

  const totalCashRequiredYuan = costSummary.totalCashRequired;

  // 建議月收入（房貸不超過月收入 30%）
  const recommendedIncome = useMemo(() => {
    return costSummary.monthlyMortgage / 0.3;
  }, [costSummary.monthlyMortgage]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-12 overflow-y-auto">
      {/* 背景遮罩 */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* 面板 */}
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* 頂部標題列 */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-gray-900 truncate">
              購屋成本試算
            </h2>
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {listing.title || listing.location}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex items-center justify-center h-8 w-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all shrink-0"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* ====== 核心數據卡片 ====== */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-3.5">
              <p className="text-[10px] font-medium text-blue-600/70 uppercase tracking-wider mb-0.5">房屋總價</p>
              <p className="text-lg font-bold text-blue-700">
                {formatCurrency(priceToYuan(basePrice))}
              </p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-3.5">
              <p className="text-[10px] font-medium text-emerald-600/70 uppercase tracking-wider mb-0.5">自備款</p>
              <p className="text-lg font-bold text-emerald-700">
                {formatCurrency(priceToYuan(costSummary.downPayment))}
              </p>
              <p className="text-[10px] text-emerald-500 mt-0.5">
                {Math.round(downPaymentRatio * 100)}%
              </p>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-xl p-3.5">
              <p className="text-[10px] font-medium text-violet-600/70 uppercase tracking-wider mb-0.5">需準備資金</p>
              <p className="text-lg font-bold text-violet-700">
                {formatCurrency(totalCashRequiredYuan)}
              </p>
              <p className="text-[10px] text-violet-500 mt-0.5">自備+稅費</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-3.5">
              <p className="text-[10px] font-medium text-amber-600/70 uppercase tracking-wider mb-0.5">每月房貸</p>
              <p className="text-lg font-bold text-amber-700">
                {formatCurrencyDetail(costSummary.monthlyMortgage)}
              </p>
              <p className="text-[10px] text-amber-500 mt-0.5">
                利息{(costSummary.mortgageDetails.totalInterest / 10000).toFixed(0)}萬
              </p>
            </div>
          </div>

          {/* ====== 參數調整 ====== */}
          <div className="bg-gray-50/80 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              貸款條件設定
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {/* 自備款比例 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-gray-600">自備款比例</label>
                  <span className="text-xs font-semibold text-gray-800">{Math.round(downPaymentRatio * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={60}
                  value={Math.round(downPaymentRatio * 100)}
                  onChange={(e) => setDownPaymentRatio(parseInt(e.target.value) / 100)}
                  className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>5%</span>
                  <span>60%</span>
                </div>
              </div>

              {/* 年利率 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-gray-600">年利率</label>
                  <span className="text-xs font-semibold text-gray-800">{annualRate.toFixed(3)}%</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={6}
                  step={0.01}
                  value={annualRate}
                  onChange={(e) => setAnnualRate(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>1%</span>
                  <span>6%</span>
                </div>
              </div>

              {/* 貸款年限 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-gray-600">貸款年限</label>
                  <span className="text-xs font-semibold text-gray-800">{loanYears} 年</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={40}
                  value={loanYears}
                  onChange={(e) => setLoanYears(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>5 年</span>
                  <span>40 年</span>
                </div>
              </div>

              {/* 寬限期 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-gray-600">寬限期</label>
                  <span className="text-xs font-semibold text-gray-800">{gracePeriod} 年</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  value={gracePeriod}
                  onChange={(e) => setGracePeriod(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>無</span>
                  <span>5 年</span>
                </div>
              </div>
            </div>

            {/* 還款方式 */}
            <div>
              <label className="text-xs text-gray-600 block mb-1.5">還款方式</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setRepaymentMethod('interest_equal')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                    repaymentMethod === 'interest_equal'
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  本息均攤
                </button>
                <button
                  onClick={() => setRepaymentMethod('principal_equal')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                    repaymentMethod === 'principal_equal'
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  本金均攤
                </button>
              </div>
            </div>
          </div>

          {/* ====== 每月還款分析 ====== */}
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
              </svg>
              每月還款分析
            </h3>

            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sm text-gray-600">每月應還款</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {formatCurrencyDetail(costSummary.monthlyMortgage)}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500">
                    貸款總金額 <strong className="text-gray-700">{formatCurrency(priceToYuan(costSummary.loanAmount))}</strong>
                  </span>
                  <span className="text-xs text-gray-500">
                    總利息 <strong className="text-amber-600">{formatCurrencyDetail(costSummary.mortgageDetails.totalInterest)}</strong>
                  </span>
                </div>

                {/* 房貸所得比建議 */}
                <div className="rounded-lg p-2.5 text-xs bg-emerald-50 text-emerald-700">
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      建議月收入需達 <strong>{recommendedIncome.toLocaleString()} 元</strong> 以上
                      （房貸不超過月收入 30%）
                    </span>
                  </div>
                </div>
              </div>

              {/* 寬限期提示 */}
              {gracePeriod > 0 && (
                <div className="border-t border-gray-100 px-4 py-2.5 bg-blue-50/50">
                  <p className="text-xs text-blue-700 flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    寬限期內每月僅需還利息 <strong>{formatCurrencyDetail(costSummary.mortgageDetails.gracePeriodPayment)}</strong>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ====== 交易稅費明細 ====== */}
          <div>
            <button
              onClick={() => setShowAllFees(!showAllFees)}
              className="w-full flex items-center justify-between text-xs font-semibold text-gray-700 mb-3"
            >
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                交易稅費明細（共 {formatCurrency(costSummary.totalTaxFees)}）
              </span>
              <svg
                className={`h-4 w-4 text-gray-400 transition-transform ${showAllFees ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            <div className="space-y-1">
              <FeeRow label="契稅（6%）" value={costSummary.taxFeeDetails.deedTax} />
              <FeeRow label="印花稅（0.1%）" value={costSummary.taxFeeDetails.stampDuty} />
              <FeeRow label="登記規費（0.1%）" value={costSummary.taxFeeDetails.registrationFee} />
              <FeeRow label="代書費" value={costSummary.taxFeeDetails.notaryFee} />
              <FeeRow label="謄本費" value={costSummary.taxFeeDetails.copyFee} />

              {showAllFees && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <FeeRow
                    label={`買方仲介費（${hasInvoice ? '1%' : (buyerAgencyRate * 100) + '%'}）`}
                    value={costSummary.taxFeeDetails.buyerAgencyFee}
                  />
                  <FeeRow label="貸款開辦費" value={costSummary.taxFeeDetails.loanOriginationFee} />
                  <FeeRow label="設定規費（0.12%）" value={costSummary.taxFeeDetails.mortgageSetupFee} />
                  <FeeRow label="火險+地震險（首年）" value={costSummary.taxFeeDetails.insuranceFee} />
                </>
              )}

              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5 mt-2">
                <span className="text-xs font-semibold text-gray-700">稅費總計</span>
                <span className="text-sm font-bold text-gray-900">
                  {formatCurrency(costSummary.totalTaxFees)}
                </span>
              </div>
            </div>
          </div>

          {/* ====== 進階設定（折疊） ====== */}
          <div className="bg-gray-50/80 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 1115 0 7.5 7.5 0 01-15 0zm6 0h.008v.008H10.5V12zm6 0h.008v.008H16.5V12z" />
              </svg>
              進階設定
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">房屋評定現值比例</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={5}
                    max={50}
                    value={Math.round(assessedValueRatio * 100)}
                    onChange={(e) => setAssessedValueRatio(parseInt(e.target.value) / 100)}
                    className="flex-1 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-xs font-medium text-gray-700 w-10 text-right">{Math.round(assessedValueRatio * 100)}%</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">買方仲介費率</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={buyerAgencyRate * 100}
                    onChange={(e) => setBuyerAgencyRate(parseFloat(e.target.value) / 100)}
                    className="flex-1 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-xs font-medium text-gray-700 w-10 text-right">{(buyerAgencyRate * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasInvoice}
                onChange={(e) => setHasInvoice(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">仲介有開發票（費率降至 1%）</span>
            </label>
          </div>

          {/* ====== 還款趨勢視覺化 + 逐年明細 ====== */}
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
              </svg>
              還款趨勢視覺化
            </h3>

            <MortgageChart
              yearlyBreakdown={costSummary.mortgageDetails.yearlyBreakdown}
              totalInterest={costSummary.mortgageDetails.totalInterest}
              totalPayment={costSummary.mortgageDetails.totalPayment}
              loanAmount={costSummary.loanAmount}
            />

            {/* 折疊式逐年明細表 */}
            <details className="group mt-3">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 transition-colors select-none py-1.5 flex items-center gap-1">
                <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                查看逐年還款明細表
              </summary>
              <div className="overflow-x-auto rounded-xl border border-gray-100 mt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-2 font-medium text-gray-600">年度</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">還款本金</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">還款利息</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">本息合計</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">剩餘本金</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costSummary.mortgageDetails.yearlyBreakdown.slice(0, 10).map((row) => (
                      <tr key={row.year} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="text-left px-3 py-2 font-medium text-gray-800">第 {row.year} 年</td>
                        <td className="text-right px-3 py-2 text-gray-600">{formatCurrencyDetail(row.principalPaid)}</td>
                        <td className="text-right px-3 py-2 text-amber-600">{formatCurrencyDetail(row.interestPaid)}</td>
                        <td className="text-right px-3 py-2 text-gray-800 font-medium">{formatCurrencyDetail(row.totalPaid)}</td>
                        <td className="text-right px-3 py-2 text-gray-500">{formatCurrency(row.remainingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {costSummary.mortgageDetails.yearlyBreakdown.length > 10 && (
                  <div className="px-3 py-2 text-center text-[10px] text-gray-400 border-t border-gray-50">
                    僅顯示前 10 年明細，共 {costSummary.mortgageDetails.yearlyBreakdown.length} 年
                  </div>
                )}
              </div>
            </details>
          </div>

          {/* ====== 免責聲明 ====== */}
          <div className="bg-amber-50/70 border border-amber-200/50 rounded-xl p-3">
            <p className="text-[10px] text-amber-700 leading-relaxed">
              ⚠️ 以上試算僅供參考，實際貸款條件、稅費金額會因個人信用狀況、銀行政策、房屋評定現值等因素而異。
              建議諮詢專業代書及銀行專員取得精確報價。
            </p>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {listing.platform} · {listing.location}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}

/** 稅費明細列 */
function FeeRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-700">{formatCurrencyDetail(value)}</span>
    </div>
  );
}
