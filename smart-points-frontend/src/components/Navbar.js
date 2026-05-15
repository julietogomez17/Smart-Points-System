import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(() => {
    return JSON.parse(localStorage.getItem('user'));
  });

  useEffect(() => {
    const updateUser = () => {
      setUser(JSON.parse(localStorage.getItem('user')));
    };

    updateUser();

    window.addEventListener('storage', updateUser);
    window.addEventListener('auth-changed', updateUser);

    return () => {
      window.removeEventListener('storage', updateUser);
      window.removeEventListener('auth-changed', updateUser);
    };
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    setUser(null);
    window.dispatchEvent(new Event('auth-changed'));

    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  if (location.pathname === '/' || location.pathname === '/register') {
    return null;
  }

  return (
    <nav className="main-navbar">
      <div className="nav-brand">
        <Link to="/dashboard">
          <img src="/logo.png" alt="Smart Points" className="logo-img" />
        </Link>
      </div>

      <div className="nav-links">
        {user && (
          <>
            <Link
              className={isActive('/dashboard') ? 'nav-link active' : 'nav-link'}
              to="/dashboard"
            >
              Dashboard
            </Link>

            <Link
              className={isActive('/activities') ? 'nav-link active' : 'nav-link'}
              to="/activities"
            >
              Activities
            </Link>

            <Link
              className={isActive('/rewards') ? 'nav-link active' : 'nav-link'}
              to="/rewards"
            >
              Rewards
            </Link>
          </>
        )}

        {user?.role === 'community_member' && (
          <Link
            to="/my-redemptions"
            className={isActive('/my-redemptions') ? 'nav-link active' : 'nav-link'}
          >
            My Redemptions
          </Link>
        )}

        {user?.role === 'partner' && (
          <Link
            to="/admin/create-reward"
            className={isActive('/admin/create-reward') ? 'nav-link active' : 'nav-link'}
          >
            Create Reward
          </Link>
        )}

        {user?.role === 'admin' && (
          <>
           

            <Link
              to="/admin/pending-rewards"
              className={isActive('/admin/pending-rewards') ? 'nav-link active' : 'nav-link'}
            >
              Pending Rewards
            </Link>

            <Link
              to="/admin/reports"
              className={isActive('/admin/reports') ? 'nav-link active' : 'nav-link'}
            >
              Review Queue
            </Link>

            <Link
              to="/admin/fraud-report"
              className={isActive('/admin/fraud-report') ? 'nav-link active' : 'nav-link'}
            >
              Fraud Report
            </Link>

            <Link
              to="/admin/analytics"
              className={isActive('/admin/analytics') ? 'nav-link active' : 'nav-link'}
            >
              Analytics
            </Link>
          </>
        )}

        {user && (
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}

export default Navbar;