import { SimulationInput, CostLineItem, ArchitectureResult } from './schema';
import templatesData from '@/data/architecture_templates.json';

interface RawTemplate {
  id: string;
  when: { ragEnabled: boolean; hosting: string };
  name: string;
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<[string, string]>;
  notes: string[];
}

const NODE_COST_MAP: Record<string, string> = {
  llm: 'Model Inference',
  embed: 'Embedding Indexing',
  vsearch: 'Vector Retrieval',
  run: 'Infrastructure',
  gke: 'Infrastructure',
  logging: 'Observability',
  lb: 'Networking',
};

const STYLE_DEFS = [
  'classDef vertex fill:#34a853,stroke:#1e8e3e,color:white,stroke-width:2px',
  'classDef compute fill:#4285f4,stroke:#1a73e8,color:white,stroke-width:2px',
  'classDef data fill:#fbbc04,stroke:#f9ab00,color:#202124,stroke-width:2px',
  'classDef obs fill:#ff6d01,stroke:#e65100,color:white,stroke-width:2px',
  'classDef default fill:#e8eaed,stroke:#5f6368,color:#202124,stroke-width:2px',
];

function fmtCost(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(0)}`;
  return `$${n.toFixed(2)}`;
}

export function getArchitecture(
  input: SimulationInput,
  breakdown?: CostLineItem[],
): ArchitectureResult | null {
  const templates = templatesData.templates as RawTemplate[];

  const match = templates.find(
    (t) =>
      t.when.ragEnabled === input.ragEnabled && t.when.hosting === input.hosting,
  );

  if (!match) return null;

  const costByCategory = new Map<string, number>();
  if (breakdown) {
    for (const item of breakdown) {
      costByCategory.set(item.category, item.amount);
    }
  }

  const lines: string[] = ['graph TD'];

  for (const node of match.nodes) {
    const mappedCategory = NODE_COST_MAP[node.id];
    const cost = mappedCategory ? costByCategory.get(mappedCategory) : undefined;
    const label =
      cost !== undefined && cost > 0
        ? `${node.label}<br/><i>${fmtCost(cost)}/mo</i>`
        : node.label;
    lines.push(`    ${node.id}["${label}"]`);
  }

  lines.push('');
  for (const [from, to] of match.edges) {
    lines.push(`    ${from} --> ${to}`);
  }
  lines.push('');
  lines.push(...STYLE_DEFS.map((s) => `    ${s}`));

  const byType: Record<string, string[]> = {};
  for (const node of match.nodes) {
    const t = node.type || 'default';
    (byType[t] ??= []).push(node.id);
  }
  for (const [type, ids] of Object.entries(byType)) {
    lines.push(`    class ${ids.join(',')} ${type}`);
  }

  return {
    id: match.id,
    name: match.name,
    nodes: match.nodes,
    edges: match.edges as [string, string][],
    notes: match.notes,
    mermaidCode: lines.join('\n'),
  };
}
