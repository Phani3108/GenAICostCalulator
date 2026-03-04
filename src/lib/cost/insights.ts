import {
  SimulationInput,
  SimulationOutput,
  Insight,
  TopLever,
  TokenBudgetAnalysis,
} from './schema';
import { getPricing } from './pricing';
import { simulate } from './engine';

export function generateInsights(
  input: SimulationInput,
  output: SimulationOutput,
): Insight[] {
  const insights: Insight[] = [];

  const pctOf = (cat: string) =>
    output.breakdown.find((b) => b.category === cat)?.percentage ?? 0;

  const inferencePct = pctOf('Model Inference');
  const retrievalPct = pctOf('Vector Retrieval');

  if (inferencePct > 70) {
    insights.push({
      title: 'Switch to a smaller or faster model',
      estimatedSavingsPct: 40,
      recommendation: `Model inference accounts for ${inferencePct.toFixed(0)}% of total cost. Consider Gemini Flash for routine queries, or implement model routing.`,
      tradeoff: 'Smaller models may reduce accuracy on nuanced tasks.',
      affectedLineItems: ['Model Inference'],
    });
  }

  if (input.cacheHitRate < 0.1) {
    insights.push({
      title: 'Implement prompt caching',
      estimatedSavingsPct: Math.round(inferencePct * 0.25),
      recommendation: `Cache hit rate is only ${(input.cacheHitRate * 100).toFixed(0)}%. Semantic caching can cut inference costs 20-30%.`,
      tradeoff: 'Cached responses may become stale. Use TTL-based invalidation.',
      affectedLineItems: ['Model Inference'],
    });
  }

  if (input.avgCompletionTokens > 800) {
    insights.push({
      title: 'Reduce output token length',
      estimatedSavingsPct: 20,
      recommendation: `Average completion tokens (${input.avgCompletionTokens.toLocaleString()}) are high. Set max_tokens, use structured output, or add "be concise" instructions.`,
      tradeoff: 'Shorter responses may omit useful detail.',
      affectedLineItems: ['Model Inference'],
    });
  }

  if (input.ragEnabled && retrievalPct > 15) {
    insights.push({
      title: 'Reduce retrieval depth or add pre-filtering',
      estimatedSavingsPct: 12,
      recommendation: `Vector retrieval is ${retrievalPct.toFixed(0)}% of costs. Reduce topK from ${input.topK} or add metadata filters to narrow searches.`,
      tradeoff: 'Fewer results per query may miss relevant context.',
      affectedLineItems: ['Vector Retrieval'],
    });
  }

  if (input.ragEnabled && input.retrievalRate > 0.7) {
    insights.push({
      title: 'Cache retrieval results',
      estimatedSavingsPct: 15,
      recommendation: `${(input.retrievalRate * 100).toFixed(0)}% of queries trigger retrieval. Caching frequent results can reduce vector queries and embedding calls.`,
      tradeoff: 'Cached retrieval may miss latest document updates.',
      affectedLineItems: ['Vector Retrieval', 'Embedding Indexing'],
    });
  }

  if (input.trafficPattern === 'burst') {
    insights.push({
      title: 'Smooth burst traffic with queuing',
      estimatedSavingsPct: 12,
      recommendation: 'Burst traffic adds ~30% infra overhead. Use request queuing or pre-warm instances.',
      tradeoff: 'Queuing adds latency for some requests.',
      affectedLineItems: ['Infrastructure'],
    });
  }

  if (output.monthlyRequests > 1_000_000) {
    insights.push({
      title: 'Use batch API for async workloads',
      estimatedSavingsPct: 25,
      recommendation: `At ${output.monthlyRequests.toLocaleString()} requests/month, batch processing can yield ~50% savings.`,
      tradeoff: 'Higher latency. Only for background tasks.',
      affectedLineItems: ['Model Inference'],
    });
  }

  if (input.ragEnabled && input.documentsIndexed > 50_000 && input.avgPromptTokens > 1000) {
    insights.push({
      title: 'Implement context-window optimisation',
      estimatedSavingsPct: 18,
      recommendation: 'Use chunk summarisation or extractive compression before passing context to the LLM.',
      tradeoff: 'Aggressive compression may lose nuance.',
      affectedLineItems: ['Model Inference', 'Embedding Indexing'],
    });
  }

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
  let action = '';
  let savingsPct = 0;

  switch (top.category) {
    case 'Model Inference':
      if (input.modelId !== 'gemini_1_5_flash' && input.modelId !== 'llama3_self_hosted') {
        action = `Switch from ${pricing.models[input.modelId]?.name ?? input.modelId} to Gemini 1.5 Flash for ~60-70% inference cost reduction.`;
        savingsPct = 40;
      } else if (input.cacheHitRate < 0.3) {
        action = `Increase cache hit rate from ${(input.cacheHitRate * 100).toFixed(0)}% to 30%+.`;
        savingsPct = 20;
      } else {
        action = 'Reduce avg completion tokens by 20% through structured outputs.';
        savingsPct = 15;
      }
      break;
    case 'Embedding Indexing':
      action = 'Reduce embedding refresh frequency or switch to lower-cost embedding model.';
      savingsPct = 10;
      break;
    case 'Vector Retrieval':
      action = `Reduce topK from ${input.topK} or add metadata pre-filtering to reduce query volume.`;
      savingsPct = 12;
      break;
    case 'Infrastructure':
      action = input.trafficPattern === 'burst'
        ? 'Smooth traffic with queuing to eliminate burst premium.'
        : `Optimise ${input.hosting === 'cloud_run' ? 'Cloud Run' : 'GKE'} concurrency and min instances.`;
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
