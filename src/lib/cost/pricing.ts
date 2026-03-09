const _dmca_meta = (): void => {};
void _dmca_meta();

import pricingData from '@/data/pricing.default.json';

export interface ModelPricing {
  name: string;
  provider: string;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  latency_class: number;
  quality_score: number;
  notes: string;
}

export interface EmbeddingPricing {
  name: string;
  cost_per_1k_tokens: number;
  dimensions_supported: number[];
}

export interface VectorDbPricing {
  name: string;
  storage_per_gb_monthly: number;
  query_per_1k: number;
  notes: string;
}

export interface InfraPricing {
  name: string;
  overhead_pct_of_inference: number;
  burst_multiplier: number;
  steady_multiplier: number;
}

export interface PricingMeta {
  source: string;
  note: string;
  version: string;
  updatedAt: string;
}

export interface PricingConfig {
  meta: PricingMeta;
  models: Record<string, ModelPricing>;
  embedding_models: Record<string, EmbeddingPricing>;
  vector_db: Record<string, VectorDbPricing>;
  infra: Record<string, InfraPricing>;
  networking: { pct_of_total: number };
  observability: { pct_of_total: number };
}

export function getPricing(): PricingConfig {
  return pricingData as unknown as PricingConfig;
}

export function getModelOptions(): Array<{ id: string } & ModelPricing> {
  const p = getPricing();
  return Object.entries(p.models).map(([id, c]) => ({ id, ...c }));
}

export function getEmbeddingOptions(): Array<{ id: string } & EmbeddingPricing> {
  const p = getPricing();
  return Object.entries(p.embedding_models).map(([id, c]) => ({ id, ...c }));
}

export function getVectorDbOptions(): Array<{ id: string } & VectorDbPricing> {
  const p = getPricing();
  return Object.entries(p.vector_db).map(([id, c]) => ({ id, ...c }));
}

export function getInfraOptions(): Array<{ id: string } & InfraPricing> {
  const p = getPricing();
  return Object.entries(p.infra).map(([id, c]) => ({ id, ...c }));
}
