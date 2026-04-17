'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Skeleton,
  Paper,
  IconButton,
  Collapse,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Button,
  Alert,
  AlertTitle,
  Slider,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import TimelineIcon from '@mui/icons-material/Timeline';
import TokenIcon from '@mui/icons-material/DataObject';
import StorageIcon from '@mui/icons-material/Storage';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  SimulationInput,
  SimulationOutput,
  Insight,
  TopLever,
  ModelComparisonEntry,
  ArchitectureResult,
  Scenario,
  Warning,
  OptimizationMode,
  SimulatorMode,
  AgentCOGS,
  UnitEconomics,
  PricingModelComparison,
  PaybackResult,
  BreakEvenResult,
  ChurnSensitivityPoint,
  PricingRecommendation,
  AgentEconomicsInput,
} from '@/lib/cost/schema';
import { analyzeTokenBudget } from '@/lib/cost/insights';
import { projectGrowth } from '@/lib/cost/projection';
import { type WorkloadClass, WORKLOAD_META } from '@/lib/cost/classification';
import { getPricing } from '@/lib/cost/pricing';
import { loadScenarios } from '@/lib/scenarios/storage';
import { formatCurrency, formatNumber } from '@/lib/format';
import CostBreakdownChart, {
  CATEGORY_COLORS,
} from '@/components/charts/CostBreakdownChart';
import SensitivityChart from '@/components/charts/SensitivityChart';
import GrowthProjectionChart from '@/components/charts/GrowthProjectionChart';
import ModelComparisonTable from './ModelComparisonTable';
import ArchitecturePanel from './ArchitecturePanel';
import TelemetryPanel from './TelemetryPanel';

/* ───── helpers ───── */

