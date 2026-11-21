
import React from 'react';
import { Navigate } from 'react-router-dom';

function RoleRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('token');

  const user = JSON.parse(
    localStorage.getItem('user') || 'null'
  );

  // Not logged in
  if (!token || !user) {
    return <Navigate to="/" replace />;
  }

  // User is authorized for this route
  if (allowedRoles.includes(user.role)) {
    return children;
  }

  // Redirect unauthorized users to their own dashboard
  if (user.role === 'admin' || user.role === 'lgu') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (user.role === 'partner') {
    return <Navigate to="/partner/dashboard" replace />;
  }

  if (user.role === 'community_member') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/" replace />;
}

export default RoleRoute;
