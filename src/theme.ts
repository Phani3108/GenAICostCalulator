'use client';
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: '#1a73e8', light: '#4285f4', dark: '#1557b0' },
    secondary: { main: '#5f6368' },
    background: { default: '#f8f9fa', paper: '#ffffff' },
    text: { primary: '#202124', secondary: '#5f6368' },
    success: { main: '#34a853' },
    warning: { main: '#fbbc04' },
    error: { main: '#ea4335' },
    info: { main: '#4285f4' },
  },
  typography: {
    fontFamily: '"Google Sans", "Roboto", "Helvetica Neue", Arial, sans-serif',
    h3: { fontWeight: 700 },
    h4: { fontWeight: 600, fontSize: '1.5rem' },
    h5: { fontWeight: 600, fontSize: '1.25rem' },
    h6: { fontWeight: 600, fontSize: '1.1rem' },
    subtitle1: { fontWeight: 600 },
    body2: { color: '#5f6368' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow:
            '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
          borderRadius: 8,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none' as const, fontWeight: 500 },
      },
    },
  },
});

export default theme;
