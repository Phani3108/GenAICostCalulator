'use client';

import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { SimulationOutput } from '@/lib/cost/schema';
import { getPricing } from '@/lib/cost/pricing';

interface Props {
  open: boolean;
  onClose: () => void;
  result: SimulationOutput | null;
}

export default function AssumptionsDrawer({ open, onClose, result }: Props) {
  const pricing = getPricing();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 440 } } }}
    >
      <Box sx={{ p: 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography variant="h6">Assumptions & Formulas</Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Typography variant="subtitle2" color="primary" gutterBottom>
          Pricing Configuration
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Chip label={`v${pricing.meta.version}`} size="small" variant="outlined" />
          <Chip label={`Updated ${pricing.meta.updatedAt}`} size="small" variant="outlined" />
          <Chip label="mock-default" size="small" color="warning" variant="outlined" />
        </Box>
        <Typography variant="body2" color="text.secondary" paragraph>
          {pricing.meta.source}. {pricing.meta.note}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" color="primary" gutterBottom>
          6-Layer Cost Model
        </Typography>
        <List dense disablePadding>
          {[
            ['1. Model Inference', '(Input Tokens \u00f7 1K \u00d7 Price) + (Output Tokens \u00f7 1K \u00d7 Price)'],
            ['2. Embedding Indexing', 'Document embeddings amortised over 12 months'],
            ['3. Vector Retrieval', 'Query embeddings + Vector storage + Vector DB queries'],
            ['4. Infrastructure', 'Inference \u00d7 Hosting overhead % \u00d7 Traffic multiplier'],
            ['5. Networking', '3% of subtotal (inference + embed + vector + infra)'],
            ['6. Observability', '2% of subtotal (logging, monitoring, tracing)'],
          ].map(([title, formula]) => (
            <ListItem key={title} disableGutters>
              <ListItemText primary={title} secondary={formula} />
            </ListItem>
          ))}
        </List>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" color="primary" gutterBottom>
          Key Assumptions
        </Typography>
        <List dense disablePadding>
          {[
            'Effective requests = Monthly requests \u00d7 (1 \u2212 Cache hit rate)',
            'Cloud Run overhead: 15% of inference (steady), \u00d71.3 burst multiplier',
            'GKE overhead: 22% of inference (steady), \u00d71.1 burst multiplier',
            'Vector dimensions configurable (default 768 float32, ~3 KB/vector)',
            'Document indexing cost amortised over 12 months',
            'Networking: 3% of pre-networking subtotal',
            'Observability: 2% of pre-networking subtotal',
            'Model comparison uses same workload across all available models',
            'Growth projection uses compound monthly growth',
            'Token budget industry typical ratio: 0.35',
          ].map((text) => (
            <ListItem key={text} disableGutters>
              <ListItemText
                secondary={text}
                secondaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItem>
          ))}
        </List>

        {result && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Calculation Steps (Current)
            </Typography>
            <List dense disablePadding>
              {result.explanation.map((step, i) => (
                <ListItem key={i} disableGutters>
                  <ListItemText
                    secondary={step}
                    secondaryTypographyProps={{
                      variant: 'caption',
                      sx: { fontFamily: 'monospace', whiteSpace: 'pre-wrap' },
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" color="primary" gutterBottom>
          Limitations
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This simulator provides estimates based on published pricing and
          simplified models. Actual costs vary by committed-use discounts,
          regional pricing, negotiated rates, and real usage patterns. Always
          verify with your provider&apos;s official pricing calculator.
        </Typography>
      </Box>
    </Drawer>
  );
}
