import { describe, it, expect } from 'vitest';
import {
  simulateAgentTask,
  calculateRevenue,
  calculateUnitEconomics,
  comparePricingModels,
  calculatePaybackPeriod,
  calculateBreakEven,
  churnSensitivity,
  projectMarginAtScale,
  generatePricingRecommendation,
  generateInvestorNarrative,
  generatePriceChainExport,
  generateBusinessWarnings,
} from '../agent-economics';
import { AgentEconomicsInput } from '../schema';

const singleStepAgent: AgentEconomicsInput = {
  pricingModel: 'per_seat',
  pricePerUnit: 29,
  targetGrossMarginPct: 70,
  monthlyFixedCosts: 0,
  customerCount: 1000,
  tasksPerCustomer: 50,
  churnRatePct: 5,
  customerAcquisitionCost: 100,
  platformId: 'direct',
  platformTaxPct: 0,
  chain: [
    { name: 'Executor', modelId: 'claude_sonnet_45', avgInputTokens: 800, avgOutputTokens: 400, callsPerTask: 1 },
  ],
  cacheHitRate: 0.1,
  ragEnabled: false,
  embeddingModelId: 'vertex_textembedding_004',
  vectorDbId: 'vertex_vector_search',
  documentsIndexed: 0,
  retrievalRate: 0,
  avgDocTokens: 500,
  topK: 5,
  embeddingDimensions: 768,
  trafficPattern: 'steady',
  hosting: 'cloud_run',
};

const multiStepAgent: AgentEconomicsInput = {
  pricingModel: 'per_action',
  pricePerUnit: 0.05,
  targetGrossMarginPct: 60,
  monthlyFixedCosts: 5000,
  customerCount: 500,
  tasksPerCustomer: 200,
  churnRatePct: 8,
  customerAcquisitionCost: 250,
  platformId: 'openai_marketplace',
  platformTaxPct: 30,
  chain: [
    { name: 'Router', modelId: 'gpt_5_mini', avgInputTokens: 200, avgOutputTokens: 50, callsPerTask: 1 },
    { name: 'Executor', modelId: 'claude_sonnet_45', avgInputTokens: 1500, avgOutputTokens: 800, callsPerTask: 1 },
    { name: 'Critic', modelId: 'claude_haiku_45', avgInputTokens: 600, avgOutputTokens: 100, callsPerTask: 2 },
  ],
  cacheHitRate: 0.15,
  ragEnabled: true,
  embeddingModelId: 'vertex_textembedding_004',
  vectorDbId: 'vertex_vector_search',
  documentsIndexed: 100000,
  retrievalRate: 0.6,
  avgDocTokens: 800,
  topK: 5,
  embeddingDimensions: 768,
  trafficPattern: 'steady',
  hosting: 'cloud_run',
};

const negativMarginAgent: AgentEconomicsInput = {
  ...singleStepAgent,
  pricePerUnit: 0.50, // $0.50/seat — way too cheap
  customerCount: 10,
  chain: [
    { name: 'Executor', modelId: 'claude_opus_46', avgInputTokens: 2000, avgOutputTokens: 1200, callsPerTask: 3 },
  ],
};

// ── simulateAgentTask ──

describe('simulateAgentTask', () => {
  it('computes COGS for single-step chain', () => {
    const cogs = simulateAgentTask(singleStepAgent);
    expect(cogs.totalMonthlyCost).toBeGreaterThan(0);
    expect(cogs.monthlyTasks).toBe(50000);
    expect(cogs.costPerTask).toBeGreaterThan(0);
    expect(cogs.chainBreakdown).toHaveLength(1);
    expect(cogs.chainBreakdown[0].name).toBe('Executor');
    expect(cogs.infraCost).toBeGreaterThan(0);
    expect(cogs.networkingCost).toBeGreaterThan(0);
    expect(cogs.observabilityCost).toBeGreaterThan(0);
    // No RAG costs
    expect(cogs.embeddingIndexingCost).toBe(0);
    expect(cogs.vectorRetrievalCost).toBe(0);
  });

  it('computes COGS for multi-step chain with RAG', () => {
    const cogs = simulateAgentTask(multiStepAgent);
    expect(cogs.totalMonthlyCost).toBeGreaterThan(0);
    expect(cogs.monthlyTasks).toBe(100000);
    expect(cogs.chainBreakdown).toHaveLength(3);
    expect(cogs.chainBreakdown[0].name).toBe('Router');
    expect(cogs.chainBreakdown[1].name).toBe('Executor');
    expect(cogs.chainBreakdown[2].name).toBe('Critic');
    // Critic has 2 calls/task → more total calls than router
    expect(cogs.chainBreakdown[2].callsPerMonth).toBe(200000);
    expect(cogs.chainBreakdown[0].callsPerMonth).toBe(100000);
    // RAG costs present
    expect(cogs.embeddingIndexingCost).toBeGreaterThan(0);
    expect(cogs.vectorRetrievalCost).toBeGreaterThan(0);
    // Executor should be most expensive step
    expect(cogs.chainBreakdown[1].inferenceCost).toBeGreaterThan(cogs.chainBreakdown[0].inferenceCost);
  });

  it('step percentages sum to less than 100 (infra/network/obs fill rest)', () => {
    const cogs = simulateAgentTask(multiStepAgent);
    const stepPctSum = cogs.chainBreakdown.reduce((s, c) => s + c.percentageOfCogs, 0);
    expect(stepPctSum).toBeLessThan(100);
    expect(stepPctSum).toBeGreaterThan(50); // inference should be majority
  });

  it('throws on unknown model in chain', () => {
    const bad = {
      ...singleStepAgent,
      chain: [{ name: 'Bad', modelId: 'nonexistent_model', avgInputTokens: 100, avgOutputTokens: 100, callsPerTask: 1 }],
    };
    expect(() => simulateAgentTask(bad)).toThrow('Unknown model');
  });
});

