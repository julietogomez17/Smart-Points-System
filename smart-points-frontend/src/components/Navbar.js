import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(() => {
    return JSON.parse(localStorage.getItem('user'));
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notificationRef = useRef(null);
const [notifications, setNotifications] = useState([]);
const [unreadCount, setUnreadCount] = useState(0);
const [notificationLoading, setNotificationLoading] = useState(false);
const [profilePicture, setProfilePicture] = useState(null);


const [adminDisplayName, setAdminDisplayName] = useState('');

useEffect(() => {
  if (user?.role !== 'admin') {
    setAdminDisplayName('');
    return;
  }

  let cancelled = false;

  api.get('/admin/profile')
    .then((response) => {
      if (!cancelled) {
        setAdminDisplayName(
          response.data?.profile?.full_name?.trim() || ''
        );
      }
    })
    .catch(() => {
      if (!cancelled) {
        setAdminDisplayName('');
      }
    });

  return () => {
    cancelled = true;
  };
}, [user?.user_id, user?.role, location.pathname]);







useEffect(() => {
  let objectUrl = '';
  let cancelled = false;

  const loadNavbarProfilePicture = async () => {
    try {
      if (!user) {
        setProfilePicture(null);
        return;
      }

      let pictureEndpoint = null;

if (user.role === 'community_member') {
  pictureEndpoint = '/citizen/profile/picture';
} else if (user.role === 'admin') {
  pictureEndpoint = '/admin/profile/picture';
} else if (user.role === 'partner') {
  pictureEndpoint = '/partners/profile/picture';
}
      if (!pictureEndpoint) {
        setProfilePicture(null);
        return;
      }

      const response = await api.get(pictureEndpoint, {
        responseType: 'blob'
      });

      if (cancelled) return;

      objectUrl = URL.createObjectURL(response.data);
      setProfilePicture(objectUrl);

    } catch (error) {
      if (!cancelled) {
        setProfilePicture(null);
      }
    }
  };

  loadNavbarProfilePicture();

  return () => {
    cancelled = true;

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  };
}, [user, location.pathname]);


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

  // Close sidebar whenever user changes page
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
  setNotifications([]);
  setUnreadCount(0);
  setNotificationOpen(false);
}, [user?.user_id, user?.role]);

  // Prevent page scrolling while mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add('citipoints-menu-open');
    } else {
      document.body.classList.remove('citipoints-menu-open');
    }

    return () => {
      document.body.classList.remove('citipoints-menu-open');
    };
  }, [sidebarOpen]);

// =========================================================
// NOTIFICATIONS
// =========================================================
// =========================================================
// CLOSE NOTIFICATIONS WHEN CLICKING OUTSIDE
// =========================================================

useEffect(() => {
  if (!notificationOpen) return;

  const handleClickOutside = (event) => {
    if (
      notificationRef.current &&
      !notificationRef.current.contains(event.target)
    ) {
      setNotificationOpen(false);
    }
  };

  const handleEscapeKey = (event) => {
    if (event.key === 'Escape') {
      setNotificationOpen(false);
    }
  };

  document.addEventListener('pointerdown', handleClickOutside);
  document.addEventListener('keydown', handleEscapeKey);

  return () => {
    document.removeEventListener('pointerdown', handleClickOutside);
    document.removeEventListener('keydown', handleEscapeKey);
  };
}, [notificationOpen]);

const fetchNotifications = async () => {
  if (
    !user ||
    !['community_member', 'partner', 'admin', 'lgu'].includes(user.role)
  ) {
    return;
  }
  try {
    setNotificationLoading(true);

    const res = await api.get('/notifications');

    const data = res.data?.notifications || [];

    setNotifications(data);

    const unread = data.filter(
      (notification) =>
        Number(notification.is_read) === 0
    ).length;

    setUnreadCount(unread);
  } catch (error) {
    console.error(
      'Failed to load notifications:',
      error
    );
  } finally {
    setNotificationLoading(false);
  }
};

const handleNotificationClick = async (notification) => {
  try {
    if (Number(notification.is_read) === 0) {
      await api.patch(
        `/notifications/${notification.notification_id}/read`
      );

      setNotifications((current) =>
        current.map((item) =>
          item.notification_id ===
          notification.notification_id
            ? {
                ...item,
                is_read: 1,
                read_at: new Date().toISOString()
              }
            : item
        )
      );

      setUnreadCount((current) =>
        Math.max(0, current - 1)
      );
    }
  } catch (error) {
    console.error(
      'Failed to mark notification as read:',
      error
    );
  }
};

