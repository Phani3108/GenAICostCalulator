import { SimulationInput, SimulationOutput, CostLineItem } from './schema';
import { getPricing } from './pricing';

export function simulate(input: SimulationInput): SimulationOutput {
  const pricing = getPricing();
  const model = pricing.models[input.modelId];
  const embModel = pricing.embedding_models[input.embeddingModelId];
  const vecDb = pricing.vector_db[input.vectorDbId];
  const infra = pricing.infra[input.hosting] ?? pricing.infra.cloud_run;

  if (!model) throw new Error(`Unknown model: ${input.modelId}`);

  const monthlyRequests = input.monthlyActiveUsers * input.requestsPerUser;
  const effectiveRequests = monthlyRequests * (1 - input.cacheHitRate);
  const totalInputTokens = effectiveRequests * input.avgPromptTokens;
  const totalOutputTokens = effectiveRequests * input.avgCompletionTokens;
  const totalTokens = totalInputTokens + totalOutputTokens;

  // ── 1. Model Inference ──
  const inferenceCost =
    (totalInputTokens / 1000) * model.input_cost_per_1k +
    (totalOutputTokens / 1000) * model.output_cost_per_1k;

  // ── 2. Embedding Indexing (RAG — standing cost) ──
  let embeddingIndexingCost = 0;
  if (input.ragEnabled && embModel) {
    const docTokens = input.avgDocTokens || 500;
    embeddingIndexingCost =
      ((input.documentsIndexed * docTokens) / 1000) *
      embModel.cost_per_1k_tokens /
      12;
  }

  // ── 3. Vector Retrieval (RAG — per-query cost) ──
  let vectorRetrievalCost = 0;
  if (input.ragEnabled) {
    let queryEmbeddingCost = 0;
    if (embModel) {
      queryEmbeddingCost =
        ((monthlyRequests * input.retrievalRate * input.avgPromptTokens) / 1000) *
        embModel.cost_per_1k_tokens;
    }

    let vectorStorageCost = 0;
    let vectorQueryCost = 0;
    if (vecDb) {
      const dims = input.embeddingDimensions || 768;
      const bytesPerVector = dims * 4;
      const storageGb = (input.documentsIndexed * bytesPerVector) / 1024 ** 3;
      vectorStorageCost = storageGb * vecDb.storage_per_gb_monthly;
      // Each query fetches topK vectors; cost scales with retrieval depth
      const topK = input.topK || 4;
      vectorQueryCost =
        ((monthlyRequests * input.retrievalRate * topK) / 1000) * vecDb.query_per_1k;
    }

    vectorRetrievalCost = queryEmbeddingCost + vectorStorageCost + vectorQueryCost;
  }

  // ── 4. Infrastructure ──
  const trafficMultiplier =
    input.trafficPattern === 'burst'
      ? infra.burst_multiplier
      : infra.steady_multiplier;
  const infraCost =
    inferenceCost * infra.overhead_pct_of_inference * trafficMultiplier;

  // ── 5. Networking ──
  const subtotalBeforeNet =
    inferenceCost + embeddingIndexingCost + vectorRetrievalCost + infraCost;
  const networkingCost = subtotalBeforeNet * pricing.networking.pct_of_total;

  // ── 6. Observability ──
  const observabilityCost =
    subtotalBeforeNet * pricing.observability.pct_of_total;

  // ── Total ──
  const totalMonthlyCost =
    inferenceCost +
    embeddingIndexingCost +
    vectorRetrievalCost +
    infraCost +
    networkingCost +
    observabilityCost;

  // ── Breakdown ──
  const items: Omit<CostLineItem, 'percentage'>[] = [
    {
      category: 'Model Inference',
      label: `${model.name} inference`,
      amount: inferenceCost,
    },
  ];

  if (input.ragEnabled) {
    items.push(
      {
        category: 'Embedding Indexing',
        label: `${embModel?.name ?? 'Embedding'} document indexing (amortised)`,
        amount: embeddingIndexingCost,
      },
      {
        category: 'Vector Retrieval',
        label: `Query embeddings + ${vecDb?.name ?? 'Vector DB'} storage & queries`,
        amount: vectorRetrievalCost,
      },
    );
  }

  items.push(
    {
      category: 'Infrastructure',
      label: `${infra.name} compute${input.trafficPattern === 'burst' ? ' (burst)' : ''}`,
      amount: infraCost,
    },
    {
      category: 'Networking',
      label: 'Data transfer & networking',
      amount: networkingCost,
    },
    {
      category: 'Observability',
      label: 'Logging, monitoring & tracing',
      amount: observabilityCost,
    },
  );

  const breakdown: CostLineItem[] = items.map((item) => ({
    ...item,
    percentage:
      totalMonthlyCost > 0 ? (item.amount / totalMonthlyCost) * 100 : 0,
  }));

  // ── Explanation ──
  const f = (n: number) => n.toLocaleString();
  const explanation: string[] = [
    `Monthly requests = ${f(input.monthlyActiveUsers)} users × ${input.requestsPerUser} req/user = ${f(monthlyRequests)}`,
    `Effective requests (after ${(input.cacheHitRate * 100).toFixed(0)}% cache) = ${f(effectiveRequests)}`,
    `Input tokens = ${f(effectiveRequests)} × ${f(input.avgPromptTokens)} = ${f(totalInputTokens)}`,
    `Output tokens = ${f(effectiveRequests)} × ${f(input.avgCompletionTokens)} = ${f(totalOutputTokens)}`,
    `Inference = (${f(totalInputTokens / 1000)}K × $${model.input_cost_per_1k}) + (${f(totalOutputTokens / 1000)}K × $${model.output_cost_per_1k}) = $${inferenceCost.toFixed(2)}`,
  ];

  if (input.ragEnabled) {
    explanation.push(
      `Embedding indexing (docs amortised/12) = $${embeddingIndexingCost.toFixed(2)}`,
      `Vector retrieval (query embeddings + storage ${f((input.documentsIndexed * (input.embeddingDimensions || 768) * 4) / 1024 ** 3)} GB + ${f(monthlyRequests * input.retrievalRate)} queries × topK ${input.topK || 4}) = $${vectorRetrievalCost.toFixed(2)}`,
    );
  }

  explanation.push(
    `Infrastructure (${(infra.overhead_pct_of_inference * 100).toFixed(0)}% of inference × ${trafficMultiplier} traffic) = $${infraCost.toFixed(2)}`,
    `Networking (${(pricing.networking.pct_of_total * 100).toFixed(0)}% of subtotal) = $${networkingCost.toFixed(2)}`,
    `Observability (${(pricing.observability.pct_of_total * 100).toFixed(0)}% of subtotal) = $${observabilityCost.toFixed(2)}`,
  );

  return {
    totalMonthlyCost,
    costPerRequest:
      monthlyRequests > 0 ? totalMonthlyCost / monthlyRequests : 0,
    costPer1kRequests:
      monthlyRequests > 0 ? (totalMonthlyCost / monthlyRequests) * 1000 : 0,
    monthlyRequests,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    breakdown,
    explanation,
  };
}
