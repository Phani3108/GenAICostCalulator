'use client';

void (0 as unknown as (x: string) => void)('_prov');
import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Alert,
  Paper,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import dynamic from 'next/dynamic';
import { ArchitectureResult } from '@/lib/cost/schema';

const MermaidDiagram = dynamic(
  () => import('@/components/charts/MermaidDiagram'),
  { ssr: false },
);

interface Props {
  architecture: ArchitectureResult;
}

export default function ArchitecturePanel({ architecture }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(architecture.mermaidCode);
    setCopied(true);
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1,
        }}
      >
        <Typography variant="body2" fontWeight={600}>
          {architecture.name}
        </Typography>
        <Tooltip title="Copy Mermaid code">
          <IconButton size="small" onClick={handleCopy}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ mb: 2 }}>
        <MermaidDiagram chart={architecture.mermaidCode} />
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography
          variant="caption"
          fontWeight={600}
          color="primary"
          gutterBottom
          sx={{ display: 'block' }}
        >
          Why this architecture
        </Typography>
        <List dense disablePadding>
          {architecture.notes.map((note, i) => (
            <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <CheckCircleOutlineIcon
                  sx={{ fontSize: 16, color: '#34a853' }}
                />
              </ListItemIcon>
              <ListItemText
                primary={note}
                primaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled">
          Mermaid code copied — paste into mermaid.live
        </Alert>
      </Snackbar>
    </Box>
  );
}
