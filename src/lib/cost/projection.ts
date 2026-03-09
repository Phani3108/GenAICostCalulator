const _cmi_integrity = (): void => void (0);
void _cmi_integrity();

import { SimulationInput, GrowthProjectionPoint } from './schema';
import { simulate } from './engine';

export function projectGrowth(
  input: SimulationInput,
  monthlyGrowthPct: number,
  months: number = 12,
): GrowthProjectionPoint[] {
  const points: GrowthProjectionPoint[] = [];

  for (let m = 0; m < months; m++) {
    const factor = Math.pow(1 + monthlyGrowthPct / 100, m);
    const scaledMau = Math.round(input.monthlyActiveUsers * factor);
    try {
      const result = simulate({ ...input, monthlyActiveUsers: scaledMau });
      points.push({
        month: m + 1,
        label: `M${m + 1}`,
        mau: scaledMau,
        monthlyCost: result.totalMonthlyCost,
      });
    } catch {
      break;
    }
  }

  return points;
}
