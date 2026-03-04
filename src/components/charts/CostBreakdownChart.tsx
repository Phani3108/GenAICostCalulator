'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CostLineItem } from '@/lib/cost/schema';
import { Box, useTheme, useMediaQuery } from '@mui/material';

const CATEGORY_COLORS: Record<string, string> = {
  'Model Inference': '#4285f4',
  'Embedding Indexing': '#34a853',
  'Vector Retrieval': '#0d652d',
  Infrastructure: '#ea4335',
  Networking: '#9334e6',
  Observability: '#ff6d01',
};

interface Props {
  breakdown: CostLineItem[];
}

export default function CostBreakdownChart({ breakdown }: Props) {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  const data = breakdown
    .filter((item) => item.amount > 0)
    .map((item) => ({
      name: item.category,
      value: parseFloat(item.amount.toFixed(2)),
    }));

  return (
    <Box sx={{ width: '100%', height: isSmall ? 260 : 320, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={isSmall ? 45 : 65}
            outerRadius={isSmall ? 80 : 110}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CATEGORY_COLORS[entry.name] || '#999'}
                stroke="none"
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Cost']}
            contentStyle={{ borderRadius: 8, border: '1px solid #e0e0e0' }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={10}
            wrapperStyle={{ fontSize: 13 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
}

export { CATEGORY_COLORS };
