import React, { useState, useMemo, useEffect } from 'react';
import Topbar from '../../Components/notif/Topbar';
import SalesChart from './Saleschart';
import './Dashboard.css';

const API = `${import.meta.env.VITE_API_URL}/api`;

const STATUS_META = {
  reserved:      { label: 'reserved',    bg: 'rgba(253,230,138,0.25)', border: 'rgba(253,230,138,0.63)', dot: '#FDE68A' },
  overdue:       { label: 'overdue',     bg: 'rgba(252,165,165,0.25)', border: 'rgba(252,165,165,0.66)', dot: '#FCA5A5' },
  'to ship':     { label: 'to ship',     bg: 'rgba(147,197,253,0.25)', border: 'rgba(147,197,253,0.66)', dot: '#93C5FD' },
  'shipped out': { label: 'shipped out', bg: 'rgba(196,181,253,0.25)', border: 'rgba(196,181,253,0.66)', dot: '#C4B5FD' },
  completed:     { label: 'completed',   bg: 'rgba(112,233,90,0.25)',  border: 'rgba(112,233,90,0.66)',  dot: '#70E95A' },
  cancelled:     { label: 'cancelled',   bg: 'rgba(153,2,20,0.25)',    border: '#990214',                dot: '#990214' },
};

const PERIOD_TABS = ['Monthly', 'Quarterly', 'Yearly'];

export default function Dashboard() {
  const [period, setPeriod]             = useState('Monthly');
  const [sortOrder, setSortOrder]       = useState('desc');
  const [sortDropOpen, setSortDropOpen] = useState(false);

  // ── data state ──
  const [orders,   setOrders]   = useState([]);
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);

  // ── fetch everything ──
  useEffect(() => {
    Promise.all([
      fetch(`${API}/orders`).then(r => r.json()),
      fetch(`${API}/products?showAll=true`).then(r => r.json()),
    ])
      .then(([ord, prod]) => {
        setOrders(Array.isArray(ord)  ? ord  : []);
        setProducts(Array.isArray(prod) ? prod : []);
      })
      .catch(err => console.error('Dashboard fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  // ── product lookup map ──
  const productMap = useMemo(() => {
    const m = {};
    products.forEach(p => { m[p._id] = p; });
    return m;
  }, [products]);

  // ── stat cards ──
  const totalOrders  = orders.length;
  const toShip       = orders.filter(o => o.status?.toLowerCase() === 'to ship').length;
  const overdueCount = orders.filter(o => o.status?.toLowerCase() === 'overdue').length;

  // ── recent transactions (last 10, sorted) ──
  const sortedTxns = useMemo(() => {
    return [...orders]
      .sort((a, b) =>
        sortOrder === 'desc'
          ? new Date(b.createdAt) - new Date(a.createdAt)
          : new Date(a.createdAt) - new Date(b.createdAt)
      )
      .slice(0, 10);
  }, [orders, sortOrder]);

  // ── top selling products (completed only) ──
// ── top selling products (completed only) ──
const topProducts = useMemo(() => {
  const sold = {};
  for (const order of orders) {
    if (order.status?.toLowerCase() !== 'completed') continue;
    for (const item of (order.products || [])) {
      // ✅ item.product is a populated object, grab _id from it
      const pid = item.product?._id || item.product?.toString();
      if (!pid) continue;
      if (!sold[pid]) sold[pid] = {
        productId: pid,
        name:      item.name,
        price:     item.price || 0,
        qty:       0,
        revenue:   0,
        // ✅ grab image directly from the populated product object
        img:       item.product?.images?.[0] || null,
      };
      sold[pid].qty     += item.quantity || 0;
      sold[pid].revenue += (item.price || 0) * (item.quantity || 0);
    }
  }
  return Object.values(sold)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 3)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}, [orders, productMap]);

  // ── low stock products ──
  const lowStock = useMemo(() => {
    return products
      .filter(p => p.stock <= 5)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 6)
      .map(p => ({
        name:   p.name,
        stock:  p.stock,
        status: p.stock === 0 ? 'out' : 'low',
        color:  p.stock === 0 ? 'red' : 'blue',
        img:    p.images?.[0] || null,
      }));
  }, [products]);

  const formatCurrency = (n) =>
    '₱ ' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

  if (loading) return (
    <div className="dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 14 }}>Loading dashboard...</p>
    </div>
  );

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard__header">
        <div className="dashboard__title-block">
          <h1 className="dashboard__title">OVERVIEW</h1>
          <p className="dashboard__subtitle">
            View your business summary, sales insights, and activity at a glance.
          </p>
        </div>
        <Topbar />
      </div>

      {/* Stat cards */}
      <div className="dashboard__stats fade-in">
        <StatCard value={totalOrders}  label="Total Order" />
        <StatCard value={toShip}       label="To Shipped" />
        <StatCard value={overdueCount} label="Overdue Order" />
      </div>

      {/* Right column */}
      <div className="dashboard__right">
        {/* Top Selling */}
        <div className="dashboard__top-products fade-in" style={{ animationDelay: '0.15s' }}>
          <h2 className="section-title">Top Selling Product</h2>
          <div className="top-products__card">
            {topProducts.length === 0
              ? <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', padding: 16 }}>No completed orders yet.</p>
              : topProducts.map((p) => (
                <div key={p.rank} className="top-product__item">
                  <span className="top-product__rank">{p.rank}</span>
                  <div className="top-product__img-wrap">
                    {p.img && (
                      <img
                        src={p.img}
                        alt={p.name}
                        className="top-product__img"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentNode.classList.add('top-product__img-wrap--placeholder');
                        }}
                      />
                    )}
                  </div>
                  <div className="top-product__info">
                    <p className="top-product__name">{p.name}</p>
                    <p className="top-product__price">{formatCurrency(p.price)}</p>
                    <p className="top-product__units"><span>Units Sold:</span> {p.qty.toLocaleString()} items</p>
                    <p className="top-product__revenue"><span>Sales Revenue:</span> {formatCurrency(p.revenue)}</p>
                  </div>
                  <span className="material-icons top-product__trend">trending_up</span>
                </div>
              ))}
          </div>
        </div>

        {/* Low Stock */}
        <div className="dashboard__low-stock fade-in" style={{ animationDelay: '0.25s' }}>
          <h2 className="section-title">Low Stock</h2>
          <div className="low-stock__list">
            {lowStock.length === 0
              ? <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', padding: 16 }}>All products have sufficient stock.</p>
              : lowStock.map((item, i) => (
                <div key={i} className={`low-stock__item low-stock__item--${item.color}`}>
                  <div className="low-stock__img-wrap">
                    {item.img && (
                      <img
                        src={item.img}
                        alt={item.name}
                        className="low-stock__img"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentNode.classList.add('low-stock__img-wrap--placeholder');
                        }}
                      />
                    )}
                  </div>
                  <div className="low-stock__info">
                    <p className="low-stock__name">{item.name}</p>
                    <p className="low-stock__stock">Stock: <strong>{item.stock}</strong></p>
                  </div>
                  <div className="low-stock__status">
                    <span
                      className="low-stock__dot"
                      style={{ background: item.color === 'red' ? '#750010' : '#0D0DBB' }}
                    />
                    <span className="low-stock__label">
                      {item.status === 'out' ? 'Out of Stock' : 'Low Stock'}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="dashboard__body">
        <div className="dashboard__left">
          {/* Sales Analytics */}
          <div className="dashboard__chart-card fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="chart-card__header">
              <div>
                <h2 className="chart-card__title">Sales Analytics</h2>
                <p className="chart-card__sub">
                  {period === 'Monthly'   && 'Sales performance for the past 30 days'}
                  {period === 'Quarterly' && 'Sales performance every 3 months'}
                  {period === 'Yearly'    && 'Sales performance for the past 12 months'}
                </p>
              </div>
              <div className="period-toggle">
                {PERIOD_TABS.map((tab) => (
                  <button
                    key={tab}
                    className={`period-toggle__btn ${period === tab ? 'period-toggle__btn--active' : ''}`}
                    onClick={() => setPeriod(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            {/* ✅ pass real orders to SalesChart */}
            <SalesChart period={period} orders={orders} />
          </div>

          {/* Recent Transactions */}
          <div className="dashboard__txn-card fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="txn__header">
              <h2 className="txn__title">Recent Transactions</h2>
              <div className="txn__sort-wrap">
                <button
                  className="txn__sort-btn"
                  onClick={() => setSortDropOpen(v => !v)}
                >
                  <span className="material-icons" style={{ fontSize: 18 }}>sort</span>
                </button>
                {sortDropOpen && (
                  <div className="txn__sort-drop scale-in">
                    <div
                      className={`txn__sort-option ${sortOrder === 'desc' ? 'active' : ''}`}
                      onClick={() => { setSortOrder('desc'); setSortDropOpen(false); }}
                    >
                      <span className="material-icons">arrow_downward</span>Newest
                    </div>
                    <div
                      className={`txn__sort-option ${sortOrder === 'asc' ? 'active' : ''}`}
                      onClick={() => { setSortOrder('asc'); setSortDropOpen(false); }}
                    >
                      <span className="material-icons">arrow_upward</span>Oldest
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="txn__table-wrap">
              <table className="txn__table">
                <thead>
                  <tr className="txn__thead-row">
                    <th>Transaction ID</th>
                    <th>Customer Name</th>
                    <th>Payment Method</th>
                    <th>Payment Reference</th>
                    <th>Total Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTxns.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'rgba(0,0,0,0.35)', fontSize: 13 }}>
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    sortedTxns.map((txn, i) => {
                      const status = txn.status?.toLowerCase();
                      const meta   = STATUS_META[status] || STATUS_META.reserved;
                      return (
                        <tr key={txn._id} className="txn__row" style={{ animationDelay: `${i * 0.05}s` }}>
                          <td className="txn__id">{txn._id?.slice(-8)}</td>
                          <td>{txn.nameTobill}</td>
                          <td>{txn.paymentMethod}</td>
                          <td>{txn.paymentReference || '—'}</td>
                          <td>{formatCurrency(txn.subTotal)}</td>
                          <td>
                            <span
                              className="txn__status-badge"
                              style={{ background: meta.bg, border: `0.5px solid ${meta.border}` }}
                            >
                              <span className="txn__status-dot" style={{ background: meta.dot }} />
                              {meta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label }) {
  return (
    <div className="stat-card">
      <div className="stat-card__inner">
        <p className="stat-card__value">{value}</p>
        <p className="stat-card__label">{label}</p>
      </div>
    </div>
  );
}