import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './Components/ProtectedRoute';

// Layout
import Layout from './Pages/pos_pages/Layout';

// Main pages (with sidebar)
import Dashboard from './Pages/pos_pages/Dashboard';
import POS from './Pages/pos_pages/POS';
import Transaction from './Pages/pos_pages/Transaction';
import Product from './Pages/pos_pages/Product';
import Reports from './Pages/pos_pages/Reports';
import Archive from './Pages/pos_pages/Archive';

// Login flow (no sidebar)
import Forgot from './Pages/Login/Forgot';
import Login from './Pages/Login/Login';
import Verify from './Pages/Login/Verify';
import Confirm from './Pages/Login/Confirm';
import Change from './Pages/Login/Change';

// Settings (with sidebar)
import Logreports from './Pages/Settings/Logreports';
import StoreInformation from './Pages/Settings/StoreInformation';
import SystemPreferences from './Pages/Settings/SystemPreferences';
import Usermanagement from './Pages/Settings/Usermanagement';
import BackupRecovery from './Pages/Settings/BackupRecovery';

function App() {
  return (
    <Router>
      <Routes>

        {/* Default → Login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public routes — no login needed */}
        <Route path="/login"   element={<Login />} />
        <Route path="/forgot"  element={<Forgot />} />
        <Route path="/verify"  element={<Verify />} />
        <Route path="/confirm" element={<Confirm />} />
        <Route path="/change"  element={<Change />} />

        {/* Protected routes — login required */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="dashboard"        element={<Dashboard />} />
          <Route path="pos"              element={<POS />} />
          <Route path="transaction"      element={<Transaction />} />
          <Route path="product"          element={<Product />} />
          <Route path="reports"          element={<Reports />} />
          <Route path="archive"          element={<Archive />} />
          <Route path="storeinformation" element={<StoreInformation />} />
          <Route path="usermanagement"   element={<Usermanagement />} />
          <Route path="logreports"       element={<Logreports />} />
          <Route path="systempreferences" element={<SystemPreferences />} />
          <Route path="backuprecovery"   element={<BackupRecovery />} />
        </Route>

      </Routes>
    </Router>
  );
}

export default App;