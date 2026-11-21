import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import './App.css';

import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';

import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import RegisterPage from './pages/RegisterPage';
import GPSTestPage from './pages/GPSTestPage';

import DashboardPage from './pages/DashboardPage';
import ActivitiesPage from './pages/ActivitiesPage';
import MyParticipationPage from './pages/MyParticipationPage';
import RewardsPage from './pages/RewardsPage';
import MyRedemptionsPage from './pages/MyRedemptionsPage';
import CitizenProfilePage from './pages/CitizenProfilePage';
import PointsHistoryPage from './pages/PointsHistoryPage';

import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminAccountRequestsPage from './pages/AdminAccountRequestsPage';
import AdminSmartPointsPage from './pages/AdminSmartPointsPage';
import AdminRedemptionsPage from './pages/AdminRedemptionsPage';
import AdminReportsPage from './pages/AdminReportsPage';
import FraudReportPage from './pages/FraudReportPage';
import PendingRewardsPage from './pages/PendingRewardsPage';
import AdminAnalyticsPage from './pages/AdminAnalyticsPage';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage';
import SeasonLeaderboardPage from './pages/SeasonLeaderboardPage';

import PartnerDashboardPage from './pages/PartnerDashboardPage';
import PartnerRedemptionsPage from './pages/PartnerRedemptionsPage';
import PartnerProfilePage from './pages/PartnerProfilePage';
import AdminProfilePage from './pages/AdminProfilePage';



