'use client';

const _prov_cmi_0x7a = (): void => void 0;
void _prov_cmi_0x7a();

import { useState, useCallback, useRef, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Snackbar,
  Alert,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import HomeIcon from '@mui/icons-material/Home';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ShareIcon from '@mui/icons-material/Share';
import { SimulationInput, SimulationOutput, Scenario } from '@/lib/cost/schema';
import { simulate } from '@/lib/cost/engine';
import { getPricing } from '@/lib/cost/pricing';
import { generateInsights, getTopLever } from '@/lib/cost/insights';
import { compareModels } from '@/lib/cost/comparison';
import { getArchitecture } from '@/lib/cost/architecture';
import { generateOptimizedScenario, generateExecBrief } from '@/lib/cost/optimize';
import { generateWarnings } from '@/lib/cost/guardrails';
import { classifyWorkload } from '@/lib/cost/classification';
import { saveScenario } from '@/lib/scenarios/storage';
import { encodeScenarioToUrl, decodeScenarioFromUrl } from '@/lib/url-state';
import presets from '@/data/presets.json';
import InputPanel from './InputPanel';
import ResultsPanel from './ResultsPanel';
import AssumptionsDrawer from './AssumptionsDrawer';

const DEFAULT_VALUES: SimulationInput = {
  monthlyActiveUsers: 80000,
  requestsPerUser: 8,
  avgPromptTokens: 900,
  avgCompletionTokens: 450,
  modelId: 'claude_sonnet_45',
  embeddingModelId: 'vertex_textembedding_004',
  vectorDbId: 'vertex_vector_search',
  ragEnabled: true,
  documentsIndexed: 250000,
  retrievalRate: 0.75,
  cacheHitRate: 0.15,
  trafficPattern: 'steady' as const,
  hosting: 'cloud_run' as const,
  avgDocTokens: 900,
  topK: 6,
  embeddingDimensions: 768,
};

export default function SimulatorPage() {
  const methods = useForm<SimulationInput>({ defaultValues: DEFAULT_VALUES });
  const liveValues = methods.watch();
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounce form values by 250 ms to avoid running 6+ simulations on every keystroke
  const [values, setValues] = useState<SimulationInput>(DEFAULT_VALUES);
  useEffect(() => {
    const id = setTimeout(() => setValues(liveValues), 250);
    return () => clearTimeout(id);
  }, [liveValues]);

  // Load scenario from URL on mount (shared links)
  useEffect(() => {
    const shared = decodeScenarioFromUrl();
    if (shared) {
      methods.reset(shared);
      setSnackbar({ open: true, message: 'Shared scenario loaded from URL' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareScenario, setCompareScenario] = useState<Scenario | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogName, setSaveDialogName] = useState('');

  let result: SimulationOutput | null = null;
  try {
    result = simulate(values);
  } catch {
    /* skip during intermediate input states */
  }

  const insights = result ? generateInsights(values, result) : [];
  const topLever = result ? getTopLever(values, result) : null;
  const modelComparison = result ? compareModels(values) : [];
  const architecture = result
    ? getArchitecture(values, result.breakdown)
    : getArchitecture(values);
  const warnings = result ? generateWarnings(values, result) : [];
  const workloadClass = classifyWorkload(values);

  let sensitivity: { high: SimulationOutput; low: SimulationOutput } | null = null;
  if (result) {
    try {
      sensitivity = {
        high: simulate({
          ...values,
          avgPromptTokens: Math.round(values.avgPromptTokens * 1.2),
          avgCompletionTokens: Math.round(values.avgCompletionTokens * 1.2),
        }),
        low: simulate({
          ...values,
          avgPromptTokens: Math.round(values.avgPromptTokens * 0.8),
          avgCompletionTokens: Math.round(values.avgCompletionTokens * 0.8),
        }),
      };
    } catch {
      /* skip */
    }
  }

  // ── Handlers ──

  const handlePresetChange = useCallback(
    (presetId: string) => {
      const preset = presets.find((p) => p.id === presetId);
      if (preset) methods.reset(preset.inputs as unknown as SimulationInput);
    },
    [methods],
  );

  const handleDemo = useCallback(() => {
    const demoPreset = presets.find((p) => p.id === 'support_rag_enterprise_burst');
    if (demoPreset) {
      methods.reset(demoPreset.inputs as unknown as SimulationInput);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      setSnackbar({ open: true, message: 'Demo loaded — Enterprise Burst RAG' });
    }
  }, [methods]);

  const handleSave = useCallback(() => {
    if (!result) return;
    setSaveDialogName('');
    setSaveDialogOpen(true);
  }, [result]);

  const handleSaveConfirm = useCallback(() => {
    if (!result || !saveDialogName.trim()) return;
    saveScenario({ name: saveDialogName.trim(), inputs: values, output: result });
    setSaveDialogOpen(false);
    setSnackbar({ open: true, message: `Saved "${saveDialogName.trim()}"` });
  }, [values, result, saveDialogName]);

  const handleAutoOptimize = useCallback(() => {
    if (!result) return;
    const optimized = generateOptimizedScenario(values, result);
    const optimizedResult = simulate(optimized);
    const scenario: Scenario = {
      id: 'auto-optimised',
      name: 'Auto-Optimised',
      createdAt: new Date().toISOString(),
      inputs: optimized,
      output: optimizedResult,
    };
    setCompareScenario(scenario);
    setCompareMode(true);
    setSnackbar({ open: true, message: 'Optimised scenario generated' });
  }, [values, result]);

  const handleExportCsv = useCallback(() => {
    if (!result) return;
    // Quote each field to handle commas/quotes in labels (RFC 4180)
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const header = ['Category', 'Label', 'Monthly Cost ($)', 'Share (%)'].map(q);
    const rows = result.breakdown.map((item) => [
      q(item.category),
      q(item.label),
      item.amount.toFixed(2),
      item.percentage.toFixed(1),
    ]);
    rows.push([q('TOTAL'), q(''), result.totalMonthlyCost.toFixed(2), '100.0']);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'genai-cost-simulation.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const handleCopySummary = useCallback(() => {
    if (!result) return;
    const pricing = getPricing();
    const modelName = pricing.models[values.modelId]?.name ?? values.modelId;
    const lines = [
      '═══════════════════════════════════════',
      '  GenAI Cost Simulation Summary',
      '═══════════════════════════════════════',
      '',
      `  Model:             ${modelName}`,
      `  Hosting:           ${values.hosting}`,
      `  Monthly Requests:  ${result.monthlyRequests.toLocaleString()}`,
      `  Total Tokens:      ${result.totalTokens.toLocaleString()}`,
      '',
      '  Cost Breakdown:',
      ...result.breakdown.map(
        (item) =>
          `    ${item.category.padEnd(22)} $${item.amount.toFixed(2).padStart(10)}  (${item.percentage.toFixed(1)}%)`,
      ),
      '',
      `  ─────────────────────────────────────`,
      `  Total Monthly Cost:     $${result.totalMonthlyCost.toFixed(2)}`,
      `  Cost per Request:      $${result.costPerRequest.toFixed(6)}`,
      `  Cost per 1K Requests:  $${result.costPer1kRequests.toFixed(2)}`,
      '',
      '  Top Insights:',
      ...insights
        .slice(0, 3)
        .map(
          (ins, i) =>
            `    ${i + 1}. ${ins.title} (~${ins.estimatedSavingsPct}% savings)`,
        ),
      '═══════════════════════════════════════',
    ];
    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setSnackbar({ open: true, message: 'Summary copied to clipboard' });
    }).catch(() => {
      // Fallback for HTTP or restricted contexts
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setSnackbar({ open: true, message: 'Summary copied to clipboard' });
    });
  }, [result, values, insights]);

  const handleShare = useCallback(() => {
    const shareUrl = encodeScenarioToUrl(values);
    navigator.clipboard.writeText(shareUrl).then(() => {
      setSnackbar({ open: true, message: 'Share link copied to clipboard' });
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = shareUrl;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setSnackbar({ open: true, message: 'Share link copied to clipboard' });
    });
  }, [values]);

  const handleCopyExecBrief = useCallback(() => {
    if (!result) return;
    const brief = generateExecBrief(values, result, insights);
    navigator.clipboard.writeText(brief).then(() => {
      setSnackbar({ open: true, message: 'Exec brief copied' });
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = brief;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setSnackbar({ open: true, message: 'Exec brief copied' });
    });
  }, [values, result, insights]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      {/* ── Top Bar ── */}
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: '#1a73e8', zIndex: 1201 }}>
        <Toolbar variant="dense">
          <Tooltip title="Home">
            <IconButton color="inherit" href="/" sx={{ mr: 1 }} size="small">
              <HomeIcon />
            </IconButton>
          </Tooltip>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.2 }}>
              GenAI Cost Simulator
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.85, display: { xs: 'none', sm: 'block' } }}>
              Enterprise planning tool for LLM-powered applications
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            color="inherit"
            size="small"
            startIcon={<InfoOutlinedIcon />}
            onClick={() => setDrawerOpen(true)}
          >
            Assumptions
          </Button>
        </Toolbar>
      </AppBar>

      {/* ── Action Bar ── */}
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 1.5,
          bgcolor: 'white',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <FormControl size="small" sx={{ minWidth: 280 }}>
          <InputLabel>Load Preset</InputLabel>
          <Select
            label="Load Preset"
            value=""
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            {presets.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {p.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {p.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Tooltip title="Run demo with Enterprise Burst preset">
          <Button
            size="small"
            variant="outlined"
            color="primary"
            startIcon={<PlayArrowIcon />}
            onClick={handleDemo}
          >
            Demo
          </Button>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        <Tooltip title="Save current scenario">
          <Button size="small" startIcon={<SaveOutlinedIcon />} onClick={handleSave}>
            Save
          </Button>
        </Tooltip>
        <Tooltip title="Compare scenarios">
          <Button
            size="small"
            startIcon={<CompareArrowsIcon />}
            onClick={() => setCompareMode(!compareMode)}
            variant={compareMode ? 'contained' : 'text'}
          >
            Compare
          </Button>
        </Tooltip>
        <Tooltip title="Reset to defaults">
          <IconButton size="small" onClick={() => methods.reset(DEFAULT_VALUES)}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        <Tooltip title="Export as CSV">
          <Button
            size="small"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={handleExportCsv}
          >
            CSV
          </Button>
        </Tooltip>
        <Tooltip title="Copy formatted summary">
          <Button
            size="small"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopySummary}
          >
            Summary
          </Button>
        </Tooltip>
        <Tooltip title="Copy exec brief for email">
          <Button
            size="small"
            startIcon={<DescriptionOutlinedIcon />}
            onClick={handleCopyExecBrief}
          >
            Exec Brief
          </Button>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        <Tooltip title="Copy shareable link for this scenario">
          <Button
            size="small"
            startIcon={<ShareIcon />}
            onClick={handleShare}
          >
            Share
          </Button>
        </Tooltip>
      </Box>

      {/* ── Main Content ── */}
      <Box
        sx={{
          flex: 1,
          p: { xs: 2, md: 3 },
          display: 'flex',
          gap: 3,
          flexDirection: { xs: 'column', lg: 'row' },
          alignItems: 'flex-start',
        }}
      >
        <Box sx={{ width: { xs: '100%', lg: '36%' }, flexShrink: 0 }}>
          <FormProvider {...methods}>
            <InputPanel />
          </FormProvider>
        </Box>
        <Box
          ref={resultsRef}
          sx={{
            flex: 1,
            width: { xs: '100%', lg: 'auto' },
            position: { lg: 'sticky' },
            top: { lg: 100 },
            maxHeight: { lg: 'calc(100vh - 120px)' },
            overflowY: { lg: 'auto' },
          }}
        >
          <ResultsPanel
            input={values}
            result={result}
            insights={insights}
            topLever={topLever}
            modelComparison={modelComparison}
            architecture={architecture}
            sensitivity={sensitivity}
            warnings={warnings}
            workloadClass={workloadClass}
            compareScenario={compareScenario}
            compareMode={compareMode}
            onLoadCompare={(s) => setCompareScenario(s)}
            onAutoOptimize={handleAutoOptimize}
          />
        </Box>
      </Box>

      {/* ── Drawer ── */}
      <AssumptionsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        result={result}
      />

      {/* ── Save Dialog ── */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Save Scenario</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Scenario name"
            value={saveDialogName}
            onChange={(e) => setSaveDialogName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveConfirm(); }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveConfirm} disabled={!saveDialogName.trim()}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
