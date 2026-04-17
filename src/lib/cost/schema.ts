import { z } from 'zod';

export const SimulationInputSchema = z.object({
  monthlyActiveUsers: z.number().min(1).max(100_000_000),
  requestsPerUser: z.number().min(1).max(10_000),
  avgPromptTokens: z.number().min(1).max(128_000),
  avgCompletionTokens: z.number().min(1).max(128_000),
  modelId: z.string(),
  embeddingModelId: z.string(),
  vectorDbId: z.string(),
  ragEnabled: z.boolean(),
  documentsIndexed: z.number().min(0).max(10_000_000),
  retrievalRate: z.number().min(0).max(1),
  cacheHitRate: z.number().min(0).max(1),
  trafficPattern: z.enum(['steady', 'burst']),
  hosting: z.enum(['cloud_run', 'gke']).default('cloud_run'),
  avgDocTokens: z.number().min(0).default(500),
  topK: z.number().min(1).max(50).default(5),
  embeddingDimensions: z.number().min(1).max(4096).default(768),
});

export type SimulationInput = z.infer<typeof SimulationInputSchema>;

export interface CostLineItem {
  category: string;
  label: string;
  amount: number;
  percentage: number;
}

export interface SimulationOutput {
  totalMonthlyCost: number;
  costPerRequest: number;
  costPer1kRequests: number;
  monthlyRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  breakdown: CostLineItem[];
  explanation: string[];
}

export interface Insight {
  title: string;
  estimatedSavingsPct: number;
  recommendation: string;
  tradeoff: string;
  affectedLineItems: string[];
}

export interface TopLever {
  component: string;
  contributionPct: number;
  action: string;
  estimatedSavings: number;
  estimatedSavingsPct: number;
}

export interface ModelComparisonEntry {
  modelId: string;
  modelName: string;
  provider: string;
  totalMonthlyCost: number;
  costPerRequest: number;
  latencyClass: number;
  qualityScore: number;
  notes: string;
  isSelected: boolean;
  isRecommended: boolean;
}

export interface ArchitectureResult {
  id: string;
  name: string;
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<[string, string]>;
  notes: string[];
  mermaidCode: string;
}

export interface Scenario {
  id: string;
  name: string;
  createdAt: string;
  inputs: SimulationInput;
  output: SimulationOutput;
}

