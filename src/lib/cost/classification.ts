import { SimulationInput } from './schema';

export type WorkloadClass =
  | 'Simple LLM App'
  | 'RAG Application'
  | 'Agentic Workflow'
  | 'Enterprise AI Platform';

export function classifyWorkload(input: SimulationInput): WorkloadClass {
  if (input.ragEnabled && input.documentsIndexed > 1_000_000) {
    return 'Enterprise AI Platform';
  }
  if (input.ragEnabled) {
    return 'RAG Application';
  }
  if (input.avgCompletionTokens > input.avgPromptTokens) {
    return 'Agentic Workflow';
  }
  return 'Simple LLM App';
}

export const WORKLOAD_META: Record<
  WorkloadClass,
  { color: string; icon: string; description: string }
> = {
  'Simple LLM App': {
    color: '#5f6368',
    icon: 'chat',
    description: 'Direct LLM interaction without retrieval',
  },
  'RAG Application': {
    color: '#1a73e8',
    icon: 'search',
    description: 'LLM with document retrieval pipeline',
  },
  'Agentic Workflow': {
    color: '#9334e6',
    icon: 'agent',
    description: 'High output generation — tool-use or agentic patterns',
  },
  'Enterprise AI Platform': {
    color: '#ea4335',
    icon: 'enterprise',
    description: 'Large-scale RAG with 1M+ documents',
  },
};
