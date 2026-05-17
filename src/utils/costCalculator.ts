/**
 * 購屋成本計算引擎
 * 包含房貸試算、交易稅費、仲介費等完整計算
 */

// ====== 型別定義 ======

export interface MortgageParams {
  /** 房屋總價（萬元） */
  totalPrice: number;
  /** 自備款比例（0-1），預設 0.2 */
  downPaymentRatio: number;
  /** 年利率（%），預設 2.185 */
  annualRate: number;
  /** 貸款年限，預設 30 */
  loanYears: number;
  /** 寬限期（年），預設 0 */
  gracePeriod: number;
  /** 還款方式 */
  repaymentMethod: 'interest_equal' | 'principal_equal';
}

export interface MortgageResult {
  /** 貸款金額（萬元） */
  loanAmount: number;
  /** 自備款金額（萬元） */
  downPayment: number;
  /** 每月還款金額（元） */
  monthlyPayment: number;
  /** 總還款金額（元） */
  totalPayment: number;
  /** 總利息支出（元） */
  totalInterest: number;
  /** 寬限期每月還款（寬限期內） */
  gracePeriodPayment: number;
  /** 各年度明細 */
  yearlyBreakdown: YearlyBreakdown[];
  /** 本息均攤：每月固定還款額 */
  fixedMonthlyPayment?: number;
  /** 本金均攤：每月遞減明細 */
  principalMonthlyBreakdown?: { month: number; payment: number; principal: number; interest: number; balance: number }[];
}

export interface YearlyBreakdown {
  year: number;
  /** 當年還款本金 */
  principalPaid: number;
  /** 當年還款利息 */
  interestPaid: number;
  /** 當年還款總額 */
  totalPaid: number;
  /** 剩餘本金 */
  remainingBalance: number;
}

export interface TaxFeeParams {
  /** 房屋總價（萬元） */
  totalPrice: number;
  /** 房屋評定現值比例（相對於成交價，0-1），預設 0.25 */
  assessedValueRatio: number;
  /** 買方仲介費率，預設 0.02 */
  buyerAgencyRate: number;
  /** 是否開發票 */
  hasInvoice: boolean;
}

export interface TaxFeeResult {
  /** 契稅 */
  deedTax: number;
  /** 印花稅 */
  stampDuty: number;
  /** 登記規費 */
  registrationFee: number;
  /** 代書費 */
  notaryFee: number;
  /** 謄本費 */
  copyFee: number;
  /** 買方仲介費 */
  buyerAgencyFee: number;
  /** 貸款開辦費 */
  loanOriginationFee: number;
  /** 設定規費 */
  mortgageSetupFee: number;
  /** 火險+地震險（首年） */
  insuranceFee: number;
  /** 小計 */
  subtotal: number;
}

export interface CostSummary {
  /** 房屋總價 */
  totalPrice: number;
  /** 自備款 */
  downPayment: number;
  /** 貸款金額 */
  loanAmount: number;
  /** 稅費總計 */
  totalTaxFees: number;
  /** 實際需準備資金（自備款 + 稅費 + 仲介費） */
  totalCashRequired: number;
  /** 每月房貸 */
  monthlyMortgage: number;
  /** 稅費明細 */
  taxFeeDetails: TaxFeeResult;
  /** 房貸明細 */
  mortgageDetails: MortgageResult;
  /** 設定參數 */
  params: {
    mortgage: MortgageParams;
    taxFee: TaxFeeParams;
  };
}

// ====== 預設值 ======

export const DEFAULT_MORTGAGE_PARAMS: MortgageParams = {
  totalPrice: 1500,
  downPaymentRatio: 0.2,
  annualRate: 2.185,
  loanYears: 30,
  gracePeriod: 0,
  repaymentMethod: 'interest_equal',
};

export const DEFAULT_TAX_FEE_PARAMS: TaxFeeParams = {
  totalPrice: 1500,
  assessedValueRatio: 0.25,
  buyerAgencyRate: 0.02,
  hasInvoice: false,
};

// ====== 房貸計算 ======

/**
 * 計算每月本息均攤還款
 */
function calcEqualInterestMonthlyPayment(
  principal: number,
  monthlyRate: number,
  totalMonths: number
): number {
  if (monthlyRate === 0) return principal / totalMonths;
  const factor = Math.pow(1 + monthlyRate, totalMonths);
  return principal * (monthlyRate * factor) / (factor - 1);
}

/**
 * 計算房貸詳細資訊
 */
