import React, { useState, useRef, useEffect, useMemo } from 'react';
import Topbar from '../../Components/notif/Topbar';
import SalesChart from './Saleschart';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import './Reports.css';

const API = `${import.meta.env.VITE_API_URL}/api`;

const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtCurrency(n) {
  return '₱ ' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

function getWeekOfMonth(date) {
  const day = new Date(date).getDate();
  if (day <= 7)  return 'Week 1';
  if (day <= 14) return 'Week 2';
  if (day <= 21) return 'Week 3';
  return 'Week 4';
}

function getQuarter(date) {
  const m = new Date(date).getMonth();
  if (m <= 2) return 'Q1 ( Jan - Mar )';
  if (m <= 5) return 'Q2 ( Apr - Jun )';
  if (m <= 8) return 'Q3 ( Jul - Sep )';
  return 'Q4 ( Oct - Dec )';
}

// ─── Build Sales Trend ────────────────────────────────────────────────────────
function buildSalesTrend(orders, productMap, categories, period) {
  const catNames  = categories.map(c => c.name);
  const periodMap = {};
  const now       = new Date();

  for (const order of orders) {
    if (order.status?.toLowerCase() !== 'completed') continue;

    const d = new Date(order.updatedAt || order.createdAt);

    if (period === 'Monthly') {
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) continue;
    }
    if (period === 'Quarterly' || period === 'Yearly') {
      if (d.getFullYear() !== now.getFullYear()) continue;
    }

    let label;
    if (period === 'Monthly')   label = getWeekOfMonth(d);
    if (period === 'Quarterly') label = getQuarter(d);
    if (period === 'Yearly')    label = MONTHS_FULL[d.getMonth()];

    if (!periodMap[label]) {
      periodMap[label] = { period: label, revenue: 0 };
      catNames.forEach(c => { periodMap[label][c] = 0; });
    }

    for (const item of (order.products || [])) {
      const cat = productMap[item.product?.toString()]?.category || 'Other';
      const qty = item.quantity || 0;
      if (periodMap[label][cat] !== undefined) periodMap[label][cat] += qty;
      periodMap[label].revenue += (item.price || 0) * qty;
    }
  }

  let labels = [];
  if (period === 'Monthly')   labels = ['Week 1','Week 2','Week 3','Week 4'];
  if (period === 'Quarterly') labels = ['Q1 ( Jan - Mar )','Q2 ( Apr - Jun )','Q3 ( Jul - Sep )','Q4 ( Oct - Dec )'];
  if (period === 'Yearly')    labels = MONTHS_FULL;

  const rows = labels.filter(l => periodMap[l]).map(l => periodMap[l]);

  if (rows.length > 0) {
    const total = { period: 'TOTAL', revenue: 0, isTotal: true };
    catNames.forEach(c => { total[c] = rows.reduce((s, r) => s + (r[c] || 0), 0); });
    total.revenue = rows.reduce((s, r) => s + r.revenue, 0);
    rows.push(total);
  }

  return rows;
}

// ─── Build Return Chart ───────────────────────────────────────────────────────
function buildReturnChart(returns, period) {
  const reasonMap = {};
  const now       = new Date();

  for (const ret of returns) {
    const d = new Date(ret.updatedAt || ret.createdAt);

    // ── Same month/year lock as buildSalesTrend ──
    if (period === 'Monthly') {
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) continue;
    }
    if (period === 'Quarterly' || period === 'Yearly') {
      if (d.getFullYear() !== now.getFullYear()) continue;
    }

    let label;
    if (period === 'Monthly')   label = getWeekOfMonth(d);
    if (period === 'Quarterly') label = MONTHS_SHORT[d.getMonth()];
    if (period === 'Yearly')    label = MONTHS_SHORT[d.getMonth()];

    if (!reasonMap[label]) reasonMap[label] = { label, 'Wrong Item': 0, 'Defective': 0, 'Wrong Size': 0 };
    for (const item of (ret.returnItems || [])) {
      const r = item.reason || '';
      if (reasonMap[label][r] !== undefined) reasonMap[label][r]++;
    }
  }

  let labels = [];
  if (period === 'Monthly')   labels = ['Week 1','Week 2','Week 3','Week 4'];
  if (period === 'Quarterly') labels = MONTHS_SHORT;
  if (period === 'Yearly')    labels = MONTHS_SHORT;

  return labels.filter(l => reasonMap[l]).map(l => reasonMap[l]);
}

