import type { Metadata } from 'next';
import ThemeRegistry from '@/components/ThemeRegistry';
import './globals.css';

export const metadata: Metadata = {
  title: 'GenAI Cost Simulator',
  description: 'Estimate real-world costs of deploying LLM applications',
  authors: [{ name: 'Phani Marupaka', url: 'https://linkedin.com/in/phani-marupaka' }],
  creator: 'Phani Marupaka',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
        <footer
          style={{
            textAlign: 'center',
            padding: '12px 16px',
            fontSize: '12px',
            color: '#5f6368',
          }}
        >
          Created & developed by{' '}
          <a
            href="https://linkedin.com/in/phani-marupaka"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#5f6368', textDecoration: 'underline' }}
          >
            Phani Marupaka
          </a>
          {' · '}© 2026 Phani Marupaka. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
