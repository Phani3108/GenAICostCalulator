import { getPricing } from './pricing';

export interface PlatformDefinition {
  id: string;
  name: string;
  taxPct: number;
  notes: string;
}

/**
 * Load platform definitions from pricing config.
 * Falls back to hardcoded defaults if platforms not yet in pricing JSON.
 */
export function getPlatforms(): Record<string, PlatformDefinition> {
  const pricing = getPricing();
  const raw = (pricing as unknown as Record<string, unknown>).platforms as
    | Record<string, { name: string; tax_pct: number; notes: string }>
    | undefined;

  if (raw) {
    const result: Record<string, PlatformDefinition> = {};
    for (const [id, p] of Object.entries(raw)) {
      result[id] = { id, name: p.name, taxPct: p.tax_pct, notes: p.notes };
    }
    return result;
  }

  // Fallback defaults until pricing.default.json is updated
  return {
    openai_marketplace: { id: 'openai_marketplace', name: 'OpenAI GPT Store', taxPct: 30, notes: '30% revenue share' },
    anthropic_marketplace: { id: 'anthropic_marketplace', name: 'Anthropic Marketplace', taxPct: 25, notes: 'Estimated — verify with Anthropic' },
    aws_bedrock: { id: 'aws_bedrock', name: 'AWS Bedrock Marketplace', taxPct: 20, notes: '15–25% range typical' },
    direct: { id: 'direct', name: 'Direct (Self-hosted)', taxPct: 0, notes: 'No platform tax' },
    custom: { id: 'custom', name: 'Custom', taxPct: 0, notes: 'User-defined rate' },
  };
}

/**
 * Get the platform tax percentage for a given platform ID.
 * Returns 0 for unknown platforms.
 */
export function getPlatformTax(platformId: string): number {
  const platforms = getPlatforms();
  return platforms[platformId]?.taxPct ?? 0;
}

/**
 * List all platform options for UI dropdowns.
 */
export function getPlatformOptions(): PlatformDefinition[] {
  return Object.values(getPlatforms());
}
