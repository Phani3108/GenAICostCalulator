'use client';

import {
  Box,
  Typography,
  Paper,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
} from '@mui/material';
import { SimulationInput, SimulationOutput } from '@/lib/cost/schema';

interface Props {
  input: SimulationInput;
  output: SimulationOutput;
}

export default function TelemetryPanel({ input, output }: Props) {
  const sampleEvent = {
    requestId: 'req_a1b2c3d4',
    timestamp: new Date().toISOString(),
    modelId: input.modelId,
    inputTokens: input.avgPromptTokens,
    outputTokens: input.avgCompletionTokens,
    latencyMs: 450,
    cacheHit: false,
    retrievalUsed: input.ragEnabled,
    vectorQueries: input.ragEnabled ? (input.topK || 5) : 0,
    totalCostUsd: parseFloat(output.costPerRequest.toFixed(6)),
  };

  const metrics = [
    ['requestId', 'Unique request identifier'],
    ['modelId', 'Model used for inference'],
    ['inputTokens', 'Prompt tokens sent'],
    ['outputTokens', 'Completion tokens received'],
    ['latencyMs', 'End-to-end latency'],
    ['cacheHit', 'Whether response served from cache'],
    ['retrievalUsed', 'Whether RAG retrieval was triggered'],
    ['vectorQueries', 'Number of vector search queries'],
    ['totalCostUsd', 'Estimated cost for this request'],
  ];

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Recommended metrics to log per request. Store in{' '}
        <Chip label="BigQuery" size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />{' '}
        for cost/quality dashboards.
      </Typography>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
        <Table size="small">
          <TableBody>
            {metrics.map(([key, desc]) => (
              <TableRow key={key}>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>
                  {key}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {desc}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" fontWeight={600} color="primary" gutterBottom sx={{ display: 'block' }}>
        Sample event payload
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          fontFamily: 'monospace',
          fontSize: 11,
          lineHeight: 1.6,
          bgcolor: '#f8f9fa',
          overflow: 'auto',
          whiteSpace: 'pre',
        }}
      >
        {JSON.stringify(sampleEvent, null, 2)}
      </Paper>
    </Box>
  );
}