function App() {
  const user = JSON.parse(
    localStorage.getItem('user') || 'null'
  );


  /* =====================================================
     ROLE-BASED DEFAULT DASHBOARD
     ===================================================== */

 const getDefaultDashboard = () => {
  if (!user) {
    return '/';
  }

  if (user.role === 'admin') {
    return '/admin/dashboard';
  }

  if (user.role === 'partner') {
    return '/partner/dashboard';
  }

 if (user.role === 'lgu') {
  return '/admin/dashboard';
}

  return '/dashboard';
};


  return (
    <Router>

      {/* NAVBAR */}
      {user && <Navbar />}


      <Routes>

<Route
  path="/gps-test"
  element={<GPSTestPage />}
/>
        {/* =================================================
            PUBLIC ROUTES
            ================================================= */}

        <Route
          path="/"
          element={<LoginPage />}
        />


<Route
  path="/forgot-password"
  element={<ForgotPasswordPage />}
/>


        <Route
          path="/register"
          element={<RegisterPage />}
        />


        {/* =================================================
            COMMUNITY MEMBER DASHBOARD
            ================================================= */}

        <Route
          path="/dashboard"
          element={
            <RoleRoute
              allowedRoles={['community_member']}
            >
              <DashboardPage />
            </RoleRoute>
          }
        />


        {/* =================================================
            SHARED ACTIVITIES
            ================================================= */}

        <Route
          path="/activities"
          element={
            <ProtectedRoute>
              <ActivitiesPage />
            </ProtectedRoute>
          }
        />

        {/* =================================================
    COMMUNITY MEMBER - MY PARTICIPATION
    ================================================= */}

<Route
  path="/my-participation"
  element={
    <RoleRoute
      allowedRoles={['community_member']}
    >
      <MyParticipationPage />
    </RoleRoute>
  }
/>
        


        {/* =================================================
            SHARED REWARDS
            ================================================= */}

        <Route
          path="/rewards"
          element={
            <ProtectedRoute>
              <RewardsPage />
            </ProtectedRoute>
          }
        />

            <Route
  path="/profile"
  element={
    <RoleRoute
      allowedRoles={['community_member']}
    >
      <CitizenProfilePage />
    </RoleRoute>
  }
/>

<Route
  path="/points-history"
  element={
    <RoleRoute allowedRoles={['community_member']}>
      <PointsHistoryPage />
    </RoleRoute>
  }
/>
        {/* =================================================
            COMMUNITY MEMBER - MY REDEMPTIONS
            ================================================= */}

        <Route
          path="/my-redemptions"
          element={
            <RoleRoute
              allowedRoles={['community_member']}
            >
              <MyRedemptionsPage />
            </RoleRoute>
          }
        />


        {/* =================================================
            ADMIN DASHBOARD
            ================================================= */}

          
<Route
  path="/admin/account-requests"
  element={
    <RoleRoute allowedRoles={['admin', 'lgu']}>
      <AdminAccountRequestsPage />
    </RoleRoute>
  }
/>

        <Route
          path="/admin/dashboard"
          element={
            <RoleRoute
              allowedRoles={['admin', 'lgu']}
            >
              <AdminDashboardPage />
            </RoleRoute>
          }
        />


        {/* =================================================
            ADMIN SMART POINTS
            ================================================= */}

        <Route
          path="/admin/smart-points"
          element={
            <RoleRoute
              allowedRoles={['admin', 'lgu']}
            >
              <AdminSmartPointsPage />
            </RoleRoute>
          }
        />
      <Route
  path="/leaderboard"
  element={
    <RoleRoute allowedRoles={['community_member']}>
      <SeasonLeaderboardPage />
    </RoleRoute>
  }
/>

        {/* =================================================
            ADMIN REDEMPTIONS
            ================================================= */}

        <Route
          path="/admin/redemptions"
          element={
            <RoleRoute
            allowedRoles={['admin', 'lgu']}
            >
              <AdminRedemptionsPage />
            </RoleRoute>
          }
        />


        {/* =================================================
            ADMIN PARTNERS / REWARD APPROVAL
            ================================================= */}

        <Route
          path="/admin/pending-rewards"
          element={
            <RoleRoute
              allowedRoles={['admin']}
            >
              <PendingRewardsPage />
            </RoleRoute>
          }
        />


        {/* =================================================
            ADMIN PARTICIPATION REVIEW
            ================================================= */}

       <Route
  path="/admin/reports"
  element={
    <RoleRoute
      allowedRoles={['admin', 'lgu']}
    >
      <AdminReportsPage />
    </RoleRoute>
  }
/>


        {/* =================================================
            ADMIN FRAUD ALERTS
            ================================================= */}

        <Route
          path="/admin/fraud-report"
          element={
            <RoleRoute
              allowedRoles={['admin']}
            >
              <FraudReportPage />
            </RoleRoute>
          }
        />


        {/* =================================================
            ADMIN ANALYTICS
            ================================================= */}

        <Route
          path="/admin/analytics"
          element={
            <RoleRoute
              allowedRoles={['admin']}
            >
              <AdminAnalyticsPage />
            </RoleRoute>
          }
        />

        <Route
  path="/admin/audit-logs"
  element={
    <RoleRoute allowedRoles={['admin']}>
      <AdminAuditLogsPage />
    </RoleRoute>
  }
/>


        {/* =================================================
            PARTNER DASHBOARD
            ================================================= */}

        <Route
          path="/partner/dashboard"
          element={
            <RoleRoute
              allowedRoles={['partner']}
            >
              <PartnerDashboardPage />
            </RoleRoute>
          }
        />
        <Route
  path="/partner/redemptions"
  element={
    <RoleRoute
      allowedRoles={['partner']}
    >
      <PartnerRedemptionsPage />
    </RoleRoute>
  }
/>
<Route
  path="/partner/profile"
  element={
    <RoleRoute
      allowedRoles={['partner']}
    >
      <PartnerProfilePage />
    </RoleRoute>
  }
/>

<Route
  path="/admin/profile"
  element={
    <RoleRoute allowedRoles={['admin', 'lgu']}>
      <AdminProfilePage />
    </RoleRoute>
  }
/>


        {/* =================================================
            UNKNOWN ROUTES
            Send user to the correct dashboard for their role.
            ================================================= */}

        <Route
          path="*"
          element={
            <Navigate
              to={getDefaultDashboard()}
              replace
            />
          }
        />

      </Routes>

    </Router>
  );
}


export default App;