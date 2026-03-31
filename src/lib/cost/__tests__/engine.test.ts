import { describe, it, expect } from 'vitest';
import { simulate } from '../engine';
import { compareModels } from '../comparison';
import { getPricing } from '../pricing';
import { generateInsights, getTopLever, analyzeTokenBudget } from '../insights';
import { generateWarnings } from '../guardrails';
import { projectGrowth } from '../projection';
import { generateOptimizedScenario } from '../optimize';
import { classifyWorkload } from '../classification';
import { SimulationInput } from '../schema';

// Current-generation model IDs (2025-2026)
const CHEAP_MODEL = 'gemini_25_flash';     // fastest / cheapest
const MID_MODEL   = 'claude_sonnet_45';    // mid-tier
const TOP_MODEL   = 'claude_opus_46';      // flagship

const baselineNoRag: SimulationInput = {
  monthlyActiveUsers: 100000,
  requestsPerUser: 7,
  avgPromptTokens: 500,
  avgCompletionTokens: 400,
  cacheHitRate: 0.1,
  ragEnabled: false,
  retrievalRate: 0,
  documentsIndexed: 0,
  avgDocTokens: 0,
  topK: 5,
  embeddingDimensions: 768,
  trafficPattern: 'steady',
  hosting: 'cloud_run',
  modelId: CHEAP_MODEL,
  embeddingModelId: 'vertex_textembedding_004',
  vectorDbId: 'vertex_vector_search',
};

const enterpriseBurstRag: SimulationInput = {
  monthlyActiveUsers: 350000,
  requestsPerUser: 10,
  avgPromptTokens: 1100,
  avgCompletionTokens: 550,
  cacheHitRate: 0.25,
  ragEnabled: true,
  retrievalRate: 0.8,
  documentsIndexed: 2000000,
  avgDocTokens: 850,
  topK: 8,
  embeddingDimensions: 768,
  trafficPattern: 'burst',
  hosting: 'cloud_run',
  modelId: MID_MODEL,
  embeddingModelId: 'vertex_textembedding_004',
  vectorDbId: 'vertex_vector_search',
};

const agentWorkflow: SimulationInput = {
  monthlyActiveUsers: 12000,
  requestsPerUser: 25,
  avgPromptTokens: 900,
  avgCompletionTokens: 900,
  cacheHitRate: 0.2,
  ragEnabled: true,
  retrievalRate: 0.55,
  documentsIndexed: 500000,
  avgDocTokens: 900,
  topK: 6,
  embeddingDimensions: 768,
  trafficPattern: 'steady',
  hosting: 'cloud_run',
  modelId: MID_MODEL,
  embeddingModelId: 'vertex_textembedding_004',
  vectorDbId: 'vertex_vector_search',
};