export function calculateMortgage(params: MortgageParams): MortgageResult {
  const { totalPrice, downPaymentRatio, annualRate, loanYears, gracePeriod, repaymentMethod } = params;

  const totalPriceYuan = totalPrice * 10000; // 轉為元
  const downPayment = totalPrice * downPaymentRatio;
  const loanAmount = totalPrice - downPayment;
  const loanAmountYuan = loanAmount * 10000;

  const monthlyRate = (annualRate / 100) / 12;
  const totalMonths = loanYears * 12;
  const graceMonths = gracePeriod * 12;

  let monthlyPayment: number;
  let totalPayment: number;
  let gracePeriodPayment: number;
  let yearlyBreakdown: YearlyBreakdown[] = [];
  let fixedMonthlyPayment: number | undefined;
  let principalMonthlyBreakdown: { month: number; payment: number; principal: number; interest: number; balance: number }[] | undefined;

  if (repaymentMethod === 'interest_equal') {
    // 本息均攤
    if (graceMonths > 0) {
      // 寬限期：只還利息
      gracePeriodPayment = loanAmountYuan * monthlyRate;

      // 寬限期後，剩餘本金不變，分期還款
      const remainingMonths = totalMonths - graceMonths;
      fixedMonthlyPayment = calcEqualInterestMonthlyPayment(loanAmountYuan, monthlyRate, remainingMonths);
      monthlyPayment = fixedMonthlyPayment;

      // 總還款 = 寬限期利息 + 寬限期後本息
      const graceInterest = gracePeriodPayment * graceMonths;
      const afterGraceTotal = fixedMonthlyPayment * remainingMonths;
      totalPayment = graceInterest + afterGraceTotal;

      // 逐年明細
      let balance = loanAmountYuan;
      for (let year = 1; year <= loanYears; year++) {
        let yearPrincipal = 0;
        let yearInterest = 0;

        for (let m = 1; m <= 12; m++) {
          const globalMonth = (year - 1) * 12 + m;
          if (globalMonth <= graceMonths) {
            // 寬限期內
            yearInterest += gracePeriodPayment;
          } else {
            const afterGraceMonth = globalMonth - graceMonths;
            const interest = balance * monthlyRate;
            const principal = fixedMonthlyPayment - interest;
            balance -= principal;
            yearPrincipal += principal;
            yearInterest += interest;
          }
        }

        yearlyBreakdown.push({
          year,
          principalPaid: Math.round(yearPrincipal),
          interestPaid: Math.round(yearInterest),
          totalPaid: Math.round(yearPrincipal + yearInterest),
          remainingBalance: Math.round(balance),
        });
      }
    } else {
      // 無寬限期
      fixedMonthlyPayment = calcEqualInterestMonthlyPayment(loanAmountYuan, monthlyRate, totalMonths);
      monthlyPayment = fixedMonthlyPayment;
      gracePeriodPayment = monthlyPayment;

      totalPayment = fixedMonthlyPayment * totalMonths;

      // 逐年明細
      let balance = loanAmountYuan;
      for (let year = 1; year <= loanYears; year++) {
        let yearPrincipal = 0;
        let yearInterest = 0;

        for (let m = 1; m <= 12; m++) {
          const interest = balance * monthlyRate;
          const principal = fixedMonthlyPayment - interest;
          balance -= principal;
          yearPrincipal += principal;
          yearInterest += interest;
        }

        yearlyBreakdown.push({
          year,
          principalPaid: Math.round(yearPrincipal),
          interestPaid: Math.round(yearInterest),
          totalPaid: Math.round(yearPrincipal + yearInterest),
          remainingBalance: Math.round(balance),
        });
      }
    }
  } else {
    // 本金均攤
    const monthlyPrincipal = loanAmountYuan / totalMonths;
    gracePeriodPayment = loanAmountYuan * monthlyRate + monthlyPrincipal;

    principalMonthlyBreakdown = [];
    let balance = loanAmountYuan;
    let totalPaid = 0;

    for (let month = 1; month <= totalMonths; month++) {
      const interest = balance * monthlyRate;
      const principal = monthlyPrincipal;
      const payment = principal + interest;
      balance -= principal;
      totalPaid += payment;

      principalMonthlyBreakdown.push({
        month,
        payment: Math.round(payment),
        principal: Math.round(principal),
        interest: Math.round(interest),
        balance: Math.round(balance),
      });

      if (month <= graceMonths) {
        // 寬限期只還利息
        const graceInterest = balance * monthlyRate; // balance still full
        // Actually in grace period, we only pay interest
      }
    }

    // First month payment as representative
    monthlyPayment = principalMonthlyBreakdown[0]?.payment || 0;
    totalPayment = totalPaid;

    // 逐年明細
    for (let year = 1; year <= loanYears; year++) {
      const start = (year - 1) * 12;
      const end = Math.min(year * 12, totalMonths) - 1;
      if (start >= principalMonthlyBreakdown.length) break;

      const yearEntries = principalMonthlyBreakdown.slice(start, end + 1);
      yearlyBreakdown.push({
        year,
        principalPaid: Math.round(yearEntries.reduce((s, e) => s + e.principal, 0)),
        interestPaid: Math.round(yearEntries.reduce((s, e) => s + e.interest, 0)),
        totalPaid: Math.round(yearEntries.reduce((s, e) => s + e.payment, 0)),
        remainingBalance: yearEntries[yearEntries.length - 1]?.balance || 0,
      });
    }
  }

  return {
    loanAmount,
    downPayment,
    monthlyPayment: Math.round(monthlyPayment),
    totalPayment: Math.round(totalPayment),
    totalInterest: Math.round(totalPayment - loanAmountYuan),
    gracePeriodPayment: Math.round(gracePeriodPayment),
    yearlyBreakdown,
    fixedMonthlyPayment: fixedMonthlyPayment ? Math.round(fixedMonthlyPayment) : undefined,
    principalMonthlyBreakdown,
  };
}

