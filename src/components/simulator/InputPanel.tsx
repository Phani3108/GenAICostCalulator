'use client';

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
} from '@mui/material';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import TokenIcon from '@mui/icons-material/DataObject';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { SimulationInput } from '@/lib/cost/schema';
import {
  getModelOptions,
  getEmbeddingOptions,
  getVectorDbOptions,
} from '@/lib/cost/pricing';

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

export default function InputPanel() {
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