describe('Cost Engine', () => {
  it('computes baseline no-RAG scenario', () => {
    const result = simulate(baselineNoRag);
    expect(result.monthlyRequests).toBe(700000);
    expect(result.totalMonthlyCost).toBeGreaterThan(0);
    expect(result.breakdown.find((b) => b.category === 'Model Inference')).toBeDefined();
    expect(result.breakdown.find((b) => b.category === 'Embedding Indexing')).toBeUndefined();
    expect(result.breakdown.find((b) => b.category === 'Vector Retrieval')).toBeUndefined();
  });

  it('computes enterprise burst RAG scenario', () => {
    const result = simulate(enterpriseBurstRag);
    expect(result.monthlyRequests).toBe(3500000);
    expect(result.totalMonthlyCost).toBeGreaterThan(1000);
    expect(result.breakdown.find((b) => b.category === 'Embedding Indexing')).toBeDefined();
    expect(result.breakdown.find((b) => b.category === 'Vector Retrieval')).toBeDefined();
    expect(result.breakdown.find((b) => b.category === 'Infrastructure')).toBeDefined();
  });

  it('computes agent workflow scenario', () => {
    const result = simulate(agentWorkflow);
    expect(result.monthlyRequests).toBe(300000);
    expect(result.totalMonthlyCost).toBeGreaterThan(0);
    expect(result.costPerRequest).toBeGreaterThan(0);
  });

  it('caching reduces total cost', () => {
    const noCacheResult = simulate({ ...baselineNoRag, cacheHitRate: 0 });
    const withCacheResult = simulate({ ...baselineNoRag, cacheHitRate: 0.5 });
    expect(withCacheResult.totalMonthlyCost).toBeLessThan(noCacheResult.totalMonthlyCost);
  });

  it('burst traffic increases infrastructure cost', () => {
    const steadyResult = simulate({ ...enterpriseBurstRag, trafficPattern: 'steady' });
    const burstResult = simulate({ ...enterpriseBurstRag, trafficPattern: 'burst' });
    const steadyInfra = steadyResult.breakdown.find((b) => b.category === 'Infrastructure')!;
    const burstInfra = burstResult.breakdown.find((b) => b.category === 'Infrastructure')!;
    expect(burstInfra.amount).toBeGreaterThan(steadyInfra.amount);
  });

  it('breakdown percentages sum to ~100', () => {
    const result = simulate(enterpriseBurstRag);
    const sum = result.breakdown.reduce((acc, item) => acc + item.percentage, 0);
    expect(sum).toBeCloseTo(100, 0);
  });

  it('explanation contains formula steps', () => {
    const result = simulate(baselineNoRag);
    expect(result.explanation.length).toBeGreaterThan(3);
    expect(result.explanation.some((s) => s.includes('Monthly requests'))).toBe(true);
  });

  it('higher topK increases vector query cost', () => {
    const lowK = simulate({ ...agentWorkflow, topK: 1 });
    const highK = simulate({ ...agentWorkflow, topK: 10 });
    const lowKVec = lowK.breakdown.find((b) => b.category === 'Vector Retrieval')!;
    const highKVec = highK.breakdown.find((b) => b.category === 'Vector Retrieval')!;
    expect(highKVec.amount).toBeGreaterThan(lowKVec.amount);
  });
});

describe('Model Comparison', () => {
  it('returns entries for all models', () => {
    const entries = compareModels(baselineNoRag);
    const pricing = getPricing();
    expect(entries.length).toBe(Object.keys(pricing.models).length);
  });

  it('cost_first ranks cheapest first', () => {
    const entries = compareModels(baselineNoRag, 'cost_first');
    expect(entries[0].totalMonthlyCost).toBeLessThanOrEqual(entries[1].totalMonthlyCost);
  });

  it('quality_first ranks highest quality first', () => {
    const entries = compareModels(baselineNoRag, 'quality_first');
    expect(entries[0].qualityScore).toBeGreaterThanOrEqual(entries[1].qualityScore);
  });

  it('marks selected model correctly', () => {
    const entries = compareModels(baselineNoRag);
    const selected = entries.find((e) => e.isSelected);
    expect(selected?.modelId).toBe(CHEAP_MODEL);
  });
});

describe('Insights', () => {
  it('generates insights for enterprise scenario', () => {
    const result = simulate(enterpriseBurstRag);
    const insights = generateInsights(enterpriseBurstRag, result);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.length).toBeLessThanOrEqual(5);
    insights.forEach((ins) => {
      expect(ins.title).toBeTruthy();
      expect(ins.estimatedSavingsPct).toBeGreaterThan(0);
    });
  });

  it('top lever identifies the largest cost component', () => {
    const result = simulate(enterpriseBurstRag);
    const lever = getTopLever(enterpriseBurstRag, result);
    expect(lever.contributionPct).toBeGreaterThan(0);
    expect(lever.action).toBeTruthy();
  });
});

describe('Token Budget Analysis', () => {
  it('flags high completion ratio', () => {
    const result = simulate(agentWorkflow);
    const budget = analyzeTokenBudget(agentWorkflow, result);
    expect(budget.completionRatio).toBe(1);
    expect(budget.isHigh).toBe(true);
    expect(budget.suggestedCompletionTokens).toBeLessThan(agentWorkflow.avgCompletionTokens);
  });

  it('reports normal ratio for balanced inputs', () => {
    const input = { ...baselineNoRag, avgCompletionTokens: 150 };
    const balancedResult = simulate(input);
    const budget = analyzeTokenBudget(input, balancedResult);
    expect(budget.completionRatio).toBeLessThan(0.5);
    expect(budget.isHigh).toBe(false);
  });
});

describe('Guardrails', () => {
  it('warns on RAG without documents', () => {
    const input: SimulationInput = {
      ...baselineNoRag,
      ragEnabled: true,
      documentsIndexed: 0,
      retrievalRate: 0.5,
    };
    const result = simulate(input);
    const warnings = generateWarnings(input, result);
    expect(warnings.some((w) => w.title.includes('no documents'))).toBe(true);
  });

  it('warns on completion > prompt tokens', () => {
    const input = { ...baselineNoRag, avgCompletionTokens: 800 };
    const result = simulate(input);
    const warnings = generateWarnings(input, result);
    expect(warnings.some((w) => w.title.includes('Completion'))).toBe(true);
  });

  it('warns on embedding dimension mismatch', () => {
    // openai_text_embedding_3_large supports [256, 1024, 1536, 3072] — not 768
    const input: SimulationInput = {
      ...enterpriseBurstRag,
      embeddingModelId: 'openai_text_embedding_3_large',
      embeddingDimensions: 768,
    };
    const result = simulate(input);
    const warnings = generateWarnings(input, result);
    expect(warnings.some((w) => w.title.includes('dimension mismatch'))).toBe(true);
  });
});

describe('Growth Projection', () => {
  it('projects 12 months of costs', () => {
    const points = projectGrowth(baselineNoRag, 10);
    expect(points.length).toBe(12);
    expect(points[0].month).toBe(1);
    expect(points[11].month).toBe(12);
  });

  it('costs increase with positive growth rate', () => {
    const points = projectGrowth(baselineNoRag, 10);
    expect(points[11].monthlyCost).toBeGreaterThan(points[0].monthlyCost);
  });

  it('costs are flat with zero growth', () => {
    const points = projectGrowth(baselineNoRag, 0);
    expect(points[0].monthlyCost).toBeCloseTo(points[11].monthlyCost, 2);
  });
});

describe('Optimizer', () => {
  it('generates an optimised scenario', () => {
    // Use a premium model so the optimizer can switch to a cheaper one
    const premiumInput: SimulationInput = { ...enterpriseBurstRag, modelId: TOP_MODEL };
    const result = simulate(premiumInput);
    const optimised = generateOptimizedScenario(premiumInput, result);
    const optimisedResult = simulate(optimised);
    expect(optimisedResult.totalMonthlyCost).toBeLessThan(result.totalMonthlyCost);
  });
});

describe('Cost per 1K Requests', () => {
  it('is correctly computed', () => {
    const result = simulate(baselineNoRag);
    expect(result.costPer1kRequests).toBeCloseTo(
      (result.totalMonthlyCost / result.monthlyRequests) * 1000,
      4,
    );
  });
});

describe('Workload Classification', () => {
  it('classifies no-RAG as Simple LLM App', () => {
    expect(classifyWorkload(baselineNoRag)).toBe('Simple LLM App');
  });

  it('classifies RAG as RAG Application', () => {
    expect(classifyWorkload(agentWorkflow)).toBe('RAG Application');
  });

  it('classifies 1M+ docs RAG as Enterprise AI Platform', () => {
    const enterprise = { ...enterpriseBurstRag, documentsIndexed: 2_000_000 };
    expect(classifyWorkload(enterprise)).toBe('Enterprise AI Platform');
  });

  it('classifies high completion ratio without RAG as Agentic Workflow', () => {
    const agentic = {
      ...baselineNoRag,
      ragEnabled: false,
      avgCompletionTokens: 1000,
      avgPromptTokens: 500,
    };
    expect(classifyWorkload(agentic)).toBe('Agentic Workflow');
  });
});