function MetricCard({
  label,
  value,
  color,
  large,
}: {
  label: string;
  value: string;
  color: string;
  large?: boolean;
}) {
  return (
    <Card sx={{ borderTop: `3px solid ${color}` }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography
          variant={large ? 'h5' : 'h6'}
          fontWeight={700}
          sx={{ color }}
        >
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function Section({
  icon,
  title,
  defaultOpen = true,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => setOpen(!open)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon}
            <Typography variant="subtitle1">{title}</Typography>
            {badge}
          </Box>
          <IconButton size="small">
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        <Collapse in={open}>
          <Box sx={{ mt: 1.5 }}>{children}</Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

/* ───── sorting logic for model comparison ───── */

function sortEntries(
  entries: ModelComparisonEntry[],
  mode: OptimizationMode,
): ModelComparisonEntry[] {
  const sorted = [...entries];

  switch (mode) {
    case 'cost_first':
      sorted.sort((a, b) => a.totalMonthlyCost - b.totalMonthlyCost);
      break;
    case 'quality_first':
      sorted.sort(
        (a, b) =>
          b.qualityScore - a.qualityScore ||
          a.totalMonthlyCost - b.totalMonthlyCost,
      );
      break;
    case 'balanced': {
      const costs = sorted.map((e) => e.totalMonthlyCost);
      const maxCost = Math.max(...costs);
      const minCost = Math.min(...costs);
      const costRange = maxCost - minCost || 1;
      const score = (e: ModelComparisonEntry) =>
        0.5 * (1 - (e.totalMonthlyCost - minCost) / costRange) +
        0.3 * (1 - (e.latencyClass - 1) / 2) +
        0.2 * ((e.qualityScore - 1) / 4);
      sorted.sort((a, b) => score(b) - score(a));
      break;
    }
  }

  sorted.forEach((e) => (e.isRecommended = false));
  if (sorted.length > 0) sorted[0].isRecommended = true;

  return sorted;
}

/* ───── main ───── */

interface ResultsPanelProps {
  mode: SimulatorMode;
  input: SimulationInput;
  result: SimulationOutput | null;
  insights: Insight[];
  topLever: TopLever | null;
  modelComparison: ModelComparisonEntry[];
  architecture: ArchitectureResult | null;
  sensitivity: { high: SimulationOutput; low: SimulationOutput } | null;
  warnings: Warning[];
  workloadClass: WorkloadClass;
  compareScenario: Scenario | null;
  compareMode: boolean;
  onLoadCompare: (scenario: Scenario) => void;
  onAutoOptimize: () => void;
  /* Agent Economics props */
  agentCogs?: AgentCOGS | null;
  agentUnitEcon?: UnitEconomics | null;
  agentPricingComparison?: PricingModelComparison[];
  agentPayback?: PaybackResult | null;
  agentBreakEven?: BreakEvenResult | null;
  agentChurnData?: ChurnSensitivityPoint[];
  agentPricingRec?: PricingRecommendation | null;
  agentBusinessWarnings?: Warning[];
  agentInput?: AgentEconomicsInput;
  onCopyPriceChainExport?: () => void;
}

export default function ResultsPanel({
  mode,
  input,
  result,
  insights,
  topLever,
  modelComparison,
  architecture,
  sensitivity,
  warnings,
  workloadClass,
  compareScenario,
  compareMode,
  onLoadCompare,
  onAutoOptimize,
  agentCogs,
  agentUnitEcon,
  agentPricingComparison,
  agentPayback,
  agentBreakEven,
  agentChurnData,
  agentPricingRec,
  agentBusinessWarnings,
  agentInput,
  onCopyPriceChainExport,
}: ResultsPanelProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [optimizationMode, setOptimizationMode] =
    useState<OptimizationMode>('cost_first');
  const [growthRate, setGrowthRate] = useState(10);

  useEffect(() => {
    if (compareMode) setScenarios(loadScenarios());
  }, [compareMode]);

  const pricing = getPricing();

  const sortedComparison = useMemo(
    () => sortEntries(modelComparison, optimizationMode),
    [modelComparison, optimizationMode],
  );

  const tokenBudget = useMemo(
    () => (result ? analyzeTokenBudget(input, result) : null),
    [input, result],
  );

  const growthData = useMemo(
    () => (result ? projectGrowth(input, growthRate) : []),
    [input, growthRate, result],
  );

  const vectorDbSizeGb = input.ragEnabled
    ? (input.documentsIndexed * (input.embeddingDimensions || 768) * 4) /
      1024 ** 3
    : 0;

  if (!result) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rounded" height={120} />
        ))}
      </Box>
    );
  }

  /* ═══════ Agent Economics view ═══════ */
  if (mode === 'agent_economics') {
    return (
      <AgentEconomicsResults
        agentCogs={agentCogs ?? null}
        agentUnitEcon={agentUnitEcon ?? null}
        agentPricingComparison={agentPricingComparison ?? []}
        agentPayback={agentPayback ?? null}
        agentBreakEven={agentBreakEven ?? null}
        agentChurnData={agentChurnData ?? []}
        agentPricingRec={agentPricingRec ?? null}
        agentBusinessWarnings={agentBusinessWarnings ?? []}
        agentInput={agentInput}
        onCopyPriceChainExport={onCopyPriceChainExport}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* ── Pricing Config Banner + Workload Classification ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          bgcolor: '#f1f3f4',
          borderRadius: 1,
          flexWrap: 'wrap',
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 16, color: '#5f6368' }} />
        <Typography variant="caption" color="text.secondary">
          Pricing: {pricing.meta.source} &middot; v{pricing.meta.version} &middot; Updated{' '}
          {pricing.meta.updatedAt}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title={WORKLOAD_META[workloadClass].description}>
          <Chip
            label={workloadClass}
            size="small"
            sx={{
              bgcolor: WORKLOAD_META[workloadClass].color,
              color: 'white',
              fontWeight: 600,
              fontSize: 11,
              height: 24,
            }}
          />
        </Tooltip>
      </Box>

      {/* ── Guardrail Warnings ── */}
      {warnings.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {warnings.map((w, i) => (
            <Alert
              key={i}
              severity={w.level === 'error' ? 'error' : w.level === 'warning' ? 'warning' : 'info'}
              icon={w.level === 'error' ? undefined : <WarningAmberIcon fontSize="small" />}
              sx={{
                '& .MuiAlert-message': { py: 0.25 },
              }}
            >
              <AlertTitle sx={{ fontSize: '0.85rem', mb: 0 }}>{w.title}</AlertTitle>
              <Typography variant="caption">{w.message}</Typography>
            </Alert>
          ))}
        </Box>
      )}

      {/* ── Summary Metrics ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr', md: 'repeat(5, 1fr)' },
          gap: 2,
        }}
      >
        <MetricCard
          label="Total Monthly Cost"
          value={formatCurrency(result.totalMonthlyCost)}
          color="#1a73e8"
          large
        />
        <MetricCard
          label="Cost / Request"
          value={`$${result.costPerRequest.toFixed(4)}`}
          color="#ea4335"
        />
        <MetricCard
          label="Cost / 1K Requests"
          value={`$${result.costPer1kRequests.toFixed(2)}`}
          color="#9334e6"
        />
        <MetricCard
          label="Monthly Requests"
          value={formatNumber(result.monthlyRequests)}
          color="#34a853"
        />
        <MetricCard
          label="Total Tokens"
          value={formatNumber(result.totalTokens)}
          color="#fbbc04"
        />
      </Box>

      {/* ── Top Lever ── */}
      {topLever && (
        <Paper
          sx={{
            p: 2,
            bgcolor: '#e8f0fe',
            border: '1px solid #4285f4',
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <AutoFixHighIcon sx={{ color: '#1a73e8', fontSize: 20 }} />
            <Typography variant="body2" fontWeight={700} color="primary">
              Top Cost Lever
            </Typography>
            <Chip
              label={`${topLever.component} — ${topLever.contributionPct.toFixed(0)}% of spend`}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ height: 22, fontSize: 11 }}
            />
          </Box>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {topLever.action}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Estimated savings: ~${topLever.estimatedSavings.toFixed(0)}/month (
            {topLever.estimatedSavingsPct}%)
          </Typography>
        </Paper>
      )}

      {/* ── Compare ── */}
      {compareMode && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Scenario Comparison
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Saved scenario</InputLabel>
                <Select
                  label="Saved scenario"
                  value={compareScenario?.id || ''}
                  onChange={(e) => {
                    const s = scenarios.find((s) => s.id === e.target.value);
                    if (s) onLoadCompare(s);
                  }}
                >
                  {scenarios.length === 0 && (
                    <MenuItem value="" disabled>
                      No saved scenarios
                    </MenuItem>
                  )}
                  {scenarios.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Tooltip title="Auto-generate optimised scenario">
                <Button variant="outlined" size="small" onClick={onAutoOptimize}>
                  Auto-Optimise
                </Button>
              </Tooltip>
            </Box>
            {compareScenario && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <CompareCard label="Current" total={result.totalMonthlyCost} />
                <CompareCard
                  label={compareScenario.name}
                  total={compareScenario.output.totalMonthlyCost}
                />
                <CompareCard
                  label="Delta"
                  total={
                    result.totalMonthlyCost -
                    compareScenario.output.totalMonthlyCost
                  }
                  isDelta
                />
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Cost Breakdown Chart ── */}
      <Section icon={null} title="Cost Breakdown">
        <CostBreakdownChart breakdown={result.breakdown} />
      </Section>

      {/* ── Line Items ── */}
      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <Typography variant="subtitle1" sx={{ px: 2, pt: 2, pb: 1 }}>
            Cost Details
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Component</TableCell>
                  <TableCell align="right">Monthly Cost</TableCell>
                  <TableCell align="right">Share</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.breakdown.map((item, i) => (
                  <TableRow key={i} hover>
                    <TableCell>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor:
                              CATEGORY_COLORS[item.category] || '#999',
                            flexShrink: 0,
                          }}
                        />
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {item.category}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.label}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500}>
                        ${item.amount.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${item.percentage.toFixed(1)}%`}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell>
                    <Typography fontWeight={700}>Total</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={700}>
                      ${result.totalMonthlyCost.toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip label="100%" size="small" color="primary" />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* ── Token Budget + Vector DB Size ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: input.ragEnabled ? '1fr 1fr' : '1fr',
          },
          gap: 2,
        }}
      >
        {tokenBudget && (
          <Card sx={{ borderLeft: tokenBudget.isHigh ? '3px solid #ea4335' : '3px solid #34a853' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TokenIcon sx={{ fontSize: 18, color: tokenBudget.isHigh ? '#ea4335' : '#34a853' }} />
                <Typography variant="body2" fontWeight={600}>
                  Token Budget Analysis
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Completion Ratio
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {tokenBudget.completionRatio.toFixed(2)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Industry Typical
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {tokenBudget.industryTypical}
                  </Typography>
                </Box>
              </Box>
              {tokenBudget.isHigh && tokenBudget.suggestedCompletionTokens !== null && (
                <Typography variant="caption" color="error.main">
                  Suggestion: Limit completion tokens to{' '}
                  {tokenBudget.suggestedCompletionTokens.toLocaleString()}.
                  {tokenBudget.estimatedMonthlySavings !== null &&
                    ` Saves ~$${tokenBudget.estimatedMonthlySavings.toFixed(0)}/month.`}
                </Typography>
              )}
              {!tokenBudget.isHigh && (
                <Typography variant="caption" color="success.main">
                  Token ratio is within normal range.
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {input.ragEnabled && vectorDbSizeGb > 0 && (
          <Card sx={{ borderLeft: `3px solid ${vectorDbSizeGb > 10 ? '#ea4335' : '#4285f4'}` }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <StorageIcon sx={{ fontSize: 18, color: '#4285f4' }} />
                <Typography variant="body2" fontWeight={600}>
                  Vector DB Size Estimate
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Documents
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {input.documentsIndexed.toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Dimensions
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {input.embeddingDimensions}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Est. Storage
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {vectorDbSizeGb >= 1
                      ? `${vectorDbSizeGb.toFixed(1)} GB`
                      : `${(vectorDbSizeGb * 1024).toFixed(0)} MB`}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {input.embeddingDimensions} dims &times; 4 bytes ={' '}
                {((input.embeddingDimensions * 4) / 1024).toFixed(1)} KB/vector
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* ── Model Comparison ── */}
      {sortedComparison.length > 0 && (
        <Section
          icon={<CompareArrowsIcon color="primary" fontSize="small" />}
          title="Model Comparison"
          badge={
            <Chip
              label={
                optimizationMode === 'cost_first'
                  ? 'Lowest Cost'
                  : optimizationMode === 'quality_first'
                    ? 'Highest Quality'
                    : 'Balanced'
              }
              size="small"
              variant="outlined"
              sx={{ height: 22, fontSize: 11, ml: 1 }}
            />
          }
        >
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
              Optimisation Mode
            </Typography>
            <ToggleButtonGroup
              size="small"
              value={optimizationMode}
              exclusive
              onChange={(_, val) => val && setOptimizationMode(val)}
              sx={{ height: 28 }}
            >
              <ToggleButton value="cost_first" sx={{ px: 1.5, fontSize: 12 }}>
                Lowest Cost
              </ToggleButton>
              <ToggleButton value="balanced" sx={{ px: 1.5, fontSize: 12 }}>
                Balanced
              </ToggleButton>
              <ToggleButton value="quality_first" sx={{ px: 1.5, fontSize: 12 }}>
                Highest Quality
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <ModelComparisonTable entries={sortedComparison} mode={optimizationMode} />
        </Section>
      )}

      {/* ── Insights ── */}
      {insights.length > 0 && (
        <Section
          icon={<LightbulbOutlinedIcon color="primary" fontSize="small" />}
          title="Optimisation Insights"
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {insights.map((insight, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 0.5,
                    flexWrap: 'wrap',
                  }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    {insight.title}
                  </Typography>
                  <Chip
                    label={`~${insight.estimatedSavingsPct}% savings`}
                    size="small"
                    color="success"
                    variant="outlined"
                    icon={<TrendingDownIcon />}
                  />
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  {insight.recommendation}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontStyle: 'italic' }}
                >
                  Trade-off: {insight.tradeoff}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Section>
      )}

      {/* ── Architecture ── */}
      {architecture && (
        <Section
          icon={<AccountTreeOutlinedIcon color="primary" fontSize="small" />}
          title="Recommended GCP Architecture"
          defaultOpen={false}
        >
          <ArchitecturePanel architecture={architecture} />
        </Section>
      )}

      {/* ── Growth Projection ── */}
      <Section
        icon={<TimelineIcon color="primary" fontSize="small" />}
        title="12-Month Cost Projection"
        defaultOpen={false}
      >
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            MAU Growth Rate
          </Typography>
          <Slider
            value={growthRate}
            onChange={(_, v) => setGrowthRate(v as number)}
            min={0}
            max={30}
            step={1}
            valueLabelDisplay="auto"
            valueLabelFormat={(v: number) => `${v}%/month`}
            sx={{ maxWidth: 200 }}
          />
          <Chip
            label={`${growthRate}%/month`}
            size="small"
            variant="outlined"
            sx={{ height: 22, fontSize: 11 }}
          />
        </Box>
        {growthData.length > 0 && (
          <>
            <GrowthProjectionChart data={growthData} />
            <Box sx={{ mt: 1, display: 'flex', gap: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Month 1
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatCurrency(growthData[0].monthlyCost)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Month 6
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {growthData.length >= 6 ? formatCurrency(growthData[5].monthlyCost) : '—'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Month 12
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {growthData.length >= 12 ? formatCurrency(growthData[11].monthlyCost) : '—'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  12-Month Total
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatCurrency(
                    growthData.reduce((sum, p) => sum + p.monthlyCost, 0),
                  )}
                </Typography>
              </Box>
            </Box>
          </>
        )}
      </Section>

      {/* ── Sensitivity ── */}
      {sensitivity && (
        <Section
          icon={<BarChartIcon color="primary" fontSize="small" />}
          title="Sensitivity Analysis (\u00b120% Tokens)"
          defaultOpen={false}
        >
          <SensitivityChart
            low={sensitivity.low.totalMonthlyCost}
            current={result.totalMonthlyCost}
            high={sensitivity.high.totalMonthlyCost}
          />
        </Section>
      )}

      {/* ── Telemetry ── */}
      <Section
        icon={<MonitorHeartOutlinedIcon color="primary" fontSize="small" />}
        title="Telemetry Schema"
        defaultOpen={false}
      >
        <TelemetryPanel input={input} output={result} />
      </Section>
    </Box>
  );
}

/* ───── Agent Economics Results ───── */

function AgentEconomicsResults({
  agentCogs,
  agentUnitEcon,
  agentPricingComparison,
  agentPayback,
  agentBreakEven,
  agentChurnData,
  agentPricingRec,
  agentBusinessWarnings,
  agentInput,
  onCopyPriceChainExport,
}: {
  agentCogs: AgentCOGS | null;
  agentUnitEcon: UnitEconomics | null;
  agentPricingComparison: PricingModelComparison[];
  agentPayback: PaybackResult | null;
  agentBreakEven: BreakEvenResult | null;
  agentChurnData: ChurnSensitivityPoint[];
  agentPricingRec: PricingRecommendation | null;
  agentBusinessWarnings: Warning[];
  agentInput?: AgentEconomicsInput;
  onCopyPriceChainExport?: () => void;
}) {
  const PURPLE = '#9334e6';
  const GREEN = '#34a853';
  const RED = '#ea4335';
  const BLUE = '#1a73e8';
  const YELLOW = '#fbbc04';

  const marginColor = (pct: number) => pct >= 60 ? GREEN : pct >= 30 ? YELLOW : RED;
  const healthColor = (h?: string) => h === 'healthy' ? GREEN : h === 'acceptable' ? BLUE : h === 'risky' ? YELLOW : RED;

  if (!agentCogs || !agentUnitEcon) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={120} />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* ── Business Warnings ── */}
      {agentBusinessWarnings.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {agentBusinessWarnings.map((w, i) => (
            <Alert
              key={i}
              severity={w.level === 'error' ? 'error' : w.level === 'warning' ? 'warning' : 'info'}
              icon={w.level === 'error' ? undefined : <WarningAmberIcon fontSize="small" />}
              sx={{ '& .MuiAlert-message': { py: 0.25 } }}
            >
              <AlertTitle sx={{ fontSize: '0.85rem', mb: 0 }}>{w.title}</AlertTitle>
              <Typography variant="caption">{w.message}</Typography>
            </Alert>
          ))}
        </Box>
      )}

      {/* ── Unit Economics Summary ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr', md: 'repeat(5, 1fr)' },
          gap: 2,
        }}
      >
        <MetricCard label="Monthly Revenue" value={formatCurrency(agentUnitEcon.monthlyRevenue)} color={BLUE} large />
        <MetricCard label="Monthly COGS" value={formatCurrency(agentUnitEcon.monthlyCogs)} color={RED} />
        <MetricCard label="Gross Margin" value={formatCurrency(agentUnitEcon.grossMargin)} color={marginColor(agentUnitEcon.grossMarginPct)} />
        <MetricCard label="Margin %" value={`${agentUnitEcon.grossMarginPct.toFixed(1)}%`} color={marginColor(agentUnitEcon.grossMarginPct)} large />
        <MetricCard label="Payback" value={agentPayback ? `${agentPayback.months.toFixed(1)} mo` : '—'} color={healthColor(agentPayback?.health)} />
      </Box>

      {/* ── Per-Unit Metrics ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
        <MetricCard label="Revenue / Task" value={`$${agentUnitEcon.revenuePerTask.toFixed(4)}`} color={BLUE} />
        <MetricCard label="COGS / Task" value={`$${agentUnitEcon.cogsPerTask.toFixed(4)}`} color={RED} />
        <MetricCard label="Margin / Task" value={`$${agentUnitEcon.marginPerTask.toFixed(4)}`} color={marginColor(agentUnitEcon.grossMarginPct)} />
        <MetricCard label="Platform Tax" value={formatCurrency(agentUnitEcon.platformTaxAmount)} color={PURPLE} />
      </Box>

      {/* ── Chain Cost Breakdown ── */}
      <Section icon={<BarChartIcon color="primary" fontSize="small" />} title="Chain Cost Breakdown">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Step</TableCell>
                <TableCell>Model</TableCell>
                <TableCell align="right">Calls/mo</TableCell>
                <TableCell align="right">Inference $/mo</TableCell>
                <TableCell align="right">% of COGS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agentCogs.chainBreakdown.map((step, i) => (
                <TableRow key={i} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{step.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{step.modelName}</Typography>
                  </TableCell>
                  <TableCell align="right">{formatNumber(step.callsPerMonth)}</TableCell>
                  <TableCell align="right">${step.inferenceCost.toFixed(2)}</TableCell>
                  <TableCell align="right">
                    <Chip label={`${step.percentageOfCogs.toFixed(1)}%`} size="small" variant="outlined" />
                  </TableCell>
                </TableRow>
              ))}
              {/* Shared cost rows */}
              {agentCogs.infraCost > 0 && (
                <TableRow hover>
                  <TableCell colSpan={3}><Typography variant="body2" color="text.secondary">Infrastructure</Typography></TableCell>
                  <TableCell align="right">${agentCogs.infraCost.toFixed(2)}</TableCell>
                  <TableCell align="right"><Chip label={`${((agentCogs.infraCost / agentCogs.totalMonthlyCost) * 100).toFixed(1)}%`} size="small" variant="outlined" /></TableCell>
                </TableRow>
              )}
              {(agentCogs.embeddingIndexingCost + agentCogs.vectorRetrievalCost) > 0 && (
                <TableRow hover>
                  <TableCell colSpan={3}><Typography variant="body2" color="text.secondary">RAG (Embeddings + Vector DB)</Typography></TableCell>
                  <TableCell align="right">${(agentCogs.embeddingIndexingCost + agentCogs.vectorRetrievalCost).toFixed(2)}</TableCell>
                  <TableCell align="right"><Chip label={`${(((agentCogs.embeddingIndexingCost + agentCogs.vectorRetrievalCost) / agentCogs.totalMonthlyCost) * 100).toFixed(1)}%`} size="small" variant="outlined" /></TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell colSpan={3}><Typography fontWeight={700}>Total COGS</Typography></TableCell>
                <TableCell align="right"><Typography fontWeight={700}>${agentCogs.totalMonthlyCost.toFixed(2)}</Typography></TableCell>
                <TableCell align="right"><Chip label="100%" size="small" color="primary" /></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ mt: 1.5 }}>
          {agentCogs.explanation.map((line, i) => (
            <Typography key={i} variant="caption" color="text.secondary" display="block">{line}</Typography>
          ))}
        </Box>
      </Section>

      {/* ── Pricing Model Comparison ── */}
      {agentPricingComparison.length > 0 && (
        <Section icon={<CompareArrowsIcon color="primary" fontSize="small" />} title="Pricing Model Comparison">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Model</TableCell>
                  <TableCell align="right">Revenue/mo</TableCell>
                  <TableCell align="right">Margin/mo</TableCell>
                  <TableCell align="right">Margin %</TableCell>
                  <TableCell align="right">Break-Even</TableCell>
                  <TableCell align="right">Payback</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {agentPricingComparison.map((pm) => (
                  <TableRow key={pm.pricingModel} hover sx={pm.isSelected ? { bgcolor: '#e8f0fe' } : undefined}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight={pm.isSelected ? 700 : 400}>
                          {pm.label}
                        </Typography>
                        {pm.isSelected && <Chip label="current" size="small" color="primary" sx={{ height: 18, fontSize: 10 }} />}
                      </Box>
                    </TableCell>
                    <TableCell align="right">{formatCurrency(pm.monthlyRevenue)}</TableCell>
                    <TableCell align="right" sx={{ color: pm.grossMargin >= 0 ? GREEN : RED }}>
                      {formatCurrency(pm.grossMargin)}
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${pm.grossMarginPct.toFixed(1)}%`}
                        size="small"
                        sx={{
                          height: 22,
                          bgcolor: pm.grossMarginPct >= 60 ? '#e6f4ea' : pm.grossMarginPct >= 30 ? '#fef7e0' : '#fce8e6',
                          color: pm.grossMarginPct >= 60 ? GREEN : pm.grossMarginPct >= 30 ? '#e37400' : RED,
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">{pm.breakEvenCustomers === Infinity ? '∞' : formatNumber(pm.breakEvenCustomers)}</TableCell>
                    <TableCell align="right">{pm.paybackMonths === Infinity ? '∞' : `${pm.paybackMonths.toFixed(1)} mo`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Section>
      )}

      {/* ── Break-Even ── */}
      {agentBreakEven && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Card sx={{ borderTop: `3px solid ${BLUE}` }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Break-Even Customers</Typography>
              <Typography variant="h5" fontWeight={700} color="primary">
                {agentBreakEven.customers === Infinity ? '∞' : formatNumber(agentBreakEven.customers)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Fixed costs: {formatCurrency(agentBreakEven.monthlyFixedCosts)}/mo &middot; Contribution: ${agentBreakEven.contributionPerCustomer.toFixed(2)}/customer
              </Typography>
            </CardContent>
          </Card>
          {agentPayback && (
            <Card sx={{ borderTop: `3px solid ${healthColor(agentPayback.health)}` }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary">CAC Payback Period</Typography>
                <Typography variant="h5" fontWeight={700} sx={{ color: healthColor(agentPayback.health) }}>
                  {agentPayback.months === Infinity ? '∞' : `${agentPayback.months.toFixed(1)} months`}
                </Typography>
                <Chip label={agentPayback.health} size="small" sx={{ mt: 0.5, height: 20, fontSize: 11, bgcolor: healthColor(agentPayback.health), color: '#fff' }} />
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* ── Churn Sensitivity ── */}
      {agentChurnData.length > 0 && (
        <Section icon={<TimelineIcon color="primary" fontSize="small" />} title="Churn Sensitivity" defaultOpen={false}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Churn Rate</TableCell>
                  <TableCell align="right">Steady-State</TableCell>
                  <TableCell align="right">Revenue/mo</TableCell>
                  <TableCell align="right">Margin %</TableCell>
                  <TableCell align="right">Payback</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {agentChurnData.map((pt, i) => {
                  const isCurrent = Math.abs(pt.churnMultiplier - 1.0) < 0.01;
                  return (
                    <TableRow key={i} hover sx={isCurrent ? { bgcolor: '#e8f0fe' } : undefined}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={isCurrent ? 700 : 400}>
                          {pt.churnRatePct.toFixed(1)}%
                          {isCurrent && <Chip label="current" size="small" color="primary" sx={{ ml: 0.5, height: 18, fontSize: 10 }} />}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{formatNumber(pt.steadyStateCustomers)}</TableCell>
                      <TableCell align="right">{formatCurrency(pt.monthlyRevenue)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ color: marginColor(pt.grossMarginPct) }}>
                          {pt.grossMarginPct.toFixed(1)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{pt.paybackMonths === Infinity ? '∞' : `${pt.paybackMonths.toFixed(1)} mo`}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Section>
      )}

      {/* ── Pricing Recommendation ── */}
      {agentPricingRec && (
        <Section icon={<LightbulbOutlinedIcon sx={{ color: PURPLE }} fontSize="small" />} title="Pricing Recommendation" defaultOpen>
          <Typography variant="body2" sx={{ mb: 2 }}>{agentPricingRec.rationale}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            COGS Floor: ${agentPricingRec.cogsFloor.toFixed(4)} per task
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${agentPricingRec.tiers.length}, 1fr)` }, gap: 2 }}>
            {agentPricingRec.tiers.map((tier, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 2, borderColor: i === 1 ? PURPLE : undefined, borderWidth: i === 1 ? 2 : 1 }}>
                {i === 1 && (
                  <Chip label="Recommended" size="small" sx={{ mb: 1, bgcolor: PURPLE, color: '#fff', height: 20, fontSize: 10 }} />
                )}
                <Typography variant="subtitle2" fontWeight={700}>{tier.tierName}</Typography>
                <Typography variant="h6" fontWeight={700} color="primary">
                  ${tier.price.toFixed(2)}<Typography component="span" variant="caption" color="text.secondary">/{tier.unit}</Typography>
                </Typography>
                <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
                  {tier.included.map((item, j) => (
                    <Typography component="li" key={j} variant="caption">{item}</Typography>
                  ))}
                </Box>
                {tier.limits && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontStyle: 'italic' }}>
                    {tier.limits}
                  </Typography>
                )}
              </Paper>
            ))}
          </Box>
          {onCopyPriceChainExport && (
            <Button
              variant="outlined"
              size="small"
              onClick={onCopyPriceChainExport}
              sx={{ mt: 2, borderColor: PURPLE, color: PURPLE }}
            >
              Export to PriceChain (JSON)
            </Button>
          )}
        </Section>
      )}
    </Box>
  );
}

/* ───── compare helper ───── */

function CompareCard({
  label,
  total,
  isDelta,
}: {
  label: string;
  total: number;
  isDelta?: boolean;
}) {
  const color = isDelta
    ? total < 0
      ? '#34a853'
      : total > 0
        ? '#ea4335'
        : '#5f6368'
    : '#202124';
  const prefix = isDelta && total > 0 ? '+' : '';
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: 'center' }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={700} sx={{ color }}>
        {prefix}${Math.abs(total).toFixed(2)}
      </Typography>
      {isDelta && total !== 0 && (
        <Typography
          variant="caption"
          color={total < 0 ? 'success.main' : 'error.main'}
        >
          {total < 0 ? 'Savings' : 'Increase'}
        </Typography>
      )}
    </Paper>
  );
}