// ─── Build Top Selling ────────────────────────────────────────────────────────
function buildTopSelling(orders, productMap) {
  const sold = {};
  for (const order of orders) {
    if (order.status?.toLowerCase() !== 'completed') continue;
    for (const item of (order.products || [])) {
      // ✅ item.product is a populated object, so grab _id from it
      const pid = item.product?._id || item.product?.toString();
      if (!pid) continue;
      if (!sold[pid]) sold[pid] = { productId: pid, name: item.name, qty: 0, revenue: 0, img: null };
      sold[pid].qty     += item.quantity || 0;
      sold[pid].revenue += (item.price || 0) * (item.quantity || 0);

      // ✅ Since product is populated, grab images directly from item.product
      if (!sold[pid].img && item.product?.images?.[0]) {
        sold[pid].img = item.product.images[0];
      }
    }
  }
  return Object.values(sold)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

const CAT_COLORS = ['#FED700','#1500A0','#C31D7B','#419E0B','#E0522A','#7B2FBE','#0E8A8A'];

// ─── Build Category Share ─────────────────────────────────────────────────────
function buildCategoryShare(orders, productMap, categories) {
  const totals = {};
  for (const order of orders) {
    if (order.status?.toLowerCase() !== 'completed') continue;
    for (const item of (order.products || [])) {
      const cat = productMap[item.product?.toString()]?.category || 'Other';
      totals[cat] = (totals[cat] || 0) + (item.quantity || 0);
    }
  }
  const grand = Object.values(totals).reduce((s, v) => s + v, 0) || 1;
  return categories.map((c, i) => ({
    label: c.name,
    pct:   Math.round(((totals[c.name] || 0) / grand) * 100),
    color: CAT_COLORS[i % CAT_COLORS.length],
  })).filter(c => c.pct > 0);
}

// ─── Print / Download Helpers ─────────────────────────────────────────────────
const SHARED_PRINT_STYLES = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#000;padding:28px}h1{font-size:18px;font-weight:800;color:#8B333D;margin-bottom:4px}p.sub{font-size:11px;color:rgba(0,0,0,0.45);margin-bottom:16px;font-style:italic}table{width:100%;border-collapse:collapse;font-size:10px}thead tr{background:rgba(255,242,141,0.6)}th{padding:8px 10px;font-weight:700;text-align:left;border-bottom:1px solid #ddd;white-space:nowrap}td{padding:8px 10px;border-bottom:1px solid rgba(0,0,0,0.06);vertical-align:middle}tr.total-row td{background:rgba(255,242,141,0.25);font-weight:700;border-top:1.5px solid rgba(0,0,0,0.12)}tr:nth-child(even):not(.total-row) td{background:rgba(0,0,0,0.016)}.revenue{color:#226133;font-weight:700;text-align:right}.center{text-align:center}.footer{margin-top:20px;font-size:8px;color:rgba(0,0,0,0.38);text-align:center;border-top:1px solid #eee;padding-top:10px}@media print{html,body{height:auto}}`;

function openPrintWindow(html) {
  const pw = window.open('', '_blank', 'width=960,height=750');
  if (!pw) return;
  pw.document.write(html); pw.document.close();
  pw.onload = () => { pw.focus(); pw.print(); };
}

function downloadHTML(html, filename) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function generateSalesTrendHTML(period, rows, catNames) {
  const title    = `${period} Sales Trend`;
  const thCats   = catNames.map(c => `<th>${c} Units</th>`).join('');
  const bodyRows = rows.map(r =>
    `<tr class="${r.isTotal ? 'total-row' : ''}">
      <td>${r.period}</td>
      ${catNames.map(c => `<td>${(r[c] || 0).toLocaleString()}</td>`).join('')}
      <td class="revenue">${fmtCurrency(r.revenue)}</td>
    </tr>`
  ).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${title}</title><style>${SHARED_PRINT_STYLES}</style></head><body><h1>LOVE ATHALIA — ${title}</h1><p class="sub">Generated ${new Date().toLocaleDateString('en-PH')}</p><table><thead><tr><th>Period</th>${thCats}<th style="text-align:right">Total Revenue</th></tr></thead><tbody>${bodyRows}</tbody></table><div class="footer">BIR Permit No. OCN 027 AU2024000002225</div></body></html>`;
}

function generateReturnDetailHTML(rows) {
  const bodyRows = rows.map(r =>
    `<tr><td>${r._id?.slice(-8)}</td><td>${r.customer}</td><td>${new Date(r.createdAt).toLocaleDateString('en-PH')}</td><td>${r.returnItems?.map(i => i.reason).join(', ')}</td></tr>`
  ).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Returns</title><style>${SHARED_PRINT_STYLES}</style></head><body><h1>LOVE ATHALIA — Return &amp; Exchange</h1><p class="sub">Generated ${new Date().toLocaleDateString('en-PH')}</p><table><thead><tr><th>Return ID</th><th>Customer</th><th>Date</th><th>Reason(s)</th></tr></thead><tbody>${bodyRows}</tbody></table><div class="footer">BIR Permit No. OCN 027 AU2024000002225</div></body></html>`;
}

function generateTopSellingHTML(rows) {
  const bodyRows = rows.map(r =>
    `<tr><td>${r.rank}</td><td>${r.name}</td><td class="center">${r.qty.toLocaleString()}</td><td class="revenue">${fmtCurrency(r.revenue)}</td></tr>`
  ).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Top Selling</title><style>${SHARED_PRINT_STYLES}</style></head><body><h1>LOVE ATHALIA — Top Selling Products</h1><p class="sub">Generated ${new Date().toLocaleDateString('en-PH')}</p><table><thead><tr><th>Rank</th><th>Product Name</th><th class="center">Units Sold</th><th style="text-align:right">Revenue</th></tr></thead><tbody>${bodyRows}</tbody></table><div class="footer">BIR Permit No. OCN 027 AU2024000002225</div></body></html>`;
}

// ─── Modal Footer ─────────────────────────────────────────────────────────────
function ModalFooter({ onDownload, onPrint }) {
  return (
    <div className="modal-footer">
      <button className="modal-act-btn modal-act-btn--download" onClick={onDownload} title="Download">
        <span className="material-icons" style={{ fontSize:18 }}>download</span>
      </button>
      <button className="modal-act-btn modal-act-btn--print" onClick={onPrint} title="Print">
        <span className="material-icons" style={{ fontSize:18, marginRight:5 }}>print</span>Print
      </button>
    </div>
  );
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────
const CAL_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function MiniCalendar({ year, month, rangeStart, rangeEnd, hovered, onSelect, onHover }) {
  const firstDay     = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const prevMonthEnd = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevMonthEnd - i, inMonth: false });
  for (let d = 1; d <= daysInMonth; d++)  cells.push({ day: d, inMonth: true });
  while (cells.length < 42) cells.push({ day: cells.length - firstDay - daysInMonth + 1, inMonth: false });
  const ts = (d) => d ? new Date(d).setHours(0,0,0,0) : null;
  function cellClass(c) {
    if (!c.inMonth) return 'mc-cell mc-cell--out';
    const t  = new Date(year, month, c.day).setHours(0,0,0,0);
    const s  = ts(rangeStart), e = ts(rangeEnd) || ts(hovered);
    const lo = s && e ? Math.min(s,e) : s, hi = s && e ? Math.max(s,e) : null;
    let cls  = 'mc-cell';
    if (s && t === s) cls += ' mc-cell--start';
    else if (e && t === ts(rangeEnd)) cls += ' mc-cell--end';
    else if (lo && hi && t > lo && t < hi) cls += ' mc-cell--range';
    return cls;
  }
  return (
    <div className="mini-cal">
      <div className="mini-cal__grid">
        {CAL_DAYS.map(d => <span key={d} className="mc-day-name">{d}</span>)}
        {cells.map((c, i) => (
          <span key={i} className={cellClass(c)}
            onClick={() => c.inMonth && onSelect(new Date(year, month, c.day))}
            onMouseEnter={() => c.inMonth && onHover(new Date(year, month, c.day))}
          >{c.day}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Date Range Picker ────────────────────────────────────────────────────────
function DateRangePicker({ value, onChange, onClose }) {
  const now = new Date();
  const [view, setView] = useState('day');
  const [yr,   setYr]   = useState(now.getFullYear());
  const [mo,   setMo]   = useState(now.getMonth());
  const [hov,  setHov]  = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  const { from, to } = value || {};
  function handleDaySelect(date) {
    if (!from || (from && to)) { onChange({ from: date, to: null }); setHov(null); }
    else { onChange(date < from ? { from: date, to: from } : { from, to: date }); }
  }
  function prevNav() {
    if (view === 'month') { setYr(y => y - 1); return; }
    if (mo === 0) { setMo(11); setYr(y => y - 1); } else setMo(m => m - 1);
  }
  function nextNav() {
    if (view === 'month') { setYr(y => y + 1); return; }
    if (mo === 11) { setMo(0); setYr(y => y + 1); } else setMo(m => m + 1);
  }
  const fmt = (d) => d ? d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' }) : '—';
  return (
    <div className={`drp${view === 'month' ? ' drp--month-view' : ''}`} ref={ref} onClick={e => e.stopPropagation()}>
      <div className="drp__nav-row">
        <button className="drp__nav-btn" onClick={prevNav}><span className="material-icons" style={{ fontSize:18 }}>chevron_left</span></button>
        {view === 'day'
          ? <button className="drp__month-year-btn" onClick={() => setView('month')}>{MONTHS_FULL[mo].slice(0,3)} {yr}</button>
          : <span className="drp__year-display">{yr}</span>}
        <button className="drp__nav-btn" onClick={nextNav}><span className="material-icons" style={{ fontSize:18 }}>chevron_right</span></button>
      </div>
      {view === 'day' && (
        <>
          <MiniCalendar year={yr} month={mo} rangeStart={from} rangeEnd={to} hovered={hov} onSelect={handleDaySelect} onHover={setHov} />
          <div className="drp__footer">
            <span className="drp__range-label">{fmt(from)} – {fmt(to)}</span>
            <button className="drp__apply" onClick={onClose}>Apply</button>
          </div>
        </>
      )}
      {view === 'month' && (
        <div className="drp__month-list">
          <div className="drp__month-col">
            {MONTHS_FULL.slice(0,6).map((m,i) => <button key={m} className={`drp__month-item${i===mo?' drp__month-item--active':''}`} onClick={() => { setMo(i); setView('day'); }}>{m}</button>)}
          </div>
          <div className="drp__month-col">
            {MONTHS_FULL.slice(6).map((m,i) => <button key={m} className={`drp__month-item${i+6===mo?' drp__month-item--active':''}`} onClick={() => { setMo(i+6); setView('day'); }}>{m}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal Date Filter ────────────────────────────────────────────────────────
function ModalDateFilter({ dateRange, setDateRange, showDatePicker, setShowDatePicker }) {
  function displayRange() {
    if (dateRange.from && dateRange.to) {
      const f = (d) => d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' });
      return `${f(dateRange.from)} – ${f(dateRange.to)}`;
    }
    return 'From – To';
  }
  return (
    <div className="modal-date-filter-outer">
      <button className={`txn-date-btn${dateRange.from ? ' txn-date-btn--active' : ''}`} onClick={() => setShowDatePicker(v => !v)}>
        <span className="material-icons" style={{ fontSize:16, color:'#1C1B1F', flexShrink:0 }}>filter_list</span>
        <span className="txn-date-btn__label">Date:</span>
        <span className="txn-date-btn__range">{displayRange()}</span>
        {dateRange.from && (
          <button className="chart-date-btn__clear" onClick={e => { e.stopPropagation(); setDateRange({ from:null, to:null }); setShowDatePicker(false); }} title="Clear">
            <span className="material-icons" style={{ fontSize:13 }}>close</span>
          </button>
        )}
      </button>
      {showDatePicker && <DateRangePicker value={dateRange} onChange={setDateRange} onClose={() => setShowDatePicker(false)} />}
    </div>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart({ data, onSliceClick }) {
  const size = 195, cx = size/2, cy = size/2, r = 80, inn = 48;
  const slices = data.reduce((acc, d) => {
    const start = acc.length === 0 ? 0 : acc[acc.length-1].end;
    acc.push({ ...d, start, end: start + d.pct });
    return acc;
  }, []);
  function polarToXY(pct, radius) {
    const angle = (pct/100) * 2 * Math.PI - Math.PI/2;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  }
  function slicePath(start, end, outer, inner) {
    const [x1,y1] = polarToXY(start,outer), [x2,y2] = polarToXY(end,outer);
    const [x3,y3] = polarToXY(end,inner),   [x4,y4] = polarToXY(start,inner);
    const large = end - start > 50 ? 1 : 0;
    return [`M ${x1} ${y1}`,`A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2}`,`L ${x3} ${y3}`,`A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4}`,'Z'].join(' ');
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink:0 }}>
      {slices.map(s => (
        <path key={s.label} d={slicePath(s.start, s.end, r, inn)} fill={s.color}
          style={{ cursor:'pointer', transition:'opacity 0.15s' }}
          onClick={() => onSliceClick?.(s.label)}
          onMouseEnter={e => { e.target.style.opacity = '0.8'; }}
          onMouseLeave={e => { e.target.style.opacity = '1'; }}
        />
      ))}
      <circle cx={cx} cy={cy} r={inn} fill="white" />
    </svg>
  );
}

// ─── Return Tooltip ───────────────────────────────────────────────────────────
const ReturnTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const COLORS = { 'Wrong Item':'#FFB6C8', 'Defective':'#78A5FA', 'Wrong Size':'#86EFAC' };
  return (
    <div className="rpt-tooltip">
      <p className="rpt-tooltip__label">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="rpt-tooltip__val" style={{ color: COLORS[p.dataKey] || '#666' }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Sales Trend Modal ────────────────────────────────────────────────────────
function SalesTrendModal({ period, rows, catNames, onClose, onRowClick }) {
  const now         = new Date();
  const periodLabel = period === 'Monthly'
    ? now.toLocaleString('en-PH', { month:'long', year:'numeric' })
    : String(now.getFullYear());

  const [dateRange,      setDateRange]      = useState({ from:null, to:null });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const periodTitle = `${period} Sales Trend`;
  const html = () => generateSalesTrendHTML(period, rows, catNames);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><span className="material-icons" style={{ fontSize:16 }}>close</span></button>
        <div className="modal-header">
          <div className="modal-header-row modal-header-row--between">
            <div>
              <h2 className="modal-title-text">{periodTitle}</h2>
              <p className="modal-subtitle" style={{ color:'#8B333D', fontWeight:600, marginTop:2 }}>
                Showing: {periodLabel}
              </p>
            </div>
            <ModalDateFilter dateRange={dateRange} setDateRange={setDateRange} showDatePicker={showDatePicker} setShowDatePicker={setShowDatePicker} />
          </div>
        </div>
        <div className="modal-table-wrap">
          <table className="modal-table">
            <thead>
              <tr className="modal-thead-row modal-thead-row--yellow">
                <th className="th-padl">Period</th>
                {catNames.map(c => <th key={c}>{c} Units</th>)}
                <th className="th-padr th-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0
                ? <tr><td colSpan={catNames.length + 2} style={{ textAlign:'center', padding:20, color:'rgba(0,0,0,0.35)' }}>No data found.</td></tr>
                : rows.map((row, i) => (
                  <tr key={i}
                    className={`modal-row${row.isTotal?' modal-row--total':i%2!==0?' modal-row--alt':''}${!row.isTotal?' modal-row--clickable':''}`}
                    onClick={() => !row.isTotal && onRowClick?.(row.period)}
                  >
                    <td className="th-padl td-bold">{row.period}</td>
                    {catNames.map(c => <td key={c}>{(row[c] || 0).toLocaleString()}</td>)}
                    <td className="th-padr th-right td-bold td-green">{fmtCurrency(row.revenue)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <ModalFooter onDownload={() => downloadHTML(html(), `sales-trend-${period.toLowerCase()}.html`)} onPrint={() => openPrintWindow(html())} />
      </div>
    </div>
  );
}

// ─── Category Modal ───────────────────────────────────────────────────────────
const CATEGORY_HEADER_BG = { Sleepwear:'rgba(254,215,0,0.5)', Dailywear:'rgba(21,0,160,0.13)', OOTD:'rgba(195,29,123,0.15)', Dress:'rgba(65,158,11,0.15)' };

function CategoryModal({ category, catColor, orders, productMap, onClose }) {
  const [dateRange,      setDateRange]      = useState({ from:null, to:null });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const products = useMemo(() => {
    const map = {};
    for (const order of orders) {
      if (order.status?.toLowerCase() !== 'completed') continue;
      const d = new Date(order.updatedAt || order.createdAt);
      if (dateRange.from && d < new Date(dateRange.from).setHours(0,0,0,0)) continue;
      if (dateRange.to   && d > new Date(dateRange.to).setHours(23,59,59,999)) continue;
      for (const item of (order.products || [])) {
        const pid = item.product?.toString();
        const cat = productMap[pid]?.category;
        if (cat !== category) continue;
        if (!map[pid]) map[pid] = { id:pid, name:item.name, unitsSold:0, revenue:0, img:productMap[pid]?.images?.[0]||null, wholesale:productMap[pid]?.wholesalePrice||0, unitPrice:item.price||0 };
        map[pid].unitsSold += item.quantity || 0;
        map[pid].revenue   += (item.price || 0) * (item.quantity || 0);
      }
    }
    return Object.values(map).sort((a, b) => b.unitsSold - a.unitsSold);
  }, [orders, productMap, category, dateRange]);

  const headerBg = CATEGORY_HEADER_BG[category] || 'rgba(255,242,141,0.5)';
  const color    = catColor || '#8B333D';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><span className="material-icons" style={{ fontSize:16 }}>close</span></button>
        <div className="modal-header" style={{ borderLeft:`4px solid ${color}`, paddingLeft:20 }}>
          <div className="modal-header-row modal-header-row--between">
            <div>
              <h2 className="modal-title-text">{category}</h2>
              <p className="modal-subtitle">Product inventory &amp; sales breakdown</p>
            </div>
            <ModalDateFilter dateRange={dateRange} setDateRange={setDateRange} showDatePicker={showDatePicker} setShowDatePicker={setShowDatePicker} />
          </div>
        </div>
        <div className="modal-table-wrap">
          <table className="modal-table">
            <thead>
              <tr className="modal-thead-row" style={{ background:headerBg, borderBottom:`2.5px solid ${color}` }}>
                <th className="th-padl th-rank" style={{ color }}>Rank</th>
                <th className="th-img"></th>
                <th style={{ color }}>Product Name</th>
                <th style={{ color }}>Wholesale Price</th>
                <th style={{ color }}>Unit Price</th>
                <th className="th-center" style={{ color }}>Units Sold</th>
                <th className="th-padr th-right" style={{ color }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0
                ? <tr><td colSpan={7} style={{ textAlign:'center', padding:20, color:'rgba(0,0,0,0.35)' }}>No sales data for this category.</td></tr>
                : products.map((p, i) => (
                  <tr key={p.id} className={`modal-row${i%2!==0?' modal-row--alt':''}`}>
                    <td className="th-padl td-rank" style={{ color }}>{i+1}</td>
                    <td><div className="modal-img-wrap">{p.img && <img src={p.img} alt={p.name} onError={e => { e.target.style.display='none'; }} />}</div></td>
                    <td className="td-name">{p.name}</td>
                    <td>₱ {Number(p.wholesale).toLocaleString()}</td>
                    <td>₱ {Number(p.unitPrice).toLocaleString()}</td>
                    <td className="th-center">{p.unitsSold.toLocaleString()}</td>
                    <td className="th-padr th-right td-bold td-green">{fmtCurrency(p.revenue)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <ModalFooter
          onDownload={() => downloadHTML('', `category-${category.toLowerCase()}.html`)}
          onPrint={() => openPrintWindow('')}
        />
      </div>
    </div>
  );
}

// ─── Return Modal ─────────────────────────────────────────────────────────────
const ALL_REASONS = ['All', 'Wrong Item', 'Defective', 'Wrong Size'];

function ReturnModal({ returns, filter = 'all', onClose, onRowClick }) {
  const initFilter = filter === 'all' ? 'All' : filter;
  const [reasonFilter,   setReasonFilter]   = useState(initFilter);
  const [showReasonDrop, setShowReasonDrop] = useState(false);
  const [dateRange,      setDateRange]      = useState({ from:null, to:null });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const reasonRef = useRef(null);

  useEffect(() => {
    const h = e => { if (reasonRef.current && !reasonRef.current.contains(e.target)) setShowReasonDrop(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = useMemo(() => {
    return returns.filter(r => {
      const d = new Date(r.createdAt);
      if (dateRange.from && d < new Date(dateRange.from).setHours(0,0,0,0)) return false;
      if (dateRange.to   && d > new Date(dateRange.to).setHours(23,59,59,999)) return false;
      if (reasonFilter === 'All') return true;
      return r.returnItems?.some(i => i.reason === reasonFilter);
    });
  }, [returns, reasonFilter, dateRange]);

  const stats = useMemo(() => {
    const s = { 'Wrong Item':0, 'Defective':0, 'Wrong Size':0 };
    returns.forEach(r => r.returnItems?.forEach(i => { if (s[i.reason] !== undefined) s[i.reason]++; }));
    return s;
  }, [returns]);

  const html = () => generateReturnDetailHTML(filtered);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><span className="material-icons" style={{ fontSize:16 }}>close</span></button>
        <div className="modal-header">
          <div className="modal-header-row modal-header-row--between">
            <div>
              <h2 className="modal-title-text">Return &amp; Exchange</h2>
              <p className="modal-subtitle">Click any row to view full return details</p>
            </div>
            <div className="return-header-right">
              <div className="return-stat-badges">
                {Object.entries(stats).map(([key, count]) => (
                  <div key={key} className="return-stat-badge return-stat-badge--exchange" style={{ cursor:'pointer' }} onClick={() => setReasonFilter(key)}>
                    <span className="return-stat-badge__label">{key}</span>
                    <span className="return-stat-badge__count">{count}</span>
                  </div>
                ))}
              </div>
              <ModalDateFilter dateRange={dateRange} setDateRange={setDateRange} showDatePicker={showDatePicker} setShowDatePicker={setShowDatePicker} />
            </div>
          </div>
        </div>
        <div className="modal-table-wrap">
          <table className="modal-table">
            <thead>
              <tr className="modal-thead-row modal-thead-row--yellow">
                <th className="th-padl">Return ID</th>
                <th>Customer</th>
                <th>Date of Return</th>
                <th>Items</th>
                <th>Return Qty</th>
                <th className="th-padr">
                  <div className="return-reason-th" ref={reasonRef}>
                    <span>Reason</span>
                    <button className="reason-custom-btn" onClick={e => { e.stopPropagation(); setShowReasonDrop(v => !v); }}>
                      <span className="reason-custom-btn__label">{reasonFilter}</span>
                      <span className="material-icons" style={{ fontSize:14 }}>arrow_drop_down</span>
                    </button>
                    {showReasonDrop && (
                      <div className="reason-custom-drop" onClick={e => e.stopPropagation()}>
                        <div className="reason-custom-drop__hd">Filter by Reason</div>
                        {ALL_REASONS.map(opt => (
                          <button key={opt} className={`reason-custom-opt${reasonFilter===opt?' reason-custom-opt--active':''}`}
                            onClick={e => { e.stopPropagation(); setReasonFilter(opt); setShowReasonDrop(false); }}>
                            <span className="reason-custom-opt__dot-placeholder" />{opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6} style={{ textAlign:'center', padding:20, color:'rgba(0,0,0,0.35)' }}>No returns found.</td></tr>
                : filtered.map((r, i) => (
                  <tr key={r._id} className={`modal-row modal-row--clickable${i%2!==0?' modal-row--alt':''}`} onClick={() => onRowClick?.(r)}>
                    <td className="th-padl td-bold td-code">{r._id?.slice(-8)}</td>
                    <td>{r.customer}</td>
                    <td>{new Date(r.createdAt).toLocaleString('en-PH',{month:'2-digit',day:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
                    <td>{r.returnItems?.map(i => i.name).join(', ')}</td>
                    <td>{r.returnItems?.reduce((s, i) => s + (i.returnQuantity || 0), 0)}</td>
                    <td className="th-padr">{r.returnItems?.map(i => i.reason).join(', ')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <ModalFooter onDownload={() => downloadHTML(html(), 'returns.html')} onPrint={() => openPrintWindow(html())} />
      </div>
    </div>
  );
}

// ─── Top Selling Modal ────────────────────────────────────────────────────────
function TopSellingModal({ topProducts, onClose }) {
  const html = () => generateTopSellingHTML(topProducts);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><span className="material-icons" style={{ fontSize:16 }}>close</span></button>
        <div className="modal-header">
          <h2 className="modal-title-text">Top Selling Products</h2>
          <p className="modal-subtitle">Ranked by total units sold across completed orders</p>
        </div>
        <div className="modal-table-wrap">
          <table className="modal-table">
            <thead>
              <tr className="modal-thead-row modal-thead-row--yellow">
                <th className="th-padl">Rank</th>
                <th className="th-img"></th>
                <th>Product Name</th>
                <th className="th-center">Units Sold</th>
                <th className="th-padr th-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={p.productId} className={`modal-row${i%2!==0?' modal-row--alt':''}`}>
                  <td className="th-padl td-rank">{p.rank}</td>
                  <td><div className="modal-img-wrap">{p.img && <img src={p.img} alt={p.name} onError={e => { e.target.style.display='none'; }} />}</div></td>
                  <td className="td-name">{p.name}</td>
                  <td className="th-center">{p.qty.toLocaleString()}</td>
                  <td className="th-padr th-right td-bold td-green">{fmtCurrency(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ModalFooter onDownload={() => downloadHTML(html(), 'top-selling.html')} onPrint={() => openPrintWindow(html())} />
      </div>
    </div>
  );
}

// ─── Reports Page ─────────────────────────────────────────────────────────────
const PERIOD_TABS = ['Monthly', 'Quarterly', 'Yearly'];

export default function Reports() {
  const [orders,     setOrders]     = useState([]);
  const [products,   setProducts]   = useState([]);
  const [returns,    setReturns]    = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);

  const [period,            setPeriod]            = useState('Monthly');
  const [categoryModal,     setCategoryModal]     = useState(null);
  const [showReturnModal,   setShowReturnModal]   = useState(false);
  const [returnFilter,      setReturnFilter]      = useState('all');
  const [showSalesTrend,    setShowSalesTrend]    = useState(false);
  const [showTopSelling,    setShowTopSelling]    = useState(false);
  const [chartDateRange,    setChartDateRange]    = useState({ from:null, to:null });
  const [showChartDatePick, setShowChartDatePick] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/orders`).then(r => r.json()),
      fetch(`${API}/products?showAll=true`).then(r => r.json()),
      fetch(`${API}/returns`).then(r => r.json()),
      fetch(`${API}/productcategory`).then(r => r.json()),
    ])
      .then(([ord, prod, ret, cats]) => {
        setOrders(Array.isArray(ord)  ? ord  : []);
        setProducts(Array.isArray(prod) ? prod : []);
        setReturns(Array.isArray(ret)  ? ret  : []);
        setCategories(Array.isArray(cats) ? cats : []);
      })
      .catch(err => console.error('Failed to load reports data:', err))
      .finally(() => setLoading(false));
  }, []);

const productMap = useMemo(() => {
  const m = {};
  products.forEach(p => {
    // Handle both plain string _id and MongoDB { $oid: "..." } format
    const id = p._id?.$oid || p._id?.toString() || p._id;
    m[id] = p;
  });
  return m;
}, [products]);

  const trendRows    = useMemo(() => buildSalesTrend(orders, productMap, categories, period), [orders, productMap, categories, period]);
  const catNames     = useMemo(() => categories.map(c => c.name),                             [categories]);
  const returnChart  = useMemo(() => buildReturnChart(returns, period),                       [returns, period]);
  const topProducts  = useMemo(() => buildTopSelling(orders, productMap),                     [orders, productMap]);
  const categoryData = useMemo(() => buildCategoryShare(orders, productMap, categories),      [orders, productMap, categories]);

  const openReturnModal = (filter) => { setReturnFilter(filter); setShowReturnModal(true); };

  function getChartSubtitle() {
    if (chartDateRange.from && chartDateRange.to) {
      const f = d => d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' });
      return `${f(chartDateRange.from)} – ${f(chartDateRange.to)}`;
    }
    const now = new Date();
    if (period === 'Monthly')   return `Sales performance for ${now.toLocaleString('en-PH', { month:'long', year:'numeric' })}`;
    if (period === 'Quarterly') return `Sales performance for ${now.getFullYear()}`;
    return `Sales performance for ${now.getFullYear()}`;
  }

  const chartDateLabel = chartDateRange.from
    ? (chartDateRange.to
        ? `${chartDateRange.from.toLocaleDateString('en-PH',{month:'short',day:'numeric'})} – ${chartDateRange.to.toLocaleDateString('en-PH',{month:'short',day:'numeric'})}`
        : `${chartDateRange.from.toLocaleDateString('en-PH',{month:'short',day:'numeric'})} – —`)
    : null;

  if (loading) return (
    <div className="reports" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <p style={{ color:'rgba(0,0,0,0.4)', fontSize:14 }}>Loading reports...</p>
    </div>
  );

  return (
    <div className="reports">
      <div className="reports__header">
        <div className="reports__title-block">
          <h1 className="reports__title">REPORTS</h1>
          <p className="reports__subtitle">Analyze sales performance and generate detailed reports.</p>
        </div>
        <Topbar />
      </div>

      <div className="reports__chart-card fade-in">
        <div className="reports__chart-header">
          <div className="reports__chart-header-left">
            <h2 className="reports__section-title">Sales Trend</h2>
            <p className="reports__chart-sub">{getChartSubtitle()}</p>
          </div>
          <div className="reports__chart-header-right">
            <div className="reports__chart-right-top">
              <span className="reports__chart-view-hint" onClick={() => setShowSalesTrend(true)}>View full list →</span>
              <div className="period-toggle">
                {PERIOD_TABS.map(t => (
                  <button key={t} className={`period-toggle__btn ${period===t?'period-toggle__btn--active':''}`}
                    onClick={() => { setPeriod(t); setChartDateRange({ from:null, to:null }); }}>{t}</button>
                ))}
              </div>
            </div>
            <div className="reports__chart-right-bottom">
              <div className="chart-date-wrap">
                <button className={`chart-date-btn${chartDateLabel?' chart-date-btn--active':''}`} onClick={() => setShowChartDatePick(v => !v)}>
                  <span className="material-icons" style={{ fontSize:16, color:'#1C1B1F', flexShrink:0 }}>filter_list</span>
                  <span className="chart-date-btn__label">Date:</span>
                  <span className="chart-date-btn__range">{chartDateLabel || 'From – To'}</span>
                  {chartDateLabel && (
                    <button className="chart-date-btn__clear" onClick={e => { e.stopPropagation(); setChartDateRange({ from:null, to:null }); setShowChartDatePick(false); }} title="Clear">
                      <span className="material-icons" style={{ fontSize:13 }}>close</span>
                    </button>
                  )}
                </button>
                {showChartDatePick && <DateRangePicker value={chartDateRange} onChange={setChartDateRange} onClose={() => setShowChartDatePick(false)} />}
              </div>
            </div>
          </div>
        </div>
        <SalesChart period={period} dateRange={chartDateRange} orders={orders} productMap={productMap} categories={categories} />
      </div>

      <div className="reports__content-row fade-in">
        <div className="reports__left-col">

          <div className="reports__category-card">
            <h2 className="reports__section-title">Category based Sales Share</h2>
            {categoryData.length === 0
              ? <p style={{ fontSize:12, color:'rgba(0,0,0,0.4)', padding:'16px 0' }}>No sales data yet.</p>
              : (
                <div className="reports__category-body">
                  <DonutChart data={categoryData} onSliceClick={label => setCategoryModal(label)} />
                  <div className="reports__category-legend">
                    {categoryData.map(d => (
                      <div key={d.label} className="reports__legend-item" onClick={() => setCategoryModal(d.label)} style={{ cursor:'pointer' }}>
                        <span className="reports__legend-dot" style={{ background:d.color }} />
                        <span className="reports__legend-label">{d.label}</span>
                        <span className="reports__legend-pct" style={{ color:d.color }}>{d.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          <div className="reports__return-card">
            <div className="reports__return-header">
              <h2 className="reports__section-title">Return Product</h2>
              <div className="reports__return-legend">
                {[
                  { key:'Wrong Item', color:'#FFB6C8' },
                  { key:'Defective',  color:'#78A5FA' },
                  { key:'Wrong Size', color:'#86EFAC' },
                ].map(({ key, color }) => (
                  <button key={key} className="return-legend-btn" onClick={() => openReturnModal(key)}>
                    <span className="return-legend-dot" style={{ background:color }} />
                    <span className="return-legend-text">{key}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="return-chart-wrap" onClick={() => openReturnModal('all')}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={returnChart} margin={{ top:6, right:10, left:-10, bottom:0 }} barCategoryGap="30%" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontFamily:'Inter', fontSize:10, fill:'rgba(0,0,0,0.5)' }} axisLine={{ stroke:'rgba(0,0,0,0.3)' }} tickLine={false} />
                  <YAxis tick={{ fontFamily:'Inter', fontSize:10, fill:'rgba(0,0,0,0.4)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ReturnTooltip />} />
                  <Bar dataKey="Wrong Item" name="Wrong Item" fill="#FFB6C8" radius={[4,4,0,0]} animationDuration={700} style={{ cursor:'pointer' }} onClick={(d,i,e) => { e.stopPropagation(); openReturnModal('Wrong Item'); }} />
                  <Bar dataKey="Defective"  name="Defective"  fill="#78A5FA" radius={[4,4,0,0]} animationDuration={700} style={{ cursor:'pointer' }} onClick={(d,i,e) => { e.stopPropagation(); openReturnModal('Defective'); }} />
                  <Bar dataKey="Wrong Size" name="Wrong Size" fill="#86EFAC" radius={[4,4,0,0]} animationDuration={700} style={{ cursor:'pointer' }} onClick={(d,i,e) => { e.stopPropagation(); openReturnModal('Wrong Size'); }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="reports__return-hint" onClick={() => openReturnModal('all')}>View full return &amp; exchange list →</p>
          </div>
        </div>

        <div className="reports__top-selling">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <h2 className="reports__section-title">Top Selling</h2>
            <span className="reports__chart-view-hint" onClick={() => setShowTopSelling(true)} style={{ cursor:'pointer', fontSize:12 }}>View all →</span>
          </div>
          <div className="reports__products-list">
            {topProducts.length === 0
              ? <p style={{ fontSize:12, color:'rgba(0,0,0,0.4)' }}>No sales data yet.</p>
              : topProducts.map(p => (
                <div key={p.productId} className="reports__product-card">
                  <span className="reports__product-rank">{p.rank}</span>
                  <div className="reports__product-img-wrap">
                    {p.img && <img src={p.img} alt={p.name} className="reports__product-img" onError={e => { e.target.style.display='none'; }} />}
                  </div>
                  <div className="reports__product-info">
                    <p className="reports__product-name">{p.name}</p>
                    <p className="reports__product-meta">Units Sold: <span>{p.qty.toLocaleString()}</span></p>
                    <p className="reports__product-meta">Sales Revenue: <span>{fmtCurrency(p.revenue)}</span></p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {showSalesTrend && (
        <SalesTrendModal period={period} rows={trendRows} catNames={catNames} onClose={() => setShowSalesTrend(false)} onRowClick={() => {}} />
      )}

      {categoryModal && (
        <CategoryModal
          category={categoryModal}
          catColor={categoryData.find(c => c.label === categoryModal)?.color}
          orders={orders}
          productMap={productMap}
          onClose={() => setCategoryModal(null)}
        />
      )}

      {showReturnModal && (
        <ReturnModal returns={returns} filter={returnFilter} onClose={() => setShowReturnModal(false)} onRowClick={() => {}} />
      )}

      {showTopSelling && (
        <TopSellingModal topProducts={topProducts} onClose={() => setShowTopSelling(false)} />
      )}
    </div>
  );
}