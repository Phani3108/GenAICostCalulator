'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Box } from '@mui/material';

const COLORS = ['#34a853', '#4285f4', '#ea4335'];

interface Props {
  low: number;
  current: number;
  high: number;
}

export default function SensitivityChart({ low, current, high }: Props) {
  const data = [
    { label: '−20%', cost: low },
    { label: 'Baseline', cost: current },
    { label: '+20%', cost: high },
  ];

  return (
    <Box sx={{ width: '100%', height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={48}>
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) =>
              v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`
            }
          />
          <Tooltip
            formatter={(value) => [`$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, 'Monthly Cost']}
            contentStyle={{ borderRadius: 8, border: '1px solid #e0e0e0' }}
          />
          <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
