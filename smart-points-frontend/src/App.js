import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ActivitiesPage from './pages/ActivitiesPage';
import RewardsPage from './pages/RewardsPage';
import MyRedemptionsPage from './pages/MyRedemptionsPage';
import AdminReportsPage from './pages/AdminReportsPage';
import FraudReportPage from './pages/FraudReportPage';
import PendingRewardsPage from './pages/PendingRewardsPage';
import AdminAnalyticsPage from './pages/AdminAnalyticsPage';
import PartnerDashboardPage from './pages/PartnerDashboardPage';

function App() {
  const user = JSON.parse(localStorage.getItem('user'));

  return (
    <Router>
      {user && <Navbar />}

      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/activities"
          element={
            <ProtectedRoute>
              <ActivitiesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rewards"
          element={
            <ProtectedRoute>
              <RewardsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-redemptions"
          element={
            <RoleRoute allowedRoles={['community_member']}>
              <MyRedemptionsPage />
            </RoleRoute>
          }
        />

        <Route
          path="/admin/pending-rewards"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <PendingRewardsPage />
            </RoleRoute>
          }
        />

        <Route
          path="/admin/reports"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <AdminReportsPage />
            </RoleRoute>
          }
        />

        <Route
          path="/admin/fraud-report"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <FraudReportPage />
            </RoleRoute>
          }
        />

        <Route
          path="/admin/analytics"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <AdminAnalyticsPage />
            </RoleRoute>
          }
        />

        <Route
          path="/partner-dashboard"
          element={
            <ProtectedRoute>
              <PartnerDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} replace />} />
      </Routes>
    </Router>
  );
}

export default App;