export interface Warning {
  level: 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

export interface TokenBudgetAnalysis {
  completionRatio: number;
  industryTypical: number;
  isHigh: boolean;
  suggestedCompletionTokens: number | null;
  estimatedMonthlySavings: number | null;
}

export interface GrowthProjectionPoint {
  month: number;
  label: string;
  mau: number;
  monthlyCost: number;
}

export type OptimizationMode = 'cost_first' | 'balanced' | 'quality_first';

// ── Agent Unit Economics ──

export type SimulatorMode = 'infra_cost' | 'agent_economics';

export type PricingModel = 'per_seat' | 'per_action' | 'outcome_based' | 'rev_share';

export const ChainStepSchema = z.object({
  name: z.string().min(1).max(60),
  modelId: z.string(),
  avgInputTokens: z.number().min(1).max(128_000),
  avgOutputTokens: z.number().min(1).max(128_000),
  callsPerTask: z.number().min(1).max(100),
});

export type ChainStep = z.infer<typeof ChainStepSchema>;

export const AgentEconomicsInputSchema = z.object({
  // ── Business model ──
  pricingModel: z.enum(['per_seat', 'per_action', 'outcome_based', 'rev_share']),
  pricePerUnit: z.number().min(0),
  targetGrossMarginPct: z.number().min(0).max(100).default(70),
  monthlyFixedCosts: z.number().min(0).default(0),
  // ── Customers ──
  customerCount: z.number().min(1).max(10_000_000),
  tasksPerCustomer: z.number().min(1).max(100_000),
  churnRatePct: z.number().min(0).max(100).default(5),
  customerAcquisitionCost: z.number().min(0).default(0),
  // ── Platform ──
  platformId: z.string().default('direct'),
  platformTaxPct: z.number().min(0).max(100).default(0),
  // ── Agent chain ──
  chain: z.array(ChainStepSchema).min(1).max(8),
  // ── Shared infra fields ──
  cacheHitRate: z.number().min(0).max(1).default(0.1),
  ragEnabled: z.boolean().default(false),
  embeddingModelId: z.string().default('vertex_textembedding_004'),
  vectorDbId: z.string().default('vertex_vector_search'),
  documentsIndexed: z.number().min(0).max(10_000_000).default(0),
  retrievalRate: z.number().min(0).max(1).default(0),
  avgDocTokens: z.number().min(0).default(500),
  topK: z.number().min(1).max(50).default(5),
  embeddingDimensions: z.number().min(1).max(4096).default(768),
  trafficPattern: z.enum(['steady', 'burst']).default('steady'),
  hosting: z.enum(['cloud_run', 'gke']).default('cloud_run'),
});

export type AgentEconomicsInput = z.infer<typeof AgentEconomicsInputSchema>;

export interface ChainStepCost {
  name: string;
  modelId: string;
  modelName: string;
  callsPerMonth: number;
  inputTokens: number;
  outputTokens: number;
  inferenceCost: number;
  percentageOfCogs: number;
}

export interface AgentCOGS {
  totalMonthlyCost: number;
  costPerTask: number;
  monthlyTasks: number;
  chainBreakdown: ChainStepCost[];
  infraCost: number;
  networkingCost: number;
  observabilityCost: number;
  embeddingIndexingCost: number;
  vectorRetrievalCost: number;
  explanation: string[];
}

export interface UnitEconomics {
  monthlyRevenue: number;
  monthlyCogs: number;
  platformTaxAmount: number;
  netRevenue: number;
  grossMargin: number;
  grossMarginPct: number;
  contributionMargin: number;
  revenuePerTask: number;
  cogsPerTask: number;
  marginPerTask: number;
  revenuePerCustomer: number;
  cogsPerCustomer: number;
}

export interface PricingModelComparison {
  pricingModel: PricingModel;
  label: string;
  monthlyRevenue: number;
  monthlyCogs: number;
  platformTax: number;
  grossMargin: number;
  grossMarginPct: number;
  breakEvenCustomers: number;
  paybackMonths: number;
  isSelected: boolean;
}

export interface PaybackResult {
  months: number;
  monthlyMarginPerCustomer: number;
  health: 'healthy' | 'acceptable' | 'risky' | 'unsustainable';
}

export interface BreakEvenResult {
  customers: number;
  variableCostPerCustomer: number;
  contributionPerCustomer: number;
  monthlyFixedCosts: number;
}

export interface ChurnSensitivityPoint {
  churnMultiplier: number;
  churnRatePct: number;
  steadyStateCustomers: number;
  monthlyRevenue: number;
  grossMargin: number;
  grossMarginPct: number;
  paybackMonths: number;
}

export interface PricingTier {
  tierName: string;
  price: number;
  unit: string;
  included: string[];
  limits: string | null;
}

export interface PricingRecommendation {
  tiers: PricingTier[];
  cogsFloor: number;
  rationale: string;
}

export interface MarginProjectionPoint {
  month: number;
  label: string;
  customers: number;
  monthlyRevenue: number;
  monthlyCogs: number;
  grossMargin: number;
  grossMarginPct: number;
}

export interface PriceChainExport {
  version: string;
  generatedAt: string;
  pricingModel: PricingModel;
  tiers: PricingTier[];
  unitEconomics: {
    cogsPerTask: number;
    revenuePerTask: number;
    marginPerTask: number;
    grossMarginPct: number;
  };
  targets: {
    targetGrossMarginPct: number;
    breakEvenCustomers: number;
    paybackMonths: number;
  };
  chain: Array<{ name: string; modelId: string; callsPerTask: number }>;
}
