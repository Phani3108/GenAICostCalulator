import {
  SimulationInput,
  SimulationOutput,
  Insight,
  TopLever,
  TokenBudgetAnalysis,
} from './schema';
import { getPricing } from './pricing';
import { simulate } from './engine';
import { compareModels } from './comparison';

export function generateInsights(
  input: SimulationInput,
  output: SimulationOutput,
): Insight[] {
  const insights: Insight[] = [];
  const pricing = getPricing();

  const pctOf = (cat: string) =>
    output.breakdown.find((b) => b.category === cat)?.percentage ?? 0;

  const inferencePct = pctOf('Model Inference');
  const retrievalPct = pctOf('Vector Retrieval');

  // ── 1. Model routing: expensive flagship + high volume → route simple queries cheaply
  const currentModel = pricing.models[input.modelId];
  const cheapestModel = compareModels(input, 'cost_first')[0];
  if (
    currentModel &&
    currentModel.quality_score >= 5 &&
    output.monthlyRequests > 300_000 &&
    cheapestModel &&
    cheapestModel.modelId !== input.modelId
  ) {
    const potentialSavings = Math.round(
      (1 - cheapestModel.totalMonthlyCost / output.totalMonthlyCost) * 60,
    );
    insights.push({
      title: 'Implement model routing',
      estimatedSavingsPct: Math.min(potentialSavings, 45),
      recommendation: `You're running ${currentModel.name} for all ${output.monthlyRequests.toLocaleString()} requests/month. A router can send simple queries (classification, extraction, short Q&A) to ${cheapestModel.modelName} and reserve ${currentModel.name} for complex reasoning — typical split is 60/40.`,
      tradeoff: 'Router adds ~10-20ms latency; requires classifying query complexity.',
      affectedLineItems: ['Model Inference'],
    });
  }

  // ── 2. Switch to faster model if inference dominates but routing isn't the issue
  if (inferencePct > 70 && !(currentModel?.quality_score >= 5 && output.monthlyRequests > 300_000)) {
    insights.push({
      title: 'Switch to a faster, cheaper model',
      estimatedSavingsPct: 40,
      recommendation: `Model inference is ${inferencePct.toFixed(0)}% of total cost. Consider a fast-tier model (Gemini 2.5 Flash, GPT-5 Mini, Claude Haiku 4.5) for routine queries, or implement multi-model routing.`,
      tradeoff: 'Smaller models may reduce accuracy on nuanced or multi-step tasks.',
      affectedLineItems: ['Model Inference'],
    });
  }

  // ── 3. Semantic caching: low cache hit rate
  if (input.cacheHitRate < 0.1) {
    insights.push({
      title: 'Implement semantic prompt caching',
      estimatedSavingsPct: Math.round(inferencePct * 0.25),
      recommendation: `Cache hit rate is only ${(input.cacheHitRate * 100).toFixed(0)}%. Hash the logical meaning of prompts (normalize, redact IDs) and reuse answers for semantically identical questions. This can cut 50-70% of duplicate inference calls in Q&A or routing flows.`,
      tradeoff: 'Cached responses may become stale. Use TTL-based invalidation.',
      affectedLineItems: ['Model Inference'],
    });
  }

  // ── 4. Conversation history summarization: very high input tokens
  if (input.avgPromptTokens > 1500) {
    insights.push({
      title: 'Summarize conversation history instead of full replay',
      estimatedSavingsPct: 28,
      recommendation: `At ${input.avgPromptTokens.toLocaleString()} prompt tokens/request, you're likely passing full conversation history. Keep only the last N turns and summarize older ones into a short session summary — typical saving is 25-35% on input tokens. For agents, periodically compress state and discard raw messages.`,
      tradeoff: 'History summarization may lose fine-grained detail from earlier turns.',
      affectedLineItems: ['Model Inference'],
    });
  }

  // ── 5. Structured output + stop conditions: high completion tokens
  if (input.avgCompletionTokens > 800) {
    insights.push({
      title: 'Cap output length with structured formats and stop conditions',
      estimatedSavingsPct: 20,
      recommendation: `Average completion tokens (${input.avgCompletionTokens.toLocaleString()}) are high. Ask models to output JSON or structured records instead of free-text explanations, set max_tokens, and use stop sequences. "Be concise, respond in JSON." can cut output by 30%+.`,
      tradeoff: 'Structured outputs may omit explanatory context useful to end users.',
      affectedLineItems: ['Model Inference'],
    });
  }

  // ── 6. Context compression for RAG: high retrieval + high prompts
  if (input.ragEnabled && input.documentsIndexed > 50_000 && input.avgPromptTokens > 1000) {
    insights.push({
      title: 'Compress retrieved context before injection',
      estimatedSavingsPct: 22,
      recommendation: 'Use extractive compression (LLMLingua-style) on retrieved chunks before passing them to the LLM. Prefer small-chunk + dense retrieval over dumping full documents. Typical saving: 20-30% on input tokens for RAG queries.',
      tradeoff: 'Aggressive compression may lose nuance. Tune compression ratio per domain.',
      affectedLineItems: ['Model Inference', 'Embedding Indexing'],
    });
  }

  // ── 7. Fallback hierarchy: expensive model, low cache rate
  if (
    currentModel?.quality_score >= 5 &&
    input.cacheHitRate < 0.4 &&
    !insights.some((i) => i.title === 'Implement model routing')
  ) {
    insights.push({
      title: 'Use a cheap-first fallback hierarchy',
      estimatedSavingsPct: 38,
      recommendation: `Default to a fast-tier model (Haiku 4.5, GPT-5 Mini, Gemini 2.5 Flash) and escalate to ${currentModel.name} only when the cheap model returns low-confidence or flagged output. Track "escalation rate" — at 60/40 routing, savings can exceed 35%.`,
      tradeoff: 'Requires confidence scoring or rule-based escalation logic.',
      affectedLineItems: ['Model Inference'],
    });
  }

  // ── 8. Vector retrieval depth reduction
  if (input.ragEnabled && retrievalPct > 15) {
    insights.push({
      title: 'Reduce retrieval depth and add pre-filtering',
      estimatedSavingsPct: 12,
      recommendation: `Vector retrieval is ${retrievalPct.toFixed(0)}% of costs. Reduce topK from ${input.topK} or add metadata filters to narrow searches before embedding lookup. Each K reduction cuts query costs linearly.`,
      tradeoff: 'Fewer results per query may miss relevant context chunks.',
      affectedLineItems: ['Vector Retrieval'],
    });
  }

  // ── 9. Cache retrieval results
  if (input.ragEnabled && input.retrievalRate > 0.7) {
    insights.push({
      title: 'Cache retrieval results for frequent queries',
      estimatedSavingsPct: 15,
      recommendation: `${(input.retrievalRate * 100).toFixed(0)}% of queries trigger vector retrieval. Caching frequent query-result pairs can reduce vector queries and query embedding calls significantly — especially effective for FAQ-style RAG.`,
      tradeoff: 'Cached retrieval may miss recently updated document content.',
      affectedLineItems: ['Vector Retrieval', 'Embedding Indexing'],
    });
  }

  // ── 10. Burst traffic smoothing
  if (input.trafficPattern === 'burst') {
    insights.push({
      title: 'Smooth burst traffic with request queuing',
      estimatedSavingsPct: 12,
      recommendation: 'Burst traffic adds ~30% infra overhead. Use a request queue (Pub/Sub, SQS, or in-memory) with pre-warmed instances, or set concurrency limits to flatten the spike. For batch workloads, shift to off-peak scheduling.',
      tradeoff: 'Queuing adds latency for some requests during peaks.',
      affectedLineItems: ['Infrastructure'],
    });
  }

  // ── 11. Batch API for async workloads
  if (output.monthlyRequests > 1_000_000) {
    insights.push({
      title: 'Use batch API for async workloads',
      estimatedSavingsPct: 50,
      recommendation: `At ${output.monthlyRequests.toLocaleString()} requests/month, batch processing can yield ~50% savings. OpenAI, Anthropic, and Google all offer batch endpoints. Only viable for background tasks (nightly summaries, document processing, embeddings) where latency tolerance > minutes.`,
      tradeoff: 'Higher latency (minutes to hours). Only for background, non-interactive tasks.',
      affectedLineItems: ['Model Inference'],
    });
  }

  // Show the 5 highest-impact, most actionable insights
  return insights.slice(0, 5);
}