const handleMarkAllAsRead = async () => {
  try {
    await api.patch('/notifications/read-all');

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: 1
      }))
    );

    setUnreadCount(0);
  } catch (error) {
    console.error(
      'Failed to mark all notifications as read:',
      error
    );
  }
};

const toggleNotifications = async () => {
  const nextOpen = !notificationOpen;

  setNotificationOpen(nextOpen);

  if (nextOpen) {
    await fetchNotifications();
  }
};

const formatNotificationTime = (dateValue) => {
  if (!dateValue) {
    return '';
  }

  const date = new Date(dateValue);
  const now = new Date();

  const difference =
    Math.floor((now - date) / 1000);

  if (difference < 60) {
    return 'Just now';
  }

  if (difference < 3600) {
    return `${Math.floor(difference / 60)}m ago`;
  }

  if (difference < 86400) {
    return `${Math.floor(difference / 3600)}h ago`;
  }

  if (difference < 604800) {
    return `${Math.floor(difference / 86400)}d ago`;
  }

  return date.toLocaleDateString();
};

useEffect(() => {
  const userId = user?.user_id;

  if (
    !userId ||
    !['community_member', 'partner', 'admin', 'lgu'].includes(user.role)
  ) {
    return;
  }

  const loadNotifications = async () => {
    try {
      setNotificationLoading(true);

      const res = await api.get('/notifications');

      const data = res.data?.notifications || [];

      setNotifications(data);

      const unread = data.filter(
        (notification) =>
          Number(notification.is_read) === 0
      ).length;

      setUnreadCount(unread);
    } catch (error) {
      console.error(
        'Failed to load notifications:',
        error
      );
    } finally {
      setNotificationLoading(false);
    }
  };

  loadNotifications();
}, [user?.user_id, user?.role]);


  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    setUser(null);
    setSidebarOpen(false);

    window.dispatchEvent(new Event('auth-changed'));

    navigate('/');
  };

 
const getDashboardPath = () => {
  if (user?.role === 'partner') {
    return '/partner/dashboard';
  }

  if (user?.role === 'admin' || user?.role === 'lgu') {
    return '/admin/dashboard';
  }

  return '/dashboard';
};


const dashboardPath = getDashboardPath();
  const isActive = (path) => {
    return location.pathname === path;
  };

  const linkClass = (path) => {
    return isActive(path)
      ? 'citipoints-side-link active'
      : 'citipoints-side-link';
  };

  if (
    location.pathname === '/' ||
    location.pathname === '/register'
  ) {
    return null;
  }

  return (
    <>
      {/* TOP HEADER */}
      <header className="citipoints-topbar">
        <div className="citipoints-topbar-left">
          <button
            type="button"
            className="citipoints-menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

       

<Link
  to={dashboardPath}
  className="citipoints-topbar-brand"
>
  <img
    src="/CitiPoints Mandaue City Logo.png"
    alt="CitiPoints Mandaue City"
    className="citipoints-topbar-logo"
  />
</Link>


        </div>

        <div className="citipoints-topbar-user">
       {['community_member', 'partner', 'admin', 'lgu'].includes(user?.role) && (
  <div
  className="citipoints-notification"
  ref={notificationRef}
>
    <button
      type="button"
      className="citipoints-notification-button"
      onClick={toggleNotifications}
      aria-label="Notifications"
    >
      <span className="citipoints-bell">🔔</span>

      {unreadCount > 0 && (
        <span className="citipoints-notification-badge">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>

    {notificationOpen && (
      <div className="citipoints-notification-dropdown">

        <div className="citipoints-notification-header">
          <div>
            <h3>Notifications</h3>

            <span>
              {unreadCount > 0
                ? `${unreadCount} unread`
                : 'No unread notifications'}
            </span>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="citipoints-mark-all"
            >
              Mark all as read
            </button>
          )}
        </div>

        <div className="citipoints-notification-list">

          {notificationLoading ? (
            <div className="citipoints-notification-empty">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="citipoints-notification-empty">
              <span className="citipoints-empty-bell">
                🔔
              </span>

              <strong>No notifications yet</strong>

              <p>
                Your CitiPoints updates will appear here.
              </p>
            </div>
          ) : (
           notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.notification_id}
                  className={`citipoints-notification-item ${
                    Number(notification.is_read) === 0
                      ? 'unread'
                      : ''
                  }`}
                  onClick={() =>
                    handleNotificationClick(notification)
                  }
                >
                  <div className="citipoints-notification-icon">
                    {notification.type === 'participation'
                      ? '✓'
                      : notification.type === 'points'
                      ? '★'
                      : notification.type === 'redemption'
                      ? '◇'
                      : notification.type === 'reward'
                      ? '◆'
                      : notification.type === 'rank'
                      ? '♛'
                      : '🔔'}
                  </div>

                  <div className="citipoints-notification-content">
                    <div className="citipoints-notification-title-row">
                      <strong>
                        {notification.title}
                      </strong>

                      {Number(notification.is_read) === 0 && (
                        <span className="citipoints-unread-dot" />
                      )}
                    </div>

                    <p>{notification.message}</p>

                    <span className="citipoints-notification-time">
                      {formatNotificationTime(
                        notification.created_at
                      )}
                    </span>
                  </div>
                </button>
              ))
          )}

        </div>

     

      </div>
    )}
  </div>
)}

      
<div className="citipoints-user-avatar">
  {profilePicture ? (
    <img
      src={profilePicture}
      alt="Profile"
      className="citipoints-user-avatar-image"
    />
  ) : (
    (user?.role === 'admin'
      ? adminDisplayName
      : user?.full_name
    )?.trim()?.charAt(0)?.toUpperCase() || 'U'
  )}
