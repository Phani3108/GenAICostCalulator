import {
  SimulationInput,
  ModelComparisonEntry,
  OptimizationMode,
} from './schema';
import { simulate } from './engine';
import { getPricing } from './pricing';

export function compareModels(
  input: SimulationInput,
  mode: OptimizationMode = 'cost_first',
): ModelComparisonEntry[] {
  const pricing = getPricing();

  const entries = Object.entries(pricing.models)
    .map(([modelId, model]) => {
      try {
        const result = simulate({ ...input, modelId });
        return {
          modelId,
          modelName: model.name,
          provider: model.provider,
          totalMonthlyCost: result.totalMonthlyCost,
          costPerRequest: result.costPerRequest,
          latencyClass: model.latency_class,
          qualityScore: model.quality_score,
          notes: model.notes,
          isSelected: modelId === input.modelId,
          isRecommended: false,
        };
      } catch {
        return null;
      }
    })
    .filter((e): e is ModelComparisonEntry => e !== null);

  switch (mode) {
    case 'cost_first':
      entries.sort((a, b) => a.totalMonthlyCost - b.totalMonthlyCost);
      break;

    case 'quality_first':
      entries.sort(
        (a, b) =>
          b.qualityScore - a.qualityScore ||
          a.totalMonthlyCost - b.totalMonthlyCost,
      );
      break;

    case 'balanced': {
      const costs = entries.map((e) => e.totalMonthlyCost);
      const maxCost = Math.max(...costs);
      const minCost = Math.min(...costs);
      const costRange = maxCost - minCost || 1;

      const score = (e: ModelComparisonEntry) =>
        0.5 * (1 - (e.totalMonthlyCost - minCost) / costRange) +
        0.3 * (1 - (e.latencyClass - 1) / 2) +
        0.2 * ((e.qualityScore - 1) / 4);

      entries.sort((a, b) => score(b) - score(a));
      break;
    }
  }

  if (entries.length > 0) entries[0].isRecommended = true;

  return entries;
}