// ====== 稅費計算 ======

/**
 * 計算交易稅費
 */
export function calculateTaxFees(params: TaxFeeParams): TaxFeeResult {
  const { totalPrice, assessedValueRatio, buyerAgencyRate, hasInvoice } = params;

  const totalPriceYuan = totalPrice * 10000;
  const assessedValue = totalPrice * assessedValueRatio; // 房屋評定現值（萬元）
  const assessedValueYuan = assessedValue * 10000;

  // 契稅：房屋評定現值 × 6%
  const deedTax = Math.round(assessedValueYuan * 0.06);

  // 印花稅：房屋評定現值 × 0.1%
  const stampDuty = Math.round(assessedValueYuan * 0.001);

  // 登記規費：房屋評定現值 × 0.1%
  const registrationFee = Math.round(assessedValueYuan * 0.001);

  // 代書費（含實價登錄、簽約、過戶、設定）
  const notaryFee = 15000;

  // 謄本費
  const copyFee = 200;

  // 買方仲介費
  const effectiveRate = hasInvoice ? 0.01 : buyerAgencyRate;
  const buyerAgencyFee = Math.round(totalPriceYuan * effectiveRate);

  // 貸款開辦費
  const loanAmount = totalPrice - (totalPrice * 0.2); // 預設 8 成貸款
  const loanOriginationFee = 5000;

  // 設定規費：貸款金額 × 1.2 × 0.1%
  const mortgageSetupFee = Math.round((loanAmount * 10000) * 1.2 * 0.001);

  // 火險 + 地震險（首年）
  const insuranceFee = 4000;

  const subtotal = deedTax + stampDuty + registrationFee + notaryFee + copyFee +
    buyerAgencyFee + loanOriginationFee + mortgageSetupFee + insuranceFee;

  return {
    deedTax,
    stampDuty,
    registrationFee,
    notaryFee,
    copyFee,
    buyerAgencyFee,
    loanOriginationFee,
    mortgageSetupFee,
    insuranceFee,
    subtotal,
  };
}

// ====== 綜合成本試算 ======

/**
 * 完整購屋成本試算
 */
export function calculateTotalCost(
  totalPrice: number,
  mortgageOverrides?: Partial<MortgageParams>,
  taxFeeOverrides?: Partial<TaxFeeParams>
): CostSummary {
  const mortgageParams: MortgageParams = {
    ...DEFAULT_MORTGAGE_PARAMS,
    totalPrice,
    ...mortgageOverrides,
  };

  const taxFeeParams: TaxFeeParams = {
    ...DEFAULT_TAX_FEE_PARAMS,
    totalPrice,
    ...taxFeeOverrides,
  };

  const mortgageResult = calculateMortgage(mortgageParams);
  const taxFeeResult = calculateTaxFees(taxFeeParams);

  // 實際需準備資金 = 自備款 + 所有稅費
  const totalCashRequired = (mortgageResult.downPayment * 10000) + taxFeeResult.subtotal;

  return {
    totalPrice,
    downPayment: mortgageResult.downPayment,
    loanAmount: mortgageResult.loanAmount,
    totalTaxFees: taxFeeResult.subtotal,
    totalCashRequired,
    monthlyMortgage: mortgageResult.monthlyPayment,
    taxFeeDetails: taxFeeResult,
    mortgageDetails: mortgageResult,
    params: {
      mortgage: mortgageParams,
      taxFee: taxFeeParams,
    },
  };
}

/**
 * 格式化金額（元 → 可讀字串）
 */
export function formatCurrency(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(2)} 億`;
  }
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)} 萬`;
  }
  return amount.toLocaleString() + ' 元';
}

/**
 * 格式化金額精確版
 */
export function formatCurrencyDetail(amount: number): string {
  return `${amount.toLocaleString()} 元`;
}