// ── calculateRevenue ──

describe('calculateRevenue', () => {
  it('per-seat: price × customers', () => {
    const rev = calculateRevenue(singleStepAgent);
    expect(rev).toBe(29 * 1000);
  });

  it('per-action: price × tasks', () => {
    const rev = calculateRevenue(multiStepAgent);
    expect(rev).toBe(0.05 * 100000);
  });

  it('outcome-based: price × tasks × 0.7', () => {
    const input = { ...singleStepAgent, pricingModel: 'outcome_based' as const, pricePerUnit: 1.00 };
    const rev = calculateRevenue(input);
    expect(rev).toBe(1.00 * 50000 * 0.7);
  });

  it('rev-share: (pct/100) × $200 × customers', () => {
    const input = { ...singleStepAgent, pricingModel: 'rev_share' as const, pricePerUnit: 15 };
    const rev = calculateRevenue(input);
    expect(rev).toBe((15 / 100) * 200 * 1000);
  });
});

// ── calculateUnitEconomics ──

describe('calculateUnitEconomics', () => {
  it('computes positive margin for well-priced agent', () => {
    const ue = calculateUnitEconomics(singleStepAgent);
    expect(ue.monthlyRevenue).toBe(29000);
    expect(ue.monthlyCogs).toBeGreaterThan(0);
    expect(ue.grossMargin).toBeGreaterThan(0);
    expect(ue.grossMarginPct).toBeGreaterThan(0);
    expect(ue.platformTaxAmount).toBe(0); // direct platform
    expect(ue.revenuePerCustomer).toBe(29);
  });

  it('applies platform tax to revenue', () => {
    const ue = calculateUnitEconomics(multiStepAgent);
    expect(ue.platformTaxAmount).toBeGreaterThan(0);
    expect(ue.netRevenue).toBeLessThan(ue.monthlyRevenue);
    // 30% of revenue
    expect(ue.platformTaxAmount).toBeCloseTo(ue.monthlyRevenue * 0.3, 2);
  });

  it('computes negative margin when underpriced', () => {
    const ue = calculateUnitEconomics(negativMarginAgent);
    expect(ue.grossMargin).toBeLessThan(0);
    expect(ue.grossMarginPct).toBeLessThan(0);
  });
});

// ── comparePricingModels ──

describe('comparePricingModels', () => {
  it('returns 4 pricing models sorted by margin', () => {
    const models = comparePricingModels(singleStepAgent);
    expect(models).toHaveLength(4);
    // Sorted by grossMarginPct descending
    for (let i = 1; i < models.length; i++) {
      expect(models[i - 1].grossMarginPct).toBeGreaterThanOrEqual(models[i].grossMarginPct);
    }
  });

  it('marks selected pricing model', () => {
    const models = comparePricingModels(singleStepAgent);
    const selected = models.find((m) => m.isSelected);
    expect(selected).toBeDefined();
    expect(selected!.pricingModel).toBe('per_seat');
  });

  it('all entries share the same COGS', () => {
    const models = comparePricingModels(singleStepAgent);
    const cogs = models[0].monthlyCogs;
    models.forEach((m) => expect(m.monthlyCogs).toBeCloseTo(cogs, 2));
  });
});

// ── calculatePaybackPeriod ──

describe('calculatePaybackPeriod', () => {
  it('returns healthy payback for well-priced agent', () => {
    const result = calculatePaybackPeriod(singleStepAgent);
    expect(result.months).toBeGreaterThan(0);
    expect(result.months).toBeLessThan(24);
    expect(['healthy', 'acceptable']).toContain(result.health);
  });

  it('returns unsustainable for negative margin', () => {
    const result = calculatePaybackPeriod(negativMarginAgent);
    expect(result.months).toBe(999);
    expect(result.health).toBe('unsustainable');
  });

  it('returns 0 months when no CAC', () => {
    const input = { ...singleStepAgent, customerAcquisitionCost: 0 };
    const result = calculatePaybackPeriod(input);
    expect(result.months).toBe(0);
    expect(result.health).toBe('healthy');
  });
});

// ── calculateBreakEven ──

