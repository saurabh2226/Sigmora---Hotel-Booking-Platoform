import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FiBell, FiHeart, FiHome, FiLogOut, FiMenu, FiMessageCircle, FiMoon, FiSun, FiX } from 'react-icons/fi';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../context/ThemeContext';
import { useSocket } from '../../../context/SocketContext';
import * as userApi from '../../../api/userApi';
import { logoutUser } from '../../../redux/slices/authSlice';
import { ROLE_LABELS, normalizeRole } from '../../../utils/constants';
import { getDashboardPathForRole } from '../../../utils/routeHelpers';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const userMenuRef = useRef(null);
  const notificationMenuRef = useRef(null);
  const { user, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const socket = useSocket();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const normalizedRole = normalizeRole(user?.role);

  const isAdmin = normalizedRole === 'admin';
  const dashboardLabel = isAdmin ? 'Admin Panel' : 'My Bookings';
  const dashboardLink = getDashboardPathForRole(normalizedRole);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/hotels', label: 'Hotels' },
    { to: '/about', label: 'About' },
    ...(isAuthenticated ? [{ to: '/support', label: 'Support' }] : []),
  ];

  const loadNotifications = async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const [{ data: notificationsResponse }, { data: unreadResponse }] = await Promise.all([
        userApi.getNotifications({ page: 1, limit: 6 }),
        userApi.getUnreadCount(),
      ]);
      setNotifications(notificationsResponse.data.notifications || []);
      setUnreadCount(unreadResponse.data.count || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error.message);
    }
  };

  const handleNavClick = () => {
    setMobileOpen(false);
    setDropdownOpen(false);
    setNotificationsOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogoutConfirm = async () => {
    await dispatch(logoutUser());
    setMobileOpen(false);
    setDropdownOpen(false);
    setNotificationsOpen(false);
    setShowLogoutDialog(false);
    window.location.replace('/login');
  };

  const handleToggleNotifications = () => {
    setNotificationsOpen((current) => !current);
    setDropdownOpen(false);

    if (!notificationsOpen) {
      loadNotifications();
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.isRead) {
        await userApi.markAsRead(notification._id);
        setNotifications((current) => current.map((item) => (
          item._id === notification._id ? { ...item, isRead: true } : item
        )));
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error.message);
    } finally {
      setNotificationsOpen(false);
      if (notification.link) {
        navigate(notification.link);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await userApi.markAllAsRead();
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error.message);
    }
  };

  useEffect(() => {
    if (!dropdownOpen && !notificationsOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      const clickedInsideUserMenu = userMenuRef.current?.contains(event.target);
      const clickedInsideNotifications = notificationMenuRef.current?.contains(event.target);

      if (!clickedInsideUserMenu && !clickedInsideNotifications) {
        setDropdownOpen(false);
        setNotificationsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        setNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [dropdownOpen, notificationsOpen]);

  useEffect(() => {
    loadNotifications();
  }, [isAuthenticated, user?._id]);

  useEffect(() => {
    if (!socket || !isAuthenticated) {
      return undefined;
    }

    const handleIncomingNotification = (notification) => {
      setNotifications((current) => [
        { ...notification, isRead: false },
        ...current.filter((item) => item._id !== notification._id),
      ].slice(0, 6));
      setUnreadCount((current) => current + 1);
    };

    socket.on('notification:new', handleIncomingNotification);
    return () => {
      socket.off('notification:new', handleIncomingNotification);
    };
  }, [socket, isAuthenticated]);

  return (
    <>
      <nav className={styles.navbar}>
        <div className={styles.container}>
          <Link to="/" className={styles.logo} onClick={handleNavClick}>
            <span className={styles.logoIcon}>◐</span>
            <span className={styles.logoText}>Sig<span className={styles.logoAccent}>mora</span></span>
          </Link>

          <div className={`${styles.navLinks} ${mobileOpen ? styles.open : ''}`}>
            {navLinks.map((item) => (
              <Link key={item.to} to={item.to} className={styles.navLink} onClick={handleNavClick}>
                {item.label}
              </Link>
            ))}
            {!isAuthenticated && mobileOpen && (
              <div className={styles.mobileAuth}>
                <Link to="/login" className={styles.loginBtn} onClick={handleNavClick}>Login</Link>
                <Link to="/register" className={styles.registerBtn} onClick={handleNavClick}>Register</Link>
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <button className={styles.themeToggle} onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />}
            </button>

            {isAuthenticated ? (
              <>
                <div className={styles.notificationMenu} ref={notificationMenuRef}>
                  <button
                    className={styles.notificationBtn}
                    onClick={handleToggleNotifications}
                    aria-label="Open notifications"
                    aria-haspopup="menu"
                    aria-expanded={notificationsOpen}
                  >
                    <FiBell size={18} />
                    {unreadCount > 0 && (
                      <span className={styles.notificationBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                    )}
                  </button>
                  {notificationsOpen && (
                    <div className={`${styles.dropdown} ${styles.notificationDropdown}`}>
                      <div className={styles.notificationHeader}>
                        <div>
                          <strong>Notifications</strong>
                          <small>{unreadCount} unread</small>
                        </div>
                        {notifications.length > 0 && unreadCount > 0 && (
                          <button type="button" className={styles.notificationAction} onClick={handleMarkAllAsRead}>
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className={styles.dropdownDivider} />
                      {notifications.length === 0 ? (
                        <div className={styles.notificationEmpty}>No notifications yet.</div>
                      ) : (
                        <div className={styles.notificationList}>
                          {notifications.map((notification) => (
                            <button
                              key={notification._id}
                              type="button"
                              className={`${styles.notificationItem} ${notification.isRead ? '' : styles.notificationUnread}`}
                              onClick={() => handleNotificationClick(notification)}
                            >
                              <strong>{notification.title}</strong>
                              <p>{notification.message}</p>
                              <small>{new Date(notification.createdAt).toLocaleString()}</small>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.userMenu} ref={userMenuRef}>
                  <button
                    className={styles.profileTrigger}
                    onClick={() => {
                      setDropdownOpen((current) => !current);
                      setNotificationsOpen(false);
                    }}
                    aria-haspopup="menu"
                    aria-expanded={dropdownOpen}
                  >
                    <div className={styles.avatar}>
                      {user?.avatar ? <img src={user.avatar} alt={user.name} /> : <span>{user?.name?.[0]?.toUpperCase()}</span>}
                    </div>
                    <div className={styles.profileMeta}>
                      <strong>{user?.name}</strong>
                      <span>{ROLE_LABELS[normalizedRole] || 'Guest'}</span>
                    </div>
                  </button>
                  {dropdownOpen && (
                    <div className={styles.dropdown}>
                      <div className={styles.dropdownHeader}>
                        <strong>{user?.name}</strong>
                        <small>{user?.email}</small>
                        <span className={styles.rolePill}>{ROLE_LABELS[normalizedRole] || 'Guest'}</span>
                      </div>
                      <div className={styles.dropdownDivider} />
                      <Link to={dashboardLink} className={styles.dropdownItem} onClick={handleNavClick}><FiHome size={16} /> {dashboardLabel}</Link>
                      <Link to="/support" className={styles.dropdownItem} onClick={handleNavClick}><FiMessageCircle size={16} /> Support Chat</Link>
                      <Link to="/wishlist" className={styles.dropdownItem} onClick={handleNavClick}><FiHeart size={16} /> Wishlist</Link>
                      <div className={styles.dropdownDivider} />
                      <button
                        className={styles.dropdownItem}
                        onClick={() => {
                          setDropdownOpen(false);
                          setShowLogoutDialog(true);
                        }}
                      >
                        <FiLogOut size={16} /> Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.authButtons}>
                <Link to="/login" className={styles.loginBtn} onClick={handleNavClick}>Login</Link>
                <Link to="/register" className={styles.registerBtn} onClick={handleNavClick}>Register</Link>
              </div>
            )}

            <button className={styles.hamburger} onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
              {mobileOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
          </div>
        </div>
      </nav>
      <ConfirmDialog
        isOpen={showLogoutDialog}
        title="Log out now?"
        description="You’ll be signed out of your current session. You can log back in anytime."
        confirmLabel="Logout"
        cancelLabel="Keep me signed in"
        onConfirm={handleLogoutConfirm}
        onCancel={() => setShowLogoutDialog(false)}
      />
    </>
  );
}
