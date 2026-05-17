'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { YearlyBreakdown } from '@/utils/costCalculator';
import { formatCurrency } from '@/utils/costCalculator';

interface MortgageChartProps {
  yearlyBreakdown: YearlyBreakdown[];
  totalInterest: number;
  totalPayment: number;
  loanAmount: number; // in 萬元
}

/** 自訂提示框 */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200 shadow-lg px-3.5 py-2.5 text-xs space-y-1">
      <p className="font-semibold text-gray-800 mb-1.5">第 {label} 年</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="font-medium text-gray-900 text-right">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** 金額格式化（圖表 axis） */
function formatAxisValue(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}億`;
  if (value >= 10000) return `${(value / 10000).toFixed(0)}萬`;
  return `${value}`;
}

/**
 * 房貸還款圖表視覺化
 */
export function MortgageChart({ yearlyBreakdown, totalInterest, totalPayment, loanAmount }: MortgageChartProps) {
  const [chartTab, setChartTab] = useState<'balance' | 'breakdown' | 'pie'>('balance');

  // 資料準備：加入萬為單位方便閱讀
  const chartData = useMemo(() => {
    return yearlyBreakdown.map((row) => ({
      year: row.year,
      remainingBalance: row.remainingBalance,
      remainingBalanceWan: Math.round(row.remainingBalance / 10000),
      principalPaid: row.principalPaid,
      principalPaidWan: Math.round(row.principalPaid / 10000),
      interestPaid: row.interestPaid,
      interestPaidWan: Math.round(row.interestPaid / 10000),
      totalPaid: row.totalPaid,
      totalPaidWan: Math.round(row.totalPaid / 10000),
    }));
  }, [yearlyBreakdown]);

  const totalPrincipal = totalPayment - totalInterest;

  // 圓餅圖資料
  const pieData = useMemo(() => [
    { name: '總還款本金', value: totalPrincipal, color: '#3b82f6' },
    { name: '總利息支出', value: totalInterest, color: '#f59e0b' },
  ], [totalPrincipal, totalInterest]);

  // 最大餘額（用於 Y 軸範圍）
  const maxBalance = chartData[0]?.remainingBalance || 0;

  const tabClass = (tab: string) =>
    `flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
      chartTab === tab
        ? 'bg-white text-gray-800 shadow-sm ring-1 ring-gray-200'
        : 'text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div className="space-y-3">
      {/* 圖表類型切換 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button onClick={() => setChartTab('balance')} className={tabClass('balance')}>
          <span className="flex items-center justify-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
            餘額走勢
          </span>
        </button>
        <button onClick={() => setChartTab('breakdown')} className={tabClass('breakdown')}>
          <span className="flex items-center justify-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            本息明細
          </span>
        </button>
        <button onClick={() => setChartTab('pie')} className={tabClass('pie')}>
          <span className="flex items-center justify-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
            </svg>
            比例
          </span>
        </button>
      </div>

      {/* 圖表內容 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        {chartTab === 'balance' && (
          <RemainingBalanceChart data={chartData} maxBalance={maxBalance} />
        )}
        {chartTab === 'breakdown' && (
          <PrincipalInterestBar data={chartData} />
        )}
        {chartTab === 'pie' && (
          <PrincipalInterestPie data={pieData} totalPayment={totalPayment} totalInterest={totalInterest} />
        )}
      </div>
    </div>
  );
}

// ====== 子圖表元件 ======

/** 剩餘本金走勢圖 */
function RemainingBalanceChart({ data, maxBalance }: { data: any[]; maxBalance: number }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        剩餘本金變化
      </h4>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="year"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatAxisValue}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            domain={[0, maxBalance * 1.1]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="remainingBalance"
            name="剩餘本金"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#balanceGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
        <span>貸款金額 {formatCurrency(data[0]?.remainingBalance || 0)}</span>
        <span>還款完畢</span>
      </div>
    </div>
  );
}

/** 年度本息堆疊長條圖 */
function PrincipalInterestBar({ data }: { data: any[] }) {
  const filteredData = data.filter((_, i) => i % 2 === 0 || i === data.length - 1 || i === 0);

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        年度本金 vs 利息
      </h4>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={filteredData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="year"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatAxisValue}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '10px', color: '#6b7280' }}
            iconType="circle"
            iconSize={8}
          />
          <Bar dataKey="interestPaid" name="利息" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
          <Bar dataKey="principalPaid" name="本金" stackId="a" fill="#3b82f6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-gray-400 mt-1 text-center">
        逐年還款結構 - 前期利息佔比較高
      </p>
    </div>
  );
}

/** 本息總額比例圓餅圖 */
function PrincipalInterestPie({ data, totalPayment, totalInterest }: { data: any[]; totalPayment: number; totalInterest: number }) {
  const totalPrincipal = totalPayment - totalInterest;
  const interestPercent = ((totalInterest / totalPayment) * 100).toFixed(1);

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
        總還款比例
      </h4>
      <div className="flex items-center gap-6">
        <div className="shrink-0">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200 shadow-lg px-3 py-2 text-xs">
                      <p className="font-medium text-gray-800">{payload[0].name}</p>
                      <p className="text-gray-600">{formatCurrency(payload[0].value as number)}</p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-gray-600">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                本金
              </span>
              <span className="font-semibold text-gray-800">{formatCurrency(totalPrincipal)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-700"
                style={{ width: `${(totalPrincipal / totalPayment) * 100}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-gray-600">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                利息
              </span>
              <span className="font-semibold text-amber-600">{formatCurrency(totalInterest)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-700"
                style={{ width: `${(totalInterest / totalPayment) * 100}%` }}
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 pt-1">
            利息佔總還款的 <strong className="text-amber-600">{interestPercent}%</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
