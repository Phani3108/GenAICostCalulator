'use client';
import {
  Box,
  Typography,
  Button,
  Container,
  Card,
  CardContent,
  AppBar,
  Toolbar,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import TimelineIcon from '@mui/icons-material/Timeline';

export default function Home() {
  const router = useRouter();

  const features = [
    {
      icon: <CalculateOutlinedIcon sx={{ fontSize: 40, color: '#4285f4' }} />,
      title: '6-Layer Cost Estimation',
      desc: 'Model inference, embeddings, vector DB, infrastructure, networking, and observability — all in one view.',
    },
    {
      icon: <InsightsOutlinedIcon sx={{ fontSize: 40, color: '#34a853' }} />,
      title: 'Smart Optimisation Insights',
      desc: 'Actionable recommendations with estimated savings. Token budget analysis and enterprise guardrails.',
    },
    {
      icon: <CompareArrowsIcon sx={{ fontSize: 40, color: '#fbbc04' }} />,
      title: 'Model Comparison',
      desc: 'Rank models by cost, quality, or balanced score. Compare Gemini, GPT-4o, Claude, and Llama side-by-side.',
    },
    {
      icon: <AccountTreeOutlinedIcon sx={{ fontSize: 40, color: '#9334e6' }} />,
      title: 'Architecture Diagrams',
      desc: 'Auto-generated GCP architecture with cost overlay. Mermaid diagrams you can copy and embed anywhere.',
    },
    {
      icon: <TimelineIcon sx={{ fontSize: 40, color: '#ea4335' }} />,
      title: 'Growth Projection',
      desc: '12-month cost projection with configurable MAU growth rate. Sensitivity analysis for token variance.',
    },
    {
      icon: <FileDownloadOutlinedIcon sx={{ fontSize: 40, color: '#1a73e8' }} />,
      title: 'Export & Exec Brief',
      desc: 'CSV breakdown, formatted summary, and exec brief. Everything you need for stakeholder conversations.',
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8f9fa' }}>
      <AppBar position="static" elevation={0} sx={{ bgcolor: '#1a73e8' }}>
        <Toolbar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.2 }}>
              GenAI Cost Simulator
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              Enterprise planning tool for LLM-powered applications
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            color="inherit"
            variant="outlined"
            onClick={() => router.push('/simulator')}
            sx={{ borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: '#fff' } }}
          >
            Open Simulator
          </Button>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          background: 'linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)',
          color: 'white',
          py: { xs: 8, md: 12 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Typography
            variant="h3"
            fontWeight={700}
            gutterBottom
            sx={{ fontSize: { xs: '2rem', md: '3rem' } }}
          >
            Estimate infrastructure, model, and retrieval costs before deploying AI systems
          </Typography>
          <Typography
            variant="h6"
            sx={{
              opacity: 0.9,
              mb: 4,
              fontWeight: 400,
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            Compare models, optimise spend, and make informed infrastructure
            decisions — before you write a single line of code.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => router.push('/simulator')}
            sx={{
              bgcolor: 'white',
              color: '#1a73e8',
              px: 5,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 600,
              '&:hover': { bgcolor: '#e8f0fe' },
            }}
          >
            Launch Simulator
          </Button>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Typography
          variant="h4"
          textAlign="center"
          gutterBottom
          sx={{ mb: 5, fontWeight: 700 }}
        >
          Everything you need to plan GenAI costs
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: '1fr 1fr 1fr',
            },
            gap: 3,
          }}
        >
          {features.map((f, i) => (
            <Card
              key={i}
              sx={{
                textAlign: 'center',
                transition: 'box-shadow 0.2s',
                '&:hover': { boxShadow: 6 },
              }}
            >
              <CardContent sx={{ py: 4 }}>
                {f.icon}
                <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                  {f.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {f.desc}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>

      <Box sx={{ textAlign: 'center', py: 4, color: '#5f6368' }}>
        <Typography variant="body2">
          Pricing data is sample/default. Update from official sources for production estimates.
        </Typography>
      </Box>
    </Box>
  );
}
