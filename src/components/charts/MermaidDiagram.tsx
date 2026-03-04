'use client';

import { useEffect, useState } from 'react';
import { Box, Skeleton } from '@mui/material';

let counter = 0;

export default function MermaidDiagram({ chart }: { chart: string }) {
  const [svg, setSvg] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = `mermaid-${++counter}-${Date.now()}`;
    let cancelled = false;

    import('mermaid').then(async (mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'loose',
        flowchart: { curve: 'basis', padding: 16 },
      });
      try {
        const result = await mermaid.render(id, chart);
        if (!cancelled) setSvg(result.svg);
      } catch {
        // graceful degradation — user can still copy code
      } finally {
        if (!cancelled) setReady(true);
      }
    }).catch(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (!ready) return <Skeleton variant="rounded" height={300} />;
  if (!svg) return null;

  return (
    <Box
      sx={{
        textAlign: 'center',
        overflow: 'auto',
        '& svg': { maxWidth: '100%', height: 'auto' },
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
