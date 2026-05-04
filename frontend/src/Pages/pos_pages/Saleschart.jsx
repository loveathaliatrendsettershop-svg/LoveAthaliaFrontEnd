import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getWeekOfMonth(date) {
  const day = new Date(date).getDate();
  if (day <= 7)  return 'Week 1';
  if (day <= 14) return 'Week 2';
  if (day <= 21) return 'Week 3';
  return 'Week 4';
}

function getQuarter(date) {
  const m = new Date(date).getMonth();
  if (m <= 2) return 'Q1';
  if (m <= 5) return 'Q2';
  if (m <= 8) return 'Q3';
  return 'Q4';
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length || !label) return null;
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #FED700',
      borderRadius: 8,
      padding: '8px 14px',
      fontFamily: 'Inter, sans-serif',
      fontSize: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <p style={{ fontWeight: 700, marginBottom: 2, color: '#000' }}>{label}</p>
      <p style={{ color: '#8B333D', fontWeight: 600 }}>
        ₱ {Number(payload[0].value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
};

export default function SalesChart({ period, dateRange, orders = [], productMap = {}, categories = [] }) {

  // ── For Monthly: figure out which month to show ──────────────────────────
  // If a dateRange is set, use the month of dateRange.from, otherwise use current month
  const targetMonth = useMemo(() => {
    if (period !== 'Monthly') return null;
    if (dateRange?.from) return new Date(dateRange.from);
    return new Date(); // current month
  }, [period, dateRange]);

  const data = useMemo(() => {
    const revenueMap = {};

    for (const order of orders) {
      if (order.status?.toLowerCase() !== 'completed') continue;

      const d = new Date(order.updatedAt || order.createdAt);

      if (period === 'Monthly') {
        // ── Only count orders from the exact target month + year ──
        if (
          d.getMonth()     !== targetMonth.getMonth() ||
          d.getFullYear()  !== targetMonth.getFullYear()
        ) continue;
      } else {
        // ── Quarterly / Yearly: apply manual date range only if set ──
        if (dateRange?.from && d < new Date(new Date(dateRange.from).setHours(0,0,0,0))) continue;
        if (dateRange?.to   && d > new Date(new Date(dateRange.to).setHours(23,59,59,999))) continue;
      }

      let label;
      if (period === 'Monthly')   label = getWeekOfMonth(d);
      if (period === 'Quarterly') label = getQuarter(d);
      if (period === 'Yearly')    label = MONTHS_SHORT[d.getMonth()];

      if (!label) continue;
      if (!revenueMap[label]) revenueMap[label] = 0;

      for (const item of (order.products || [])) {
        revenueMap[label] += (item.price || 0) * (item.quantity || 0);
      }
    }

    let labels = [];
    if (period === 'Monthly')   labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    if (period === 'Quarterly') labels = ['Q1', 'Q2', 'Q3', 'Q4'];
    if (period === 'Yearly')    labels = MONTHS_SHORT;

    return labels.map(label => ({
      label,
      value: revenueMap[label] || 0,
    }));
  }, [orders, period, dateRange, targetMonth]);

  // ── Month label shown above chart (Monthly mode only) ────────────────────
  const monthLabel = period === 'Monthly' && targetMonth
    ? `${MONTHS_FULL[targetMonth.getMonth()]} ${targetMonth.getFullYear()}`
    : null;

  return (
    <div style={{ width:'100%' }}>
      {monthLabel && (
        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(0,0,0,0.45)',
          textAlign: 'right',
          marginBottom: 4,
          paddingRight: 10,
        }}>
          {monthLabel}
        </p>
      )}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#FFF28D" stopOpacity={0.49} />
              <stop offset="100%" stopColor="#FFFFFF"  stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontFamily: 'Inter', fontSize: 13, fill: 'rgba(0,0,0,0.6)', fontWeight: 500 }}
            axisLine={{ stroke: 'rgba(0,0,0,0.4)' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
            tick={{ fontFamily: 'Inter', fontSize: 11, fill: 'rgba(0,0,0,0.5)' }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#FED700"
            strokeWidth={2}
            fill="url(#salesGradient)"
            dot={false}
            activeDot={{ r: 5, fill: '#FED700', stroke: '#8B333D', strokeWidth: 2 }}
            animationDuration={700}
            animationEasing="ease-in-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}