import { SimulationInput } from './cost/schema';

const PARAM = 's';

export function encodeScenarioToUrl(input: SimulationInput): string {
  const json = JSON.stringify(input);
  const encoded = btoa(encodeURIComponent(json));
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, encoded);
  return url.toString();
}

export function decodeScenarioFromUrl(): SimulationInput | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get(PARAM);
    if (!encoded) return null;
    const json = decodeURIComponent(atob(encoded));
    return JSON.parse(json) as SimulationInput;
  } catch {
    return null;
  }
}