export function getTopLever(
  input: SimulationInput,
  output: SimulationOutput,
): TopLever {
  const top = output.breakdown.reduce(
    (max, item) => (item.amount > max.amount ? item : max),
    output.breakdown[0],
  );

  const pricing = getPricing();

  // Find cheapest and fastest models dynamically from current pricing
  const ranked = compareModels(input, 'cost_first');
  const cheapestModel = ranked[0];
  const fastestModel = ranked.find((m) => m.latencyClass === 1) ?? ranked[0];

  let action = '';
  let savingsPct = 0;

  switch (top.category) {
    case 'Model Inference': {
      const currentModel = pricing.models[input.modelId];
      if (cheapestModel && cheapestModel.modelId !== input.modelId) {
        action = `Switch from ${currentModel?.name ?? input.modelId} to ${cheapestModel.modelName} for inference cost reduction, or implement model routing to use ${fastestModel?.modelName ?? 'a fast-tier model'} for simple queries.`;
        savingsPct = 40;
      } else if (input.cacheHitRate < 0.3) {
        action = `Increase semantic cache hit rate from ${(input.cacheHitRate * 100).toFixed(0)}% to 30%+ by caching normalized prompt hashes.`;
        savingsPct = 22;
      } else {
        action = 'Cap output with max_tokens + structured JSON output to reduce completion token spend by 20-30%.';
        savingsPct = 18;
      }
      break;
    }
    case 'Embedding Indexing':
      action = 'Reduce embedding refresh frequency or switch to a lower-cost embedding model (e.g. OpenAI Text Embedding 3 Small at $0.00002/1K).';
      savingsPct = 10;
      break;
    case 'Vector Retrieval':
      action = `Reduce topK from ${input.topK} or add metadata pre-filtering to narrow searches. Cache frequent retrieval results.`;
      savingsPct = 15;
      break;
    case 'Infrastructure':
      action = input.trafficPattern === 'burst'
        ? 'Smooth traffic with request queuing (Pub/Sub / SQS) to eliminate the burst premium.'
        : `Optimise ${input.hosting === 'cloud_run' ? 'Cloud Run' : 'GKE'} concurrency settings and minimum idle instances.`;
      savingsPct = input.trafficPattern === 'burst' ? 15 : 8;
      break;
    default:
      action = 'Review architecture for cost optimisation opportunities.';
      savingsPct = 5;
  }

  return {
    component: top.category,
    contributionPct: top.percentage,
    action,
    estimatedSavings: top.amount * (savingsPct / 100),
    estimatedSavingsPct: savingsPct,
  };
}

export function analyzeTokenBudget(
  input: SimulationInput,
  output: SimulationOutput,
): TokenBudgetAnalysis {
  const completionRatio =
    input.avgPromptTokens > 0
      ? input.avgCompletionTokens / input.avgPromptTokens
      : 0;
  const industryTypical = 0.35;
  const isHigh = completionRatio > 0.5;

  let suggestedCompletionTokens: number | null = null;
  let estimatedMonthlySavings: number | null = null;

  if (isHigh) {
    suggestedCompletionTokens = Math.round(input.avgPromptTokens * industryTypical);
    try {
      const optimised = simulate({
        ...input,
        avgCompletionTokens: suggestedCompletionTokens,
      });
      estimatedMonthlySavings = output.totalMonthlyCost - optimised.totalMonthlyCost;
    } catch {
      /* skip */
    }
  }

  return {
    completionRatio,
    industryTypical,
    isHigh,
    suggestedCompletionTokens,
    estimatedMonthlySavings,
  };
}
