import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './sidebar.css';
import storefront from '../../Assets/storefront.png';
import transaction from '../../Assets/transaction.png';
import logo from '../../Assets/logo.png';
import dashboard from '../../Assets/dashboard.png';
import product from '../../Assets/box.png';
import reports from '../../Assets/grouped_bar_chart.png';
import archive from '../../Assets/archive.png';
import logoutIcon from '../../Assets/exit_to_app.png';

const navItems = [
  { label: 'Dashboard', icon: dashboard, path: '/dashboard' },
  { label: 'POS', icon: storefront, path: '/pos' },
  { label: 'Transaction', icon: transaction, path: '/transaction' },
  { label: 'Product', icon: product, path: '/product' },
  { label: 'Reports', icon: reports, path: '/reports' },
  { label: 'Archive', icon: archive, path: '/archive' },
];

export default function Sidebar({ onExpandChange }) {
  const [expanded, setExpanded] = useState(false);

  const handleEnter = () => { setExpanded(true); onExpandChange?.(true); };
  const handleLeave = () => { setExpanded(false); onExpandChange?.(false); };

  const handleLogout = () => {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = '/login';
  };

  return (
    <aside
      className={`sidebar ${expanded ? 'sidebar--expanded' : 'sidebar--collapsed'}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div className="sidebar__logo-wrap">
        <img
          src={logo}
          alt="Love Athalia Essentials"
          className="sidebar__logo"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        <div className="sidebar__logo-fallback" style={{ display: 'none' }}>
          <span className="material-icons sidebar__logo-icon">favorite</span>
          <div className="sidebar__logo-text-wrap">
            <span className="sidebar__logo-text">Love Athalia</span>
            <span className="sidebar__logo-sub">ESSENTIALS</span>
          </div>
        </div>
      </div>

      <nav className="sidebar__nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={!expanded ? item.label : undefined}
            className={({ isActive }) =>
              `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
            }
          >
            <span className="sidebar__nav-icon">
              <img src={item.icon} alt={item.label} className="sidebar__nav-icon-img" />
            </span>
            <span className="sidebar__nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <button className="sidebar__logout" onClick={handleLogout} title={!expanded ? 'Log Out' : undefined}>
        <img src={logoutIcon} alt="Log out" className="sidebar__logout-icon-img" />
        <span className="sidebar__logout-label">Log Out</span>
      </button>
    </aside>
  );
}