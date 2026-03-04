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
