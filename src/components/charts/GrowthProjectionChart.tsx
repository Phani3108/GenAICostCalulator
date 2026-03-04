'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { GrowthProjectionPoint } from '@/lib/cost/schema';

interface Props {
  data: GrowthProjectionPoint[];
}

export default function GrowthProjectionChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260} minWidth={1} minHeight={1}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis
          tickFormatter={(v: number) =>
            v >= 1_000_000
              ? `$${(v / 1_000_000).toFixed(1)}M`
              : v >= 1000
                ? `$${(v / 1000).toFixed(0)}K`
                : `$${v}`
          }
          tick={{ fontSize: 11 }}
          width={65}
        />
        <Tooltip
          formatter={(value) => [
            `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            'Monthly Cost',
          ]}
          labelFormatter={(label) => `Month ${String(label).replace('M', '')}`}
        />
        <Line
          type="monotone"
          dataKey="monthlyCost"
          stroke="#1a73e8"
          strokeWidth={2}
          dot={{ r: 3, fill: '#1a73e8' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
