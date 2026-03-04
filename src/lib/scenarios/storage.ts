import { SimulationInput, SimulationOutput, Scenario } from '@/lib/cost/schema';

const STORAGE_KEY = 'genai-cost-simulator-scenarios';

export function loadScenarios(): Scenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveScenario(params: {
  name: string;
  inputs: SimulationInput;
  output: SimulationOutput;
}): Scenario {
  const scenarios = loadScenarios();
  const scenario: Scenario = {
    id: crypto.randomUUID(),
    name: params.name,
    createdAt: new Date().toISOString(),
    inputs: params.inputs,
    output: params.output,
  };
  scenarios.push(scenario);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  return scenario;
}

export function deleteScenario(id: string): void {
  const scenarios = loadScenarios().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
}
