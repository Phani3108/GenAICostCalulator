import { SimulationInput, SimulationOutput, Warning } from './schema';
import { getPricing } from './pricing';

export function generateWarnings(
  input: SimulationInput,
  output: SimulationOutput,
): Warning[] {
  const warnings: Warning[] = [];
  const pricing = getPricing();

  // Embedding dimension mismatch — produces silently wrong storage costs
  if (input.ragEnabled) {
    const embModel = pricing.embedding_models[input.embeddingModelId];
    if (embModel?.dimensions_supported && !embModel.dimensions_supported.includes(input.embeddingDimensions)) {
      const supported = embModel.dimensions_supported.join(', ');
      warnings.push({
        level: 'error',
        title: 'Embedding dimension mismatch',
        message: `${embModel.name} supports dimensions [${supported}], but you have ${input.embeddingDimensions} selected. Vector storage cost is incorrect — change dimensions to ${embModel.dimensions_supported[0]}.`,
      });
    }
  }

  if (output.totalMonthlyCost > 50_000) {
    warnings.push({
      level: 'warning',
      title: 'High monthly cost',
      message: `Estimated cost exceeds $50,000/month ($${output.totalMonthlyCost.toFixed(0)}). Consider Flash model, caching strategies, or workload segmentation.`,
    });
  }

  if (input.avgCompletionTokens > input.avgPromptTokens) {
    warnings.push({
      level: 'warning',
      title: 'Completion exceeds prompt tokens',
      message:
        'Completion tokens are higher than prompt tokens. This may indicate inefficient prompt design or unbounded outputs. Consider setting max_tokens.',
    });
  }

  if (input.ragEnabled) {
    const vectorSizeGb =
      (input.documentsIndexed * (input.embeddingDimensions || 768) * 4) /
      1024 ** 3;
    if (vectorSizeGb > 10) {
      warnings.push({
        level: 'warning',
        title: `Large vector index (~${vectorSizeGb.toFixed(1)} GB)`,
        message:
          'Consider index sharding, dimensionality reduction, or metadata-based filtering to manage storage costs.',
      });
    }
  }

  if (input.ragEnabled && input.documentsIndexed === 0) {
    warnings.push({
      level: 'error',
      title: 'RAG enabled with no documents',
      message:
        'RAG pipeline is enabled but documentsIndexed is 0. Set a document count or disable RAG.',
    });
  }

  if (input.monthlyActiveUsers > 10_000_000) {
    warnings.push({
      level: 'info',
      title: 'Very high scale',
      message:
        'At this scale, committed-use discounts and custom pricing would significantly reduce actual costs. Contact your cloud provider.',
    });
  }

  if (input.avgPromptTokens > 10_000) {
    warnings.push({
      level: 'warning',
      title: 'Very large prompt tokens',
      message: `${input.avgPromptTokens.toLocaleString()} tokens/prompt is unusually high. Consider chunk summarisation or extractive compression.`,
    });
  }

  if (input.cacheHitRate > 0.8) {
    warnings.push({
      level: 'info',
      title: 'Very high cache assumption',
      message:
        'Cache hit rate above 80% is optimistic for most workloads. Validate with actual usage data.',
    });
  }

  return warnings;
}
