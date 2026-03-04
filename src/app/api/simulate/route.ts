import { NextRequest, NextResponse } from 'next/server';
import { SimulationInputSchema } from '@/lib/cost/schema';
import { simulate } from '@/lib/cost/engine';
import { generateInsights } from '@/lib/cost/insights';
import { generateWarnings } from '@/lib/cost/guardrails';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = SimulationInputSchema.parse(body);
    const result = simulate(input);
    const insights = generateInsights(input, result);
    const warnings = generateWarnings(input, result);

    const log = {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      modelId: input.modelId,
      hosting: input.hosting,
      presetId: (body as Record<string, unknown>).presetId ?? null,
      totalMonthlyCost: result.totalMonthlyCost,
      costPerRequest: result.costPerRequest,
      monthlyRequests: result.monthlyRequests,
      warningCount: warnings.length,
    };
    console.log(JSON.stringify(log));

    return NextResponse.json({ success: true, result, insights, warnings });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid input',
      },
      { status: 400 },
    );
  }
}