describe('calculateBreakEven', () => {
  it('returns 0 when no fixed costs', () => {
    const result = calculateBreakEven(singleStepAgent);
    expect(result.customers).toBe(0);
    expect(result.monthlyFixedCosts).toBe(0);
  });

  it('computes break-even with fixed costs', () => {
    const result = calculateBreakEven(multiStepAgent);
    expect(result.customers).toBeGreaterThan(0);
    expect(result.monthlyFixedCosts).toBe(5000);
    // Verify: customers × contribution ≥ fixed costs
    expect(result.customers * result.contributionPerCustomer).toBeGreaterThanOrEqual(5000);
  });
});

// ── churnSensitivity ──

describe('churnSensitivity', () => {
  it('returns 6 data points', () => {
    const points = churnSensitivity(singleStepAgent);
    expect(points).toHaveLength(6);
  });

  it('higher churn = fewer steady-state customers', () => {
    const points = churnSensitivity(singleStepAgent);
    // multiplier 0.5 (less churn) should have more customers than 2.0 (more churn)
    expect(points[0].steadyStateCustomers).toBeGreaterThan(points[5].steadyStateCustomers);
  });

  it('higher churn = lower revenue', () => {
    const points = churnSensitivity(singleStepAgent);
    expect(points[0].monthlyRevenue).toBeGreaterThan(points[5].monthlyRevenue);
  });
});

// ── projectMarginAtScale ──

describe('projectMarginAtScale', () => {
  it('returns 12 points', () => {
    const points = projectMarginAtScale(singleStepAgent, 10, 12);
    expect(points).toHaveLength(12);
    expect(points[0].label).toBe('Now');
    expect(points[11].label).toBe('M12');
  });

  it('revenue grows with customer count', () => {
    const points = projectMarginAtScale(singleStepAgent, 10, 12);
    expect(points[11].monthlyRevenue).toBeGreaterThan(points[0].monthlyRevenue);
    expect(points[11].customers).toBeGreaterThan(points[0].customers);
  });

  it('COGS grows with customer count', () => {
    const points = projectMarginAtScale(singleStepAgent, 10, 12);
    expect(points[11].monthlyCogs).toBeGreaterThan(points[0].monthlyCogs);
  });
});

// ── generatePricingRecommendation ──

describe('generatePricingRecommendation', () => {
  it('returns 3 tiers with COGS floor', () => {
    const rec = generatePricingRecommendation(singleStepAgent);
    expect(rec.tiers).toHaveLength(3);
    expect(rec.cogsFloor).toBeGreaterThan(0);
    expect(rec.rationale.length).toBeGreaterThan(0);
    // Tiers should be ascending in price
    expect(rec.tiers[1].price).toBeGreaterThan(rec.tiers[0].price);
    expect(rec.tiers[2].price).toBeGreaterThan(rec.tiers[1].price);
  });

  it('works for per-action model', () => {
    const rec = generatePricingRecommendation(multiStepAgent);
    expect(rec.tiers).toHaveLength(3);
    expect(rec.tiers[0].unit).toContain('action');
  });
});

// ── generateInvestorNarrative ──

describe('generateInvestorNarrative', () => {
  it('returns non-empty narrative', () => {
    const narrative = generateInvestorNarrative(singleStepAgent);
    expect(narrative.length).toBeGreaterThan(100);
    expect(narrative).toContain('Unit Economics Summary');
    expect(narrative).toContain('Executor');
    expect(narrative).toContain('per-seat');
  });
});

// ── generatePriceChainExport ──

describe('generatePriceChainExport', () => {
  it('returns valid PriceChain export', () => {
    const exp = generatePriceChainExport(singleStepAgent);
    expect(exp.version).toBe('1.0.0');
    expect(exp.pricingModel).toBe('per_seat');
    expect(exp.tiers).toHaveLength(3);
    expect(exp.unitEconomics.cogsPerTask).toBeGreaterThan(0);
    expect(exp.unitEconomics.grossMarginPct).toBeGreaterThan(0);
    expect(exp.chain).toHaveLength(1);
    expect(exp.chain[0].name).toBe('Executor');
    expect(exp.targets.breakEvenCustomers).toBeGreaterThanOrEqual(0);
  });
});

// ── generateBusinessWarnings ──

describe('generateBusinessWarnings', () => {
  it('no errors for well-priced agent', () => {
    const warnings = generateBusinessWarnings(singleStepAgent);
    const errors = warnings.filter((w) => w.level === 'error');
    expect(errors).toHaveLength(0);
  });

  it('flags negative margin as error', () => {
    const warnings = generateBusinessWarnings(negativMarginAgent);
    const negMarginError = warnings.find((w) => w.title === 'Negative gross margin');
    expect(negMarginError).toBeDefined();
    expect(negMarginError!.level).toBe('error');
  });

  it('flags high platform tax', () => {
    const warnings = generateBusinessWarnings(multiStepAgent);
    const taxWarning = warnings.find((w) => w.title === 'High platform tax');
    expect(taxWarning).toBeDefined();
  });

  it('flags high churn', () => {
    const input = { ...singleStepAgent, churnRatePct: 15 };
    const warnings = generateBusinessWarnings(input);
    const churnWarning = warnings.find((w) => w.title === 'High churn rate');
    expect(churnWarning).toBeDefined();
  });
});
