import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../Components/sidebar/Sidebar';
import './Layout.css';

export default function Layout() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <div className={`layout ${sidebarExpanded ? 'layout--expanded' : 'layout--collapsed'}`}>
      <Sidebar onExpandChange={setSidebarExpanded} />
      <main className="layout__main">
        <Outlet />
      </main>
    </div>
  );
}