</div>


          <div className="citipoints-user-info">
           <strong>
  {user?.role === 'admin'
    ? adminDisplayName || 'Administrator'
    : user?.full_name || 'User'}
</strong>

            <span>
              {user?.role === 'community_member'
                ? 'Community Member'
                : user?.role === 'admin'
                ? 'Administrator'
                : user?.role === 'partner'
                ? 'Partner'
                : user?.role || ''}
            </span>
          </div>
        </div>
      </header>

      {/* DARK OVERLAY */}
      <div
        className={`citipoints-sidebar-overlay ${
          sidebarOpen ? 'show' : ''
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* SIDEBAR */}
      <aside
        className={`citipoints-sidebar ${
          sidebarOpen ? 'open' : ''
        }`}
      >
        <div className="citipoints-sidebar-header">
       
<Link
  to={dashboardPath}
  className="citipoints-sidebar-brand"
  onClick={() => setSidebarOpen(false)}
>
  <img
    src="/CitiPoints Mandaue City Logo.png"
    alt="CitiPoints Mandaue City"
    className="citipoints-sidebar-new-logo"
  />
</Link>


          <button
            type="button"
            className="citipoints-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation menu"
          >
            ×
          </button>
        </div>

        <div className="citipoints-sidebar-content">
          {/* COMMON MENU */}
          <div className="citipoints-menu-group">
            <p className="citipoints-menu-label">MENU</p>

          {(
 
<Link
  to={dashboardPath}
  className={linkClass(dashboardPath)}
>
  <span className="citipoints-side-icon">⌂</span>
  <span>Dashboard</span>
</Link>
)}

           {user?.role !== 'admin' && user?.role !== 'lgu' && (
  <>
    <Link
      to="/activities"
      className={linkClass('/activities')}
    >
      <span className="citipoints-side-icon">▣</span>
      <span>Activities</span>
    </Link>

    <Link
      to="/rewards"
      className={linkClass('/rewards')}
    >
      <span className="citipoints-side-icon">◇</span>
      <span>Rewards</span>
    </Link>
  </>
)}
            

            
{/* COMMUNITY MEMBER */}
{/* COMMUNITY MEMBER */}
{user?.role === 'community_member' && (
  <>
    <div className="citipoints-menu-group">
      <p className="citipoints-menu-label">
        MY ACTIVITY
      </p>

      <Link
        to="/my-participation"
        className={linkClass('/my-participation')}
      >
        <span className="citipoints-side-icon">✓</span>
        <span>My Participation</span>
      </Link>

      <Link
        to="/my-redemptions"
        className={linkClass('/my-redemptions')}
      >
        <span className="citipoints-side-icon">▤</span>
        <span>My Redemptions</span>
      </Link>
      <Link
  to="/points-history"
  className={linkClass('/points-history')}
>
  <span className="citipoints-side-icon">◷</span>
  <span>Points History</span>
</Link>

<Link
  to="/leaderboard"
  className={linkClass('/leaderboard')}
>
  <span className="citipoints-side-icon">♛</span>
  <span>Leaderboard</span>
</Link>
    </div>

    <div className="citipoints-menu-group">
      <p className="citipoints-menu-label">
        ACCOUNT
      </p>

      <Link
        to="/profile"
        className={linkClass('/profile')}
      >
        <span className="citipoints-side-icon">♙</span>
        <span>My Profile</span>
      </Link>
    </div>
  </>
)}

{/* PARTNER */}
{user?.role === 'partner' && (
  <>
    <div className="citipoints-menu-group">
      <p className="citipoints-menu-label">
        MANAGEMENT
      </p>

      <Link
        to="/partner/redemptions"
        className={linkClass('/partner/redemptions')}
      >
        <span className="citipoints-side-icon">▤</span>
        <span>Redemptions</span>
      </Link>

      <Link
        to="/partner/establishment"
        className={linkClass('/partner/establishment')}
      >
        <span className="citipoints-side-icon">▦</span>
        <span>My Establishment</span>
      </Link>
    </div>

    <div className="citipoints-menu-group">
      <p className="citipoints-menu-label">
        ACCOUNT
      </p>

      <Link
        to="/partner/profile"
        className={linkClass('/partner/profile')}
      >
        <span className="citipoints-side-icon">♙</span>
        <span>My Profile</span>
      </Link>
    </div>
  </>
)}
          </div>







          {/* =========================================================
    ADMIN MENU
    ========================================================= */}

{['admin', 'lgu'].includes(user?.role) && (
  <>
    {/* MANAGEMENT */}
    <div className="citipoints-menu-group admin-menu-group">

      <p className="citipoints-menu-label">
        MANAGEMENT
      </p>

      <Link
        to="/activities"
        className={linkClass('/activities')}
      >
        <span className="citipoints-side-icon">▣</span>
        <span>Activities</span>
      </Link>

      <Link
        to="/admin/reports"
        className={linkClass('/admin/reports')}
      >
        <span className="citipoints-side-icon">✓</span>
        <span>Participation Review</span>
      </Link>

      <Link
        to="/admin/smart-points"
        className={linkClass('/admin/smart-points')}
      >
        <span className="citipoints-side-icon">◎</span>
        <span>Smart Points</span>
      </Link>

      <Link
        to="/rewards"
        className={linkClass('/rewards')}
      >
        <span className="citipoints-side-icon">◇</span>
        <span>Rewards</span>
      </Link>

      <Link
        to="/admin/redemptions"
        className={linkClass('/admin/redemptions')}
      >
        <span className="citipoints-side-icon">▤</span>
        <span>Redemptions</span>
      </Link>

    {user?.role === 'admin' && (
  <Link
    to="/admin/pending-rewards"
    className={linkClass('/admin/pending-rewards')}
  >
    <span className="citipoints-side-icon">♧</span>
    <span>Establishment</span>
  </Link>
)}

      <Link
  to="/admin/account-requests"
  className={linkClass('/admin/account-requests')}
>
  <span className="citipoints-side-icon">♙</span>
  <span>Account Requests</span>
</Link>

    </div>

    {/* MONITORING */}
    <div className="citipoints-menu-group admin-menu-group">

      <p className="citipoints-menu-label">
        MONITORING
      </p>

      <Link
        to="/admin/fraud-report"
        className={linkClass('/admin/fraud-report')}
      >
        <span className="citipoints-side-icon">!</span>
        <span>Fraud Alerts</span>
      </Link>

      <Link
        to="/admin/analytics"
        className={linkClass('/admin/analytics')}
      >
        <span className="citipoints-side-icon">▥</span>
        <span>Analytics & Reports</span>
      </Link>

{user?.role === 'admin' && (
  <Link
    to="/admin/audit-logs"
    className={linkClass('/admin/audit-logs')}
  >
    <span className="citipoints-side-icon">▤</span>
    <span>Audit Logs</span>
  </Link>
)}


    </div>

    {/* ACCOUNT */}
    <div className="citipoints-menu-group admin-menu-group">

      <p className="citipoints-menu-label">
        ACCOUNT
      </p>

      <Link
  to="/admin/profile"
  className={linkClass('/admin/profile')}
>
  <span className="citipoints-side-icon">♙</span>
  <span>My Profile</span>
</Link>

    </div>
  </>
)}

        </div>

        {/* LOGOUT */}
        <div className="citipoints-sidebar-footer">
          <button
            type="button"
            className="citipoints-logout"
            onClick={handleLogout}
          >
            <span>↪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Navbar;