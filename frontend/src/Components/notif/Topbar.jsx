import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import './Topbar.css';

const API_BASE = import.meta.env.VITE_API_URL;

export default function Topbar() {
  const navigate = useNavigate();
  const [now, setNow]               = useState(new Date());
  const [notifOpen, setNotifOpen]   = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readIds, setReadIds]       = useState(new Set());
  const [notifs, setNotifs]         = useState([]);

  const notifRef    = useRef(null);
  const settingsRef = useRef(null);

  // ── Clock ──────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Outside click ──────────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current    && !notifRef.current.contains(e.target))    setNotifOpen(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Fetch notifications ────────────────────────────────────────────
  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const [ordersRes, productsRes, lowStockRes] = await Promise.all([
          fetch(`${API_BASE}/api/orders`),
          fetch(`${API_BASE}/api/products?showAll=true`),
          fetch(`${API_BASE}/api/lowstocksetting`),
        ]);

        const [orders, products, lowStockData] = await Promise.all([
          ordersRes.json(),
          productsRes.json(),
          lowStockRes.json(),
        ]);

        const threshold = lowStockData?.lowStockQty || 10;
        const generated = [];

        // ── Overdue orders ──
        const overdueOrders = orders.filter(o =>
          o.status?.toLowerCase() === 'overdue'
        );

        if (overdueOrders.length > 0) {
          generated.push({
            id:    'overdue',
            icon:  'error_outline',
            color: '#B07D00',
            bg:    'rgba(254,215,0,0.22)',
            title: `${overdueOrders.length} overdue order${overdueOrders.length > 1 ? 's' : ''}`,
            desc:  overdueOrders.length === 1
              ? `Order from ${overdueOrders[0].nameTobill || 'a customer'} needs attention.`
              : `${overdueOrders.length} orders need your attention.`,
            time:  'Just now',
            route: '/transaction',
          });
        }

        // ── Low stock products ──
        const lowStockProducts = products.filter(p => {
          const stock = Number(p.stock) || 0;
          return stock > 0 && stock <= threshold;
        });

        const outOfStockProducts = products.filter(p => {
          const stock = Number(p.stock) || 0;
          return stock <= 0;
        });

        if (lowStockProducts.length > 0) {
          generated.push({
            id:    'lowstock',
            icon:  'inventory_2',
            color: '#BE1300',
            bg:    'rgba(190,19,0,0.10)',
            title: `${lowStockProducts.length} low stock product${lowStockProducts.length > 1 ? 's' : ''}`,
            desc:  lowStockProducts.length === 1
              ? `${lowStockProducts[0].name} is almost out.`
              : `${lowStockProducts[0].name} and ${lowStockProducts.length - 1} other${lowStockProducts.length - 1 > 1 ? 's' : ''} are running low.`,
            time:  'Just now',
            route: '/product',
          });
        }

        if (outOfStockProducts.length > 0) {
          generated.push({
            id:    'outofstock',
            icon:  'remove_shopping_cart',
            color: '#750010',
            bg:    'rgba(159,0,3,0.10)',
            title: `${outOfStockProducts.length} out of stock`,
            desc:  outOfStockProducts.length === 1
              ? `${outOfStockProducts[0].name} is out of stock.`
              : `${outOfStockProducts[0].name} and ${outOfStockProducts.length - 1} other${outOfStockProducts.length - 1 > 1 ? 's' : ''} are out of stock.`,
            time:  'Just now',
            route: '/product',
          });
        }

        setNotifs(generated);

      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };

    fetchNotifs();

    // Re-fetch every 2 minutes to stay updated
    const interval = setInterval(fetchNotifs, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────
  const formatTime = (d) => {
    let h = d.getHours();
    const m    = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  const formatDate = (d) =>
    d.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });

  const unreadCount = notifs.filter(n => !readIds.has(n.id)).length;
  const markAllRead = () => setReadIds(new Set(notifs.map(n => n.id)));
  const markOneRead = (id) => setReadIds(prev => new Set([...prev, id]));

  return (
    <header className="topbar">
      {/* DateTime */}
      <div className="topbar__datetime">
        <span className="topbar__time">{formatTime(now)}</span>
        <div className="topbar__divider" />
        <span className="topbar__date">{formatDate(now)}</span>
      </div>

      <div className="topbar__actions">

        {/* Notification bell */}
        <div className="topbar__icon-wrap" ref={notifRef}>
          <button
            className={`topbar__icon-btn ${notifOpen ? 'topbar__icon-btn--active' : ''}`}
            onClick={() => { setNotifOpen(v => !v); setSettingsOpen(false); }}
            title="Notifications"
          >
            <span className="material-icons">notifications</span>
            {unreadCount > 0 && (
              <span className="topbar__badge">{unreadCount}</span>
            )}
          </button>

          {notifOpen && (
            <div className="topbar__dropdown topbar__dropdown--notif scale-in">

              {/* Header */}
              <div className="notif__header">
                <div className="notif__header-left">
                  <span className="material-icons notif__header-icon">notifications_active</span>
                  <span className="notif__header-title">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="notif__count-pill">{unreadCount} new</span>
                  )}
                </div>
                {unreadCount > 0 ? (
                  <button className="notif__mark-all" onClick={markAllRead}>
                    <span className="material-icons" style={{ fontSize: 13 }}>done_all</span>
                    Mark all read
                  </button>
                ) : (
                  <span className="notif__all-clear">All caught up ✓</span>
                )}
              </div>

              {/* List */}
              <ul className="notif__list">
                {notifs.length === 0 ? (
                  <li style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    color: 'rgba(0,0,0,0.35)',
                    fontSize: 13,
                  }}>
                    <span className="material-icons" style={{ fontSize: 32, display: 'block', marginBottom: 6, color: 'rgba(0,0,0,0.2)' }}>
                      notifications_none
                    </span>
                    No notifications right now
                  </li>
                ) : (
                  notifs.map((n, i) => {
                    const isRead = readIds.has(n.id);
                    return (
                      <li
                        key={n.id}
                        className={`notif__item ${!isRead ? 'notif__item--unread' : 'notif__item--read'}`}
                        style={{ animationDelay: `${i * 0.06}s`, cursor: 'pointer' }}
                        onClick={() => {
                          markOneRead(n.id);
                          if (n.route) navigate(n.route);
                          setNotifOpen(false);
                        }}
                      >
                        <div className="notif__icon-wrap" style={{ background: n.bg }}>
                          <span className="material-icons notif__icon" style={{ color: n.color }}>
                            {n.icon}
                          </span>
                        </div>

                        <div className="notif__text">
                          <p className="notif__title">{n.title}</p>
                          <p className="notif__desc">{n.desc}</p>
                          <span className="notif__time">
                            <span className="material-icons" style={{ fontSize: 10, verticalAlign: 'middle' }}>schedule</span>
                            {' '}{n.time}
                          </span>
                        </div>

                        {!isRead && <span className="notif__unread-dot" />}
                      </li>
                    );
                  })
                )}
              </ul>

            </div>
          )}
        </div>

        {/* Settings */}
        <div className="topbar__icon-wrap" ref={settingsRef}>
          <button
            className="topbar__icon-btn"
            onClick={() => { setSettingsOpen(!settingsOpen); setNotifOpen(false); navigate("/storeinformation"); }}
            title="Settings"
          >
            <span className="material-icons">settings</span>
          </button>
        </div>

        {/* Profile avatar */}
        <div className="topbar__profile-wrap">
          <button className="topbar__avatar-btn" title="Profile">
            <img
              src="/images/profile.jpg"
              alt="Profile"
              className="topbar__avatar"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="topbar__avatar-fallback" style={{ display: 'none' }}>
              <span className="material-icons" style={{ fontSize: 28, color: '#fff' }}>person</span>
            </div>
          </button>
        </div>

      </div>
    </header>
  );
}