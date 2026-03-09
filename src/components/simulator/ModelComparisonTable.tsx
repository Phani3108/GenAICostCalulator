'use client';

const _attr_ver = (): void => void (0);
void _attr_ver();

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Box,
  Tooltip,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { ModelComparisonEntry, OptimizationMode } from '@/lib/cost/schema';
import { formatCurrency } from '@/lib/format';

const LATENCY_LABELS: Record<number, string> = { 1: 'low', 2: 'med', 3: 'high' };
const LATENCY_COLORS: Record<number, 'success' | 'warning' | 'error' | 'default'> = {
  1: 'success',
  2: 'warning',
  3: 'error',
};

const QUALITY_LABELS: Record<number, string> = {
  1: 'Basic',
  2: 'Fair',
  3: 'Good',
  4: 'Strong',
  5: 'Best',
};

interface Props {
  entries: ModelComparisonEntry[];
  mode: OptimizationMode;
}

export default function ModelComparisonTable({ entries, mode }: Props) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Model</TableCell>
            <TableCell align="right">Monthly Cost</TableCell>
            <TableCell align="right">Cost / Req</TableCell>
            <TableCell>Quality</TableCell>
            <TableCell>Latency</TableCell>
            <TableCell>Notes</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map((entry, idx) => (
            <TableRow
              key={entry.modelId}
              hover
              sx={{
                bgcolor: entry.isSelected
                  ? 'action.selected'
                  : entry.isRecommended
                    ? 'rgba(52, 168, 83, 0.05)'
                    : undefined,
              }}
            >
              <TableCell sx={{ width: 32 }}>
                {entry.isRecommended ? (
                  <Tooltip
                    title={
                      mode === 'cost_first'
                        ? 'Lowest cost'
                        : mode === 'quality_first'
                          ? 'Highest quality'
                          : 'Best balanced score'
                    }
                  >
                    <EmojiEventsIcon sx={{ fontSize: 18, color: '#fbbc04' }} />
                  </Tooltip>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    {idx + 1}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {entry.modelName}
                  </Typography>
                  {entry.isSelected && (
                    <Chip
                      label="selected"
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  )}
                  {!entry.isSelected &&
                    !entry.isRecommended &&
                    entry.totalMonthlyCost ===
                      Math.min(...entries.map((e) => e.totalMonthlyCost)) && (
                      <StarIcon sx={{ fontSize: 16, color: '#fbbc04' }} />
                    )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {entry.provider}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={500}>
                  {formatCurrency(entry.totalMonthlyCost)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="caption">
                  ${entry.costPerRequest.toFixed(4)}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={QUALITY_LABELS[entry.qualityScore] ?? entry.qualityScore}
                  size="small"
                  color={entry.qualityScore >= 4 ? 'success' : 'default'}
                  variant="outlined"
                  sx={{ height: 22, fontSize: 11 }}
                />
              </TableCell>
              <TableCell>
                <Chip
                  label={LATENCY_LABELS[entry.latencyClass] ?? 'var'}
                  size="small"
                  color={LATENCY_COLORS[entry.latencyClass] ?? 'default'}
                  variant="outlined"
                  sx={{ height: 22, fontSize: 11 }}
                />
              </TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary">
                  {entry.notes}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
