'use client';

void ((_dmca_hash: string) => undefined)('p.m');
import { useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  FormControlLabel,
  Switch,
  Slider,
  Box,
  Tooltip,
  InputAdornment,
  Collapse,
  Button,
  IconButton,
} from '@mui/material';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import TokenIcon from '@mui/icons-material/DataObject';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { SimulationInput, SimulatorMode, AgentEconomicsInput, ChainStep } from '@/lib/cost/schema';
import {
  getModelOptions,
  getEmbeddingOptions,
  getVectorDbOptions,
} from '@/lib/cost/pricing';
import { getPlatformOptions } from '@/lib/cost/platform-tax';

function NumberInput({
  name,
  label,
  helperText,
  icon,
  min = 0,
}: {
  name: keyof SimulationInput;
  label: string;
  helperText?: string;
  icon?: React.ReactNode;
  min?: number;
}) {
  const { control } = useFormContext<SimulationInput>();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <TextField
          label={label}
          type="number"
          fullWidth
          size="small"
          helperText={helperText}
          value={field.value}
          onChange={(e) => {
            const v = e.target.value;
            field.onChange(v === '' ? 0 : Number(v));
          }}
          slotProps={{
            input: {
              startAdornment: icon ? (
                <InputAdornment position="start">{icon}</InputAdornment>
              ) : undefined,
              inputProps: { min },
            },
          }}
        />
      )}
    />
  );
}

/* ── Agent Economics Number Input (controlled via callback, not react-hook-form) ── */

function AgentNumberInput({
  label,
  value,
  onChange,
  helperText,
  icon,
  min = 0,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  helperText?: string;
  icon?: React.ReactNode;
  min?: number;
  step?: number;
}) {
  return (
    <TextField
      label={label}
      type="number"
      fullWidth
      size="small"
      helperText={helperText}
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? 0 : Number(v));
      }}
      slotProps={{
        input: {
          startAdornment: icon ? (
            <InputAdornment position="start">{icon}</InputAdornment>
          ) : undefined,
          inputProps: { min, step },
        },
      }}
    />
  );
}

interface InputPanelProps {
  mode: SimulatorMode;
  agentValues?: AgentEconomicsInput;
  onAgentValuesChange?: (v: AgentEconomicsInput) => void;
}

export default function InputPanel({ mode, agentValues, onAgentValuesChange }: InputPanelProps) {
  if (mode === 'agent_economics' && agentValues && onAgentValuesChange) {
    return <AgentEconomicsInputPanel values={agentValues} onChange={onAgentValuesChange} />;
  }
  return <InfraCostInputPanel />;
}

/* ════════════════════════════════════════════════════════════════════════════
   Infra Cost — Original input panel (unchanged)
   ════════════════════════════════════════════════════════════════════════════ */

function InfraCostInputPanel() {
  const { control, watch } = useFormContext<SimulationInput>();
  const ragEnabled = watch('ragEnabled');
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Workload */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ color: 'primary.main', mb: 2 }}>
            Workload Configuration
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <NumberInput
              name="monthlyActiveUsers"
              label="Monthly Active Users"
              helperText="10K — 1M+"
              icon={<PeopleOutlineIcon fontSize="small" />}
              min={1}
            />
            <NumberInput
              name="requestsPerUser"
              label="Requests per User / Month"
              helperText="5, 20, 100"
              icon={<ChatBubbleOutlineIcon fontSize="small" />}
              min={1}
            />
            <NumberInput
              name="avgPromptTokens"
              label="Avg Input Tokens per Request"
              helperText="500, 1000, 2000"
              icon={<TokenIcon fontSize="small" />}
              min={1}
            />
            <NumberInput
              name="avgCompletionTokens"
              label="Avg Output Tokens per Request"
              helperText="200, 500, 1000"
              icon={<TokenIcon fontSize="small" />}
              min={1}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Model & Infra */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ color: 'primary.main', mb: 2 }}>
            Model & Infrastructure
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Controller
              name="modelId"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="LLM Model" fullWidth size="small">
                  {getModelOptions().map((opt) => (
                    <MenuItem key={opt.id} value={opt.id}>
                      {opt.name}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        {opt.provider}
                      </Typography>
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="hosting"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Hosting" fullWidth size="small" helperText="GKE has higher overhead but tighter control">
                  <MenuItem value="cloud_run">Cloud Run</MenuItem>
                  <MenuItem value="gke">GKE Autopilot</MenuItem>
                </TextField>
              )}
            />
            {ragEnabled && (
              <>
                <Controller
                  name="embeddingModelId"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} select label="Embedding Model" fullWidth size="small">
                      {getEmbeddingOptions().map((opt) => (
                        <MenuItem key={opt.id} value={opt.id}>
                          {opt.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
                <Controller
                  name="vectorDbId"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} select label="Vector Database" fullWidth size="small">
                      {getVectorDbOptions().map((opt) => (
                        <MenuItem key={opt.id} value={opt.id}>
                          {opt.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* RAG */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ color: 'primary.main', mb: 2 }}>
            RAG & Retrieval
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Controller
              name="ragEnabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={field.onChange} />}
                  label="Enable RAG Pipeline"
                />
              )}
            />
            {ragEnabled && (
              <>
                <NumberInput
                  name="documentsIndexed"
                  label="Documents Indexed"
                  helperText="Total documents in your knowledge base"
                />
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Retrieval Rate:{' '}
                    <strong>{(watch('retrievalRate') * 100).toFixed(0)}%</strong>
                  </Typography>
                  <Controller
                    name="retrievalRate"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        value={field.value}
                        onChange={(_, v) => field.onChange(v)}
                        min={0}
                        max={1}
                        step={0.05}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v: number) => `${(v * 100).toFixed(0)}%`}
                      />
                    )}
                  />
                </Box>

                <Button
                  size="small"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  sx={{ alignSelf: 'flex-start', mt: -1 }}
                >
                  Advanced RAG Settings
                </Button>
                <Collapse in={showAdvanced}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <NumberInput
                      name="avgDocTokens"
                      label="Avg Tokens per Document"
                      helperText="Default: 500"
                    />
                    <NumberInput
                      name="topK"
                      label="Top-K Results per Query"
                      helperText="Default: 5"
                      min={1}
                    />
                    <NumberInput
                      name="embeddingDimensions"
                      label="Embedding Dimensions"
                      helperText="768 (Vertex), 1536 (OpenAI)"
                      min={1}
                    />
                  </Box>
                </Collapse>
              </>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Optimisation */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ color: 'primary.main', mb: 2 }}>
            Optimisation
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Tooltip title="Percentage of requests served from cache without calling the model">
                <Typography variant="body2" gutterBottom>
                  Cache Hit Rate:{' '}
                  <strong>{(watch('cacheHitRate') * 100).toFixed(0)}%</strong>
                </Typography>
              </Tooltip>
              <Controller
                name="cacheHitRate"
                control={control}
                render={({ field }) => (
                  <Slider
                    value={field.value}
                    onChange={(_, v) => field.onChange(v)}
                    min={0}
                    max={0.9}
                    step={0.05}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v: number) => `${(v * 100).toFixed(0)}%`}
                  />
                )}
              />
            </Box>
            <Controller
              name="trafficPattern"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Traffic Pattern" fullWidth size="small" helperText="Burst adds ~30% infra overhead">
                  <MenuItem value="steady">Steady</MenuItem>
                  <MenuItem value="burst">Burst (peak hours)</MenuItem>
                </TextField>
              )}
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Agent Economics — New input panel
   ════════════════════════════════════════════════════════════════════════════ */

function AgentEconomicsInputPanel({
  values,
  onChange,
}: {
  values: AgentEconomicsInput;
  onChange: (v: AgentEconomicsInput) => void;
}) {
  const [showInfra, setShowInfra] = useState(false);
  const modelOptions = getModelOptions();
  const platforms = getPlatformOptions();

  const update = <K extends keyof AgentEconomicsInput>(key: K, val: AgentEconomicsInput[K]) => {
    onChange({ ...values, [key]: val });
  };

  const updateChainStep = (index: number, field: keyof ChainStep, val: string | number) => {
    const chain = [...values.chain];
    chain[index] = { ...chain[index], [field]: val };
    onChange({ ...values, chain });
  };

  const addChainStep = () => {
    if (values.chain.length >= 8) return;
    const newStep: ChainStep = {
      name: `Step ${values.chain.length + 1}`,
      modelId: 'claude_haiku_45',
      avgInputTokens: 500,
      avgOutputTokens: 200,
      callsPerTask: 1,
    };
    onChange({ ...values, chain: [...values.chain, newStep] });
  };

  const removeChainStep = (index: number) => {
    if (values.chain.length <= 1) return;
    onChange({ ...values, chain: values.chain.filter((_, i) => i !== index) });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Business Model */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ color: '#9334e6', mb: 2 }}>
            Business Model
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              select
              label="Pricing Model"
              fullWidth
              size="small"
              value={values.pricingModel}
              onChange={(e) => update('pricingModel', e.target.value as AgentEconomicsInput['pricingModel'])}
            >
              <MenuItem value="per_seat">Per Seat ($/month)</MenuItem>
              <MenuItem value="per_action">Per Action ($)</MenuItem>
              <MenuItem value="outcome_based">Outcome-Based ($)</MenuItem>
              <MenuItem value="rev_share">Revenue Share (%)</MenuItem>
            </TextField>
            <AgentNumberInput
              label={
                values.pricingModel === 'per_seat' ? 'Price per Seat ($/mo)' :
                values.pricingModel === 'per_action' ? 'Price per Action ($)' :
                values.pricingModel === 'outcome_based' ? 'Price per Outcome ($)' :
                'Revenue Share (%)'
              }
              value={values.pricePerUnit}
              onChange={(v) => update('pricePerUnit', v)}
              icon={<AttachMoneyIcon fontSize="small" />}
              step={values.pricingModel === 'per_action' ? 0.001 : 1}
            />
            <AgentNumberInput
              label="Target Gross Margin (%)"
              value={values.targetGrossMarginPct}
              onChange={(v) => update('targetGrossMarginPct', v)}
              helperText="Industry target: 60-80%"
            />
            <AgentNumberInput
              label="Monthly Fixed Costs ($)"
              value={values.monthlyFixedCosts}
              onChange={(v) => update('monthlyFixedCosts', v)}
              helperText="Eng salaries, infra fixed, support — for break-even calc"
              icon={<AttachMoneyIcon fontSize="small" />}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Customers */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ color: '#9334e6', mb: 2 }}>
            Customers
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <AgentNumberInput
              label="Customer Count"
              value={values.customerCount}
              onChange={(v) => update('customerCount', v)}
              icon={<PeopleOutlineIcon fontSize="small" />}
              min={1}
            />
            <AgentNumberInput
              label="Tasks per Customer / Month"
              value={values.tasksPerCustomer}
              onChange={(v) => update('tasksPerCustomer', v)}
              helperText="Agent invocations per customer per month"
              min={1}
            />
            <Box>
              <Typography variant="body2" gutterBottom>
                Monthly Churn Rate:{' '}
                <strong>{values.churnRatePct.toFixed(1)}%</strong>
              </Typography>
              <Slider
                value={values.churnRatePct}
                onChange={(_, v) => update('churnRatePct', v as number)}
                min={0}
                max={30}
                step={0.5}
                valueLabelDisplay="auto"
                valueLabelFormat={(v: number) => `${v}%`}
              />
            </Box>
            <AgentNumberInput
              label="Customer Acquisition Cost ($)"
              value={values.customerAcquisitionCost}
              onChange={(v) => update('customerAcquisitionCost', v)}
              helperText="For payback period calculation"
              icon={<AttachMoneyIcon fontSize="small" />}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Platform */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ color: '#9334e6', mb: 2 }}>
            <StorefrontIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
            Distribution Platform
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              select
              label="Platform"
              fullWidth
              size="small"
              value={values.platformId}
              onChange={(e) => {
                const plat = platforms.find((p) => p.id === e.target.value);
                onChange({
                  ...values,
                  platformId: e.target.value,
                  platformTaxPct: plat?.taxPct ?? 0,
                });
              }}
            >
              {platforms.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {p.taxPct > 0 ? `${p.taxPct}%` : 'Free'}
                  </Typography>
                </MenuItem>
              ))}
            </TextField>
            <Box>
              <Typography variant="body2" gutterBottom>
                Platform Tax:{' '}
                <strong>{values.platformTaxPct}%</strong>
              </Typography>
              <Slider
                value={values.platformTaxPct}
                onChange={(_, v) => update('platformTaxPct', v as number)}
                min={0}
                max={50}
                step={1}
                valueLabelDisplay="auto"
                valueLabelFormat={(v: number) => `${v}%`}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Agent Task Chain */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ color: '#9334e6' }}>
              Agent Task Chain
            </Typography>
            <Tooltip title="Add step (max 8)">
              <span>
                <IconButton
                  size="small"
                  onClick={addChainStep}
                  disabled={values.chain.length >= 8}
                  color="primary"
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {values.chain.map((step, i) => (
              <Card key={i} variant="outlined" sx={{ bgcolor: '#fafafa' }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" fontWeight={600} color="primary">
                      Step {i + 1}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => removeChainStep(i)}
                      disabled={values.chain.length <= 1}
                      sx={{ color: '#ea4335' }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField
                      label="Step Name"
                      size="small"
                      fullWidth
                      value={step.name}
                      onChange={(e) => updateChainStep(i, 'name', e.target.value)}
                    />
                    <TextField
                      select
                      label="Model"
                      size="small"
                      fullWidth
                      value={step.modelId}
                      onChange={(e) => updateChainStep(i, 'modelId', e.target.value)}
                    >
                      {modelOptions.map((opt) => (
                        <MenuItem key={opt.id} value={opt.id}>
                          {opt.name}
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            {opt.provider}
                          </Typography>
                        </MenuItem>
                      ))}
                    </TextField>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        label="Input Tokens"
                        type="number"
                        size="small"
                        fullWidth
                        value={step.avgInputTokens}
                        onChange={(e) => updateChainStep(i, 'avgInputTokens', Number(e.target.value) || 1)}
                        slotProps={{ input: { inputProps: { min: 1 } } }}
                      />
                      <TextField
                        label="Output Tokens"
                        type="number"
                        size="small"
                        fullWidth
                        value={step.avgOutputTokens}
                        onChange={(e) => updateChainStep(i, 'avgOutputTokens', Number(e.target.value) || 1)}
                        slotProps={{ input: { inputProps: { min: 1 } } }}
                      />
                    </Box>
                    <TextField
                      label="Calls per Task"
                      type="number"
                      size="small"
                      fullWidth
                      value={step.callsPerTask}
                      onChange={(e) => updateChainStep(i, 'callsPerTask', Number(e.target.value) || 1)}
                      helperText="How many times this step runs per task"
                      slotProps={{ input: { inputProps: { min: 1, max: 100 } } }}
                    />
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {values.chain.map((s) => s.name).join(' → ')}
          </Typography>
        </CardContent>
      </Card>

      {/* Cache + Traffic */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ color: '#9334e6', mb: 2 }}>
            Optimisation
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="body2" gutterBottom>
                Cache Hit Rate:{' '}
                <strong>{(values.cacheHitRate * 100).toFixed(0)}%</strong>
              </Typography>
              <Slider
                value={values.cacheHitRate}
                onChange={(_, v) => update('cacheHitRate', v as number)}
                min={0}
                max={0.9}
                step={0.05}
                valueLabelDisplay="auto"
                valueLabelFormat={(v: number) => `${(v * 100).toFixed(0)}%`}
              />
            </Box>
            <TextField
              select
              label="Traffic Pattern"
              fullWidth
              size="small"
              value={values.trafficPattern}
              onChange={(e) => update('trafficPattern', e.target.value as 'steady' | 'burst')}
              helperText="Burst adds ~30% infra overhead"
            >
              <MenuItem value="steady">Steady</MenuItem>
              <MenuItem value="burst">Burst (peak hours)</MenuItem>
            </TextField>
          </Box>
        </CardContent>
      </Card>

      {/* Advanced: Infrastructure */}
      <Card>
        <CardContent>
          <Button
            size="small"
            onClick={() => setShowInfra(!showInfra)}
            endIcon={showInfra ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ mb: showInfra ? 2 : 0 }}
          >
            Advanced: Infrastructure & RAG
          </Button>
          <Collapse in={showInfra}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                select
                label="Hosting"
                fullWidth
                size="small"
                value={values.hosting}
                onChange={(e) => update('hosting', e.target.value as 'cloud_run' | 'gke')}
              >
                <MenuItem value="cloud_run">Cloud Run</MenuItem>
                <MenuItem value="gke">GKE Autopilot</MenuItem>
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={values.ragEnabled}
                    onChange={(e) => update('ragEnabled', e.target.checked)}
                  />
                }
                label="Enable RAG Pipeline"
              />
              {values.ragEnabled && (
                <>
                  <TextField
                    select
                    label="Embedding Model"
                    fullWidth
                    size="small"
                    value={values.embeddingModelId}
                    onChange={(e) => update('embeddingModelId', e.target.value)}
                  >
                    {getEmbeddingOptions().map((opt) => (
                      <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label="Vector Database"
                    fullWidth
                    size="small"
                    value={values.vectorDbId}
                    onChange={(e) => update('vectorDbId', e.target.value)}
                  >
                    {getVectorDbOptions().map((opt) => (
                      <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
                    ))}
                  </TextField>
                  <AgentNumberInput
                    label="Documents Indexed"
                    value={values.documentsIndexed}
                    onChange={(v) => update('documentsIndexed', v)}
                  />
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Retrieval Rate: <strong>{(values.retrievalRate * 100).toFixed(0)}%</strong>
                    </Typography>
                    <Slider
                      value={values.retrievalRate}
                      onChange={(_, v) => update('retrievalRate', v as number)}
                      min={0} max={1} step={0.05}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v: number) => `${(v * 100).toFixed(0)}%`}
                    />
                  </Box>
                </>
              )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    </Box>
  );
}
