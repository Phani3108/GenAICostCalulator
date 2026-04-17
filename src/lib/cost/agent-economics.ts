import { getPricing } from './pricing';
import { getPlatformTax } from './platform-tax';
import {
  AgentEconomicsInput,
  AgentCOGS,
  ChainStepCost,
  UnitEconomics,
  PricingModel,
  PricingModelComparison,
  PaybackResult,
  BreakEvenResult,
  ChurnSensitivityPoint,
  PricingRecommendation,
  PricingTier,
  MarginProjectionPoint,
  PriceChainExport,
  Warning,
} from './schema';

// ────────────────────────────────────────────────────────────────────────────
// 1. COGS — Chain-aware cost calculation
// ────────────────────────────────────────────────────────────────────────────

export function simulateAgentTask(input: AgentEconomicsInput): AgentCOGS {
  const pricing = getPricing();
  const infra = pricing.infra[input.hosting] ?? pricing.infra.cloud_run;

  const monthlyTasks = input.customerCount * input.tasksPerCustomer;
  const explanation: string[] = [
    `Monthly tasks = ${fmt(input.customerCount)} customers × ${input.tasksPerCustomer} tasks/customer = ${fmt(monthlyTasks)}`,
  ];

  // ── Per-step inference ──
  let totalInferenceCost = 0;
  const chainBreakdown: ChainStepCost[] = [];

  for (const step of input.chain) {
    const model = pricing.models[step.modelId];
    if (!model) throw new Error(`Unknown model in chain step "${step.name}": ${step.modelId}`);

    const totalCalls = monthlyTasks * step.callsPerTask;
    const effectiveCalls = totalCalls * (1 - input.cacheHitRate);
    const inTokens = effectiveCalls * step.avgInputTokens;
    const outTokens = effectiveCalls * step.avgOutputTokens;
    const cost =
      (inTokens / 1000) * model.input_cost_per_1k +
      (outTokens / 1000) * model.output_cost_per_1k;

    totalInferenceCost += cost;
    chainBreakdown.push({
      name: step.name,
      modelId: step.modelId,
      modelName: model.name,
      callsPerMonth: totalCalls,
      inputTokens: inTokens,
      outputTokens: outTokens,
      inferenceCost: cost,
      percentageOfCogs: 0, // filled after total
    });

    explanation.push(
      `${step.name}: ${fmt(totalCalls)} calls × ${step.callsPerTask}/task → ${model.name} = $${cost.toFixed(2)}`,
    );
  }

  // ── RAG layers (shared, computed once) ──
  const embModel = pricing.embedding_models[input.embeddingModelId];
  const vecDb = pricing.vector_db[input.vectorDbId];

  let embeddingIndexingCost = 0;
  if (input.ragEnabled && embModel) {
    const docTokens = input.avgDocTokens || 500;
    embeddingIndexingCost =
      ((input.documentsIndexed * docTokens) / 1000) *
      embModel.cost_per_1k_tokens /
      12;
    explanation.push(`Embedding indexing (amortised/12) = $${embeddingIndexingCost.toFixed(2)}`);
  }

  let vectorRetrievalCost = 0;
  if (input.ragEnabled) {
    // Use the first chain step's input tokens as proxy for query embedding size
    const queryTokens = input.chain[0]?.avgInputTokens ?? 500;
    const monthlyQueries = monthlyTasks * input.retrievalRate;

    let queryEmbeddingCost = 0;
    if (embModel) {
      queryEmbeddingCost =
        ((monthlyQueries * queryTokens) / 1000) * embModel.cost_per_1k_tokens;
    }

    let vectorStorageCost = 0;
    let vectorQueryCost = 0;
    if (vecDb) {
      const dims = input.embeddingDimensions || 768;
      const storageGb = (input.documentsIndexed * dims * 4) / 1024 ** 3;
      vectorStorageCost = storageGb * vecDb.storage_per_gb_monthly;
      const topK = input.topK || 5;
      vectorQueryCost = ((monthlyQueries * topK) / 1000) * vecDb.query_per_1k;
    }

    vectorRetrievalCost = queryEmbeddingCost + vectorStorageCost + vectorQueryCost;
    explanation.push(`Vector retrieval = $${vectorRetrievalCost.toFixed(2)}`);
  }

  // ── Infrastructure overhead ──
  const trafficMultiplier =
    input.trafficPattern === 'burst' ? infra.burst_multiplier : infra.steady_multiplier;
  const infraCost = totalInferenceCost * infra.overhead_pct_of_inference * trafficMultiplier;

  // ── Networking + Observability ──
  const subtotal = totalInferenceCost + embeddingIndexingCost + vectorRetrievalCost + infraCost;
  const networkingCost = subtotal * pricing.networking.pct_of_total;
  const observabilityCost = subtotal * pricing.observability.pct_of_total;

  const totalMonthlyCost =
    totalInferenceCost +
    embeddingIndexingCost +
    vectorRetrievalCost +
    infraCost +
    networkingCost +
    observabilityCost;

  explanation.push(
    `Infrastructure (${(infra.overhead_pct_of_inference * 100).toFixed(0)}% × ${trafficMultiplier}) = $${infraCost.toFixed(2)}`,
    `Networking (${(pricing.networking.pct_of_total * 100).toFixed(0)}%) = $${networkingCost.toFixed(2)}`,
    `Observability (${(pricing.observability.pct_of_total * 100).toFixed(0)}%) = $${observabilityCost.toFixed(2)}`,
    `Total COGS = $${totalMonthlyCost.toFixed(2)} → $${monthlyTasks > 0 ? (totalMonthlyCost / monthlyTasks).toFixed(6) : '0'}/task`,
  );

  // Fill percentageOfCogs
  for (const step of chainBreakdown) {
    step.percentageOfCogs = totalMonthlyCost > 0
      ? (step.inferenceCost / totalMonthlyCost) * 100
      : 0;
  }

  return {
    totalMonthlyCost,
    costPerTask: monthlyTasks > 0 ? totalMonthlyCost / monthlyTasks : 0,
    monthlyTasks,
    chainBreakdown,
    infraCost,
    networkingCost,
    observabilityCost,
    embeddingIndexingCost,
    vectorRetrievalCost,
    explanation,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Revenue calculation
// ────────────────────────────────────────────────────────────────────────────

export function calculateRevenue(
  input: AgentEconomicsInput,
  overridePricingModel?: PricingModel,
  overridePrice?: number,
): number {
  const model = overridePricingModel ?? input.pricingModel;
  const price = overridePrice ?? input.pricePerUnit;
  const monthlyTasks = input.customerCount * input.tasksPerCustomer;

  switch (model) {
    case 'per_seat':
      return price * input.customerCount;
    case 'per_action':
      return price * monthlyTasks;
    case 'outcome_based':
      // Assume 70% success rate for outcome-based pricing
      return price * monthlyTasks * 0.7;
    case 'rev_share':
      // pricePerUnit = % of customer value; assume avg $200/mo customer value
      return (price / 100) * 200 * input.customerCount;
    default:
      return price * input.customerCount;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Unit Economics
// ────────────────────────────────────────────────────────────────────────────

export function calculateUnitEconomics(
  input: AgentEconomicsInput,
  cogs?: AgentCOGS,
): UnitEconomics {
  const cogsResult = cogs ?? simulateAgentTask(input);
  const revenue = calculateRevenue(input);
  const taxPct = input.platformTaxPct > 0 ? input.platformTaxPct : getPlatformTax(input.platformId);
  const platformTaxAmount = revenue * (taxPct / 100);
  const netRevenue = revenue - platformTaxAmount;
  const grossMargin = netRevenue - cogsResult.totalMonthlyCost;
  const grossMarginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0;
  const contributionMargin = grossMargin - (input.monthlyFixedCosts ?? 0);
  const monthlyTasks = cogsResult.monthlyTasks;

  return {
    monthlyRevenue: revenue,
    monthlyCogs: cogsResult.totalMonthlyCost,
    platformTaxAmount,
    netRevenue,
    grossMargin,
    grossMarginPct,
    contributionMargin,
    revenuePerTask: monthlyTasks > 0 ? revenue / monthlyTasks : 0,
    cogsPerTask: cogsResult.costPerTask,
    marginPerTask: monthlyTasks > 0 ? grossMargin / monthlyTasks : 0,
    revenuePerCustomer: input.customerCount > 0 ? revenue / input.customerCount : 0,
    cogsPerCustomer: input.customerCount > 0 ? cogsResult.totalMonthlyCost / input.customerCount : 0,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Pricing Model Comparison
// ────────────────────────────────────────────────────────────────────────────

const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  per_seat: 'Per Seat ($/mo)',
  per_action: 'Per Action ($)',
  outcome_based: 'Outcome-Based ($)',
  rev_share: 'Revenue Share (%)',
};

// Default prices for comparison when user hasn't set them
const DEFAULT_PRICES: Record<PricingModel, number> = {
  per_seat: 29,
  per_action: 0.05,
  outcome_based: 0.50,
  rev_share: 15,
};

export function comparePricingModels(input: AgentEconomicsInput): PricingModelComparison[] {
  const cogs = simulateAgentTask(input);
  const models: PricingModel[] = ['per_seat', 'per_action', 'outcome_based', 'rev_share'];

  return models
    .map((pm) => {
      const price = pm === input.pricingModel ? input.pricePerUnit : DEFAULT_PRICES[pm];
      const revenue = calculateRevenue(input, pm, price);
      const taxPct = input.platformTaxPct > 0 ? input.platformTaxPct : getPlatformTax(input.platformId);
      const platformTax = revenue * (taxPct / 100);
      const grossMargin = revenue - platformTax - cogs.totalMonthlyCost;
      const grossMarginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0;
      const revenuePerCustomer = input.customerCount > 0 ? revenue / input.customerCount : 0;
      const cogsPerCustomer = input.customerCount > 0 ? cogs.totalMonthlyCost / input.customerCount : 0;
      const taxPerCustomer = input.customerCount > 0 ? platformTax / input.customerCount : 0;
      const contributionPerCustomer = revenuePerCustomer - cogsPerCustomer - taxPerCustomer;
      const breakEvenCustomers =
        contributionPerCustomer > 0 && (input.monthlyFixedCosts ?? 0) > 0
          ? Math.ceil((input.monthlyFixedCosts ?? 0) / contributionPerCustomer)
          : 0;
      const paybackMonths =
        contributionPerCustomer > 0 && input.customerAcquisitionCost > 0
          ? input.customerAcquisitionCost / contributionPerCustomer
          : contributionPerCustomer <= 0
            ? Infinity
            : 0;

      return {
        pricingModel: pm,
        label: PRICING_MODEL_LABELS[pm],
        monthlyRevenue: revenue,
        monthlyCogs: cogs.totalMonthlyCost,
        platformTax,
        grossMargin,
        grossMarginPct,
        breakEvenCustomers,
        paybackMonths: paybackMonths === Infinity ? 999 : Math.round(paybackMonths * 10) / 10,
        isSelected: pm === input.pricingModel,
      };
    })
    .sort((a, b) => b.grossMarginPct - a.grossMarginPct);
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Payback Period
// ────────────────────────────────────────────────────────────────────────────

export function calculatePaybackPeriod(input: AgentEconomicsInput): PaybackResult {
  const ue = calculateUnitEconomics(input);
  const marginPerCustomer = ue.revenuePerCustomer - ue.cogsPerCustomer - (ue.platformTaxAmount / input.customerCount);

  if (marginPerCustomer <= 0 || input.customerAcquisitionCost <= 0) {
    return {
      months: marginPerCustomer <= 0 ? 999 : 0,
      monthlyMarginPerCustomer: marginPerCustomer,
      health: marginPerCustomer <= 0 ? 'unsustainable' : 'healthy',
    };
  }

  const months = input.customerAcquisitionCost / marginPerCustomer;

  let health: PaybackResult['health'];
  if (months <= 6) health = 'healthy';
  else if (months <= 12) health = 'acceptable';
  else if (months <= 24) health = 'risky';
  else health = 'unsustainable';

  return {
    months: Math.round(months * 10) / 10,
    monthlyMarginPerCustomer: marginPerCustomer,
    health,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Break-Even Analysis
// ────────────────────────────────────────────────────────────────────────────

export function calculateBreakEven(input: AgentEconomicsInput): BreakEvenResult {
  const cogs = simulateAgentTask(input);
  const revenue = calculateRevenue(input);
  const taxPct = input.platformTaxPct > 0 ? input.platformTaxPct : getPlatformTax(input.platformId);

  const revenuePerCustomer = input.customerCount > 0 ? revenue / input.customerCount : 0;
  const cogsPerCustomer = input.customerCount > 0 ? cogs.totalMonthlyCost / input.customerCount : 0;
  const taxPerCustomer = revenuePerCustomer * (taxPct / 100);
  const variableCostPerCustomer = cogsPerCustomer + taxPerCustomer;
  const contributionPerCustomer = revenuePerCustomer - variableCostPerCustomer;
  const fixedCosts = input.monthlyFixedCosts ?? 0;

  const customers =
    contributionPerCustomer > 0 && fixedCosts > 0
      ? Math.ceil(fixedCosts / contributionPerCustomer)
      : 0;

  return {
    customers,
    variableCostPerCustomer,
    contributionPerCustomer,
    monthlyFixedCosts: fixedCosts,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 7. Margin-at-Scale Projection
// ────────────────────────────────────────────────────────────────────────────

export function projectMarginAtScale(
  input: AgentEconomicsInput,
  monthlyGrowthPct: number,
  months: number = 12,
): MarginProjectionPoint[] {
  const points: MarginProjectionPoint[] = [];

  for (let m = 1; m <= months; m++) {
    const factor = Math.pow(1 + monthlyGrowthPct / 100, m - 1);
    const scaledCustomers = Math.round(input.customerCount * factor);
    const scaled = { ...input, customerCount: scaledCustomers };

    try {
      const cogs = simulateAgentTask(scaled);
      const revenue = calculateRevenue(scaled);
      const taxPct = input.platformTaxPct > 0 ? input.platformTaxPct : getPlatformTax(input.platformId);
      const platformTax = revenue * (taxPct / 100);
      const grossMargin = revenue - platformTax - cogs.totalMonthlyCost;
      const grossMarginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0;

      points.push({
        month: m,
        label: m === 1 ? 'Now' : `M${m}`,
        customers: scaledCustomers,
        monthlyRevenue: revenue,
        monthlyCogs: cogs.totalMonthlyCost,
        grossMargin,
        grossMarginPct,
      });
    } catch {
      break;
    }
  }

  return points;
}

// ────────────────────────────────────────────────────────────────────────────
// 8. Churn Sensitivity
// ────────────────────────────────────────────────────────────────────────────

export function churnSensitivity(input: AgentEconomicsInput): ChurnSensitivityPoint[] {
  const multipliers = [0.5, 0.8, 1.0, 1.2, 1.5, 2.0];
  const baseChurn = input.churnRatePct > 0 ? input.churnRatePct : 5;

  return multipliers.map((mult) => {
    const churn = baseChurn * mult;
    // Steady-state customers = new customers per month / churn rate
    // Assume current customer count is steady-state at base churn
    const newCustomersPerMonth = input.customerCount * (baseChurn / 100);
    const steadyState = churn > 0 ? Math.round(newCustomersPerMonth / (churn / 100)) : input.customerCount;

    const scaled = { ...input, customerCount: steadyState };
    const cogs = simulateAgentTask(scaled);
    const revenue = calculateRevenue(scaled);
    const taxPct = input.platformTaxPct > 0 ? input.platformTaxPct : getPlatformTax(input.platformId);
    const platformTax = revenue * (taxPct / 100);
    const grossMargin = revenue - platformTax - cogs.totalMonthlyCost;
    const grossMarginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0;

    const marginPerCustomer = steadyState > 0 ? grossMargin / steadyState : 0;
    const payback = marginPerCustomer > 0 && input.customerAcquisitionCost > 0
      ? input.customerAcquisitionCost / marginPerCustomer
      : 999;

    return {
      churnMultiplier: mult,
      churnRatePct: churn,
      steadyStateCustomers: steadyState,
      monthlyRevenue: revenue,
      grossMargin,
      grossMarginPct,
      paybackMonths: Math.round(payback * 10) / 10,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 9. Pricing Recommendation
// ────────────────────────────────────────────────────────────────────────────

export function generatePricingRecommendation(
  input: AgentEconomicsInput,
): PricingRecommendation {
  const cogs = simulateAgentTask(input);
  const cogsPerTask = cogs.costPerTask;
  const cogsPerCustomer = input.customerCount > 0 ? cogs.totalMonthlyCost / input.customerCount : 0;
  // COGS floor: never price below 1.3× COGS (min 30% margin)
  const cogsFloor = cogsPerCustomer * 1.3;

  let tiers: PricingTier[];
  let rationale: string;

  switch (input.pricingModel) {
    case 'per_seat': {
      const starterPrice = Math.max(Math.ceil(cogsFloor * 1.5), 9);
      const proPrice = Math.max(Math.ceil(cogsFloor * 2.5), starterPrice * 2);
      const enterprisePrice = Math.max(Math.ceil(cogsFloor * 4), proPrice * 2);

      tiers = [
        { tierName: 'Starter', price: starterPrice, unit: '/seat/month', included: [`${input.tasksPerCustomer} tasks/mo`, 'Standard models'], limits: 'Single model, no priority' },
        { tierName: 'Pro', price: proPrice, unit: '/seat/month', included: [`${input.tasksPerCustomer * 3} tasks/mo`, 'All models', 'Priority support'], limits: null },
        { tierName: 'Enterprise', price: enterprisePrice, unit: '/seat/month', included: ['Unlimited tasks', 'Custom models', 'SLA', 'Dedicated support'], limits: null },
      ];
      rationale = `Based on $${cogsPerCustomer.toFixed(2)}/customer COGS. Starter at ${((1 - cogsPerCustomer / starterPrice) * 100).toFixed(0)}% margin, Pro at ${((1 - cogsPerCustomer / proPrice) * 100).toFixed(0)}% margin.`;
      break;
    }
    case 'per_action': {
      const basePrice = Math.max(cogsPerTask * 1.5, 0.001);
      tiers = [
        { tierName: 'Pay-as-you-go', price: Math.round(basePrice * 10000) / 10000, unit: '/action', included: ['All models', 'Standard latency'], limits: 'Rate limited to 100/min' },
        { tierName: 'Growth', price: Math.round(basePrice * 0.8 * 10000) / 10000, unit: '/action', included: ['Volume discount', 'Priority queue', '10K actions/mo minimum'], limits: null },
        { tierName: 'Enterprise', price: Math.round(basePrice * 0.6 * 10000) / 10000, unit: '/action', included: ['Committed volume', 'Custom SLA', 'Dedicated capacity'], limits: null },
      ];
      rationale = `Base price at 1.5× COGS ($${cogsPerTask.toFixed(6)}/task). Volume tiers offer 20% and 40% discounts.`;
      break;
    }
    case 'outcome_based': {
      const basePrice = Math.max(cogsPerTask * 2.5 / 0.7, 0.01); // Adjust for 70% success rate
      tiers = [
        { tierName: 'Standard', price: Math.round(basePrice * 100) / 100, unit: '/successful outcome', included: ['Pay only for results', 'Standard models'], limits: null },
        { tierName: 'Premium', price: Math.round(basePrice * 1.5 * 100) / 100, unit: '/successful outcome', included: ['Premium models', 'Human review fallback'], limits: null },
        { tierName: 'Guaranteed', price: Math.round(basePrice * 2.5 * 100) / 100, unit: '/successful outcome', included: ['SLA guarantee', 'Full audit trail', 'Dedicated support'], limits: null },
      ];
      rationale = `Outcome price factors in 70% success rate. At $${cogsPerTask.toFixed(4)}/task COGS and 70% success, minimum viable price is $${(cogsPerTask / 0.7 * 1.3).toFixed(4)}/outcome.`;
      break;
    }
    case 'rev_share': {
      const minShare = Math.max(Math.ceil((cogsPerCustomer / 200) * 100 * 1.3), 5); // Assume $200 avg customer value
      tiers = [
        { tierName: 'Starter', price: Math.min(minShare, 10), unit: '% revenue share', included: ['Basic integration', 'Standard support'], limits: 'Max 1000 end-users' },
        { tierName: 'Growth', price: Math.min(minShare + 5, 20), unit: '% revenue share', included: ['Advanced features', 'Analytics dashboard'], limits: null },
        { tierName: 'Enterprise', price: Math.min(minShare + 10, 30), unit: '% revenue share', included: ['White-label', 'Custom integration', 'Dedicated success manager'], limits: null },
      ];
      rationale = `Minimum viable share: ${minShare}% (covers COGS at $200 avg customer value). Higher tiers add value to justify incremental share.`;
      break;
    }
  }

  return { tiers, cogsFloor, rationale };
}

// ────────────────────────────────────────────────────────────────────────────
// 10. Investor Narrative
// ────────────────────────────────────────────────────────────────────────────

export function generateInvestorNarrative(input: AgentEconomicsInput): string {
  const cogs = simulateAgentTask(input);
  const ue = calculateUnitEconomics(input, cogs);
  const payback = calculatePaybackPeriod(input);
  const breakEven = calculateBreakEven(input);

  const platformName =
    input.platformId === 'direct' ? 'direct distribution' : input.platformId.replace(/_/g, ' ');

  const lines = [
    `Unit Economics Summary`,
    ``,
    `At ${fmt(input.customerCount)} customers on ${input.pricingModel.replace(/_/g, '-')} pricing, ` +
      `this agent generates $${fmt(Math.round(ue.monthlyRevenue))}/mo revenue against ` +
      `$${fmt(Math.round(ue.monthlyCogs))}/mo COGS, yielding ${ue.grossMarginPct.toFixed(1)}% gross margin.`,
    ``,
    `The agent chain has ${input.chain.length} step${input.chain.length > 1 ? 's' : ''}: ` +
      input.chain.map((s) => s.name).join(' → ') + '.',
    ``,
    `Platform: ${platformName}${input.platformTaxPct > 0 ? ` (${input.platformTaxPct}% platform tax = $${fmt(Math.round(ue.platformTaxAmount))}/mo)` : ''}.`,
  ];

  if (payback.months > 0 && payback.months < 999) {
    lines.push(`CAC payback period: ${payback.months} months (${payback.health}).`);
  }

  if (breakEven.customers > 0) {
    lines.push(`Break-even: ${fmt(breakEven.customers)} customers (at $${fmt(breakEven.monthlyFixedCosts)}/mo fixed costs).`);
  }

  const topStep = [...cogs.chainBreakdown].sort((a, b) => b.inferenceCost - a.inferenceCost)[0];
  if (topStep) {
    lines.push(
      ``,
      `Primary cost driver: "${topStep.name}" step using ${topStep.modelName} ` +
        `(${topStep.percentageOfCogs.toFixed(0)}% of COGS). ` +
        `Consider model routing or a cheaper alternative to improve margins.`,
    );
  }

  if (ue.grossMarginPct < 30) {
    lines.push(``, `⚠ Gross margin below 30% — pricing adjustment or COGS reduction recommended before scaling.`);
  }

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// 11. PriceChain Export
// ────────────────────────────────────────────────────────────────────────────

export function generatePriceChainExport(input: AgentEconomicsInput): PriceChainExport {
  const cogs = simulateAgentTask(input);
  const ue = calculateUnitEconomics(input, cogs);
  const recommendation = generatePricingRecommendation(input);
  const payback = calculatePaybackPeriod(input);
  const breakEven = calculateBreakEven(input);

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    pricingModel: input.pricingModel,
    tiers: recommendation.tiers,
    unitEconomics: {
      cogsPerTask: cogs.costPerTask,
      revenuePerTask: ue.revenuePerTask,
      marginPerTask: ue.marginPerTask,
      grossMarginPct: ue.grossMarginPct,
    },
    targets: {
      targetGrossMarginPct: input.targetGrossMarginPct ?? 70,
      breakEvenCustomers: breakEven.customers,
      paybackMonths: payback.months,
    },
    chain: input.chain.map((s) => ({ name: s.name, modelId: s.modelId, callsPerTask: s.callsPerTask })),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 12. Business Guardrails
// ────────────────────────────────────────────────────────────────────────────

export function generateBusinessWarnings(input: AgentEconomicsInput): Warning[] {
  const warnings: Warning[] = [];
  const ue = calculateUnitEconomics(input);
  const payback = calculatePaybackPeriod(input);
  const breakEven = calculateBreakEven(input);

  if (ue.grossMargin < 0) {
    warnings.push({
      level: 'error',
      title: 'Negative gross margin',
      message: `Revenue ($${fmt(Math.round(ue.monthlyRevenue))}) does not cover COGS ($${fmt(Math.round(ue.monthlyCogs))}) + platform tax ($${fmt(Math.round(ue.platformTaxAmount))}). Increase price or reduce costs.`,
    });
  }

  if (breakEven.customers > 0 && breakEven.customers > input.customerCount * 10) {
    warnings.push({
      level: 'error',
      title: 'Break-even far above current scale',
      message: `Need ${fmt(breakEven.customers)} customers to break even, but you have ${fmt(input.customerCount)}. Reduce fixed costs or increase contribution per customer.`,
    });
  }

  if (payback.months > 18 && payback.months < 999) {
    warnings.push({
      level: 'warning',
      title: 'Long payback period',
      message: `CAC payback is ${payback.months} months. Target <12 months for sustainable growth.`,
    });
  }

  const taxPct = input.platformTaxPct > 0 ? input.platformTaxPct : getPlatformTax(input.platformId);
  if (taxPct > 25) {
    warnings.push({
      level: 'warning',
      title: 'High platform tax',
      message: `Platform takes ${taxPct}% of revenue. Consider direct distribution to improve margins by ${(taxPct - 5).toFixed(0)}+ percentage points.`,
    });
  }

  if (input.churnRatePct > 10) {
    warnings.push({
      level: 'warning',
      title: 'High churn rate',
      message: `${input.churnRatePct}% monthly churn = ${Math.round(100 - Math.pow(1 - input.churnRatePct / 100, 12) * 100)}% annual. Customer lifetime is only ${(1 / (input.churnRatePct / 100)).toFixed(1)} months.`,
    });
  }

  const llmCostPct = ue.monthlyRevenue > 0 ? (ue.monthlyCogs / ue.monthlyRevenue) * 100 : 0;
  if (llmCostPct > 60) {
    warnings.push({
      level: 'warning',
      title: 'LLM cost pass-through risk',
      message: `LLM costs are ${llmCostPct.toFixed(0)}% of revenue. Provider price changes directly impact your margin. Consider model routing or caching.`,
    });
  }

  if (ue.grossMarginPct > 80) {
    warnings.push({
      level: 'info',
      title: 'Very high margin',
      message: `${ue.grossMarginPct.toFixed(0)}% gross margin is unusual — validate assumptions. If accurate, there is room to compete on price or invest in quality.`,
    });
  }

  return warnings;
}

// ── Helpers ──

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}
