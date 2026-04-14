import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FiMenu, FiX, FiSun, FiMoon, FiHeart, FiLogOut, FiGrid, FiMessageCircle, FiHome } from 'react-icons/fi';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../context/ThemeContext';
import { logoutUser } from '../../../redux/slices/authSlice';
import { ROLE_LABELS, normalizeRole } from '../../../utils/constants';
import { getDashboardPathForRole } from '../../../utils/routeHelpers';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const userMenuRef = useRef(null);
  const { user, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const dispatch = useDispatch();
  const normalizedRole = normalizeRole(user?.role);

  const isAdmin = normalizedRole === 'admin';
  const dashboardLabel = isAdmin ? 'Admin Panel' : 'My Bookings';
  const dashboardLink = getDashboardPathForRole(normalizedRole);
  const adminNavLinks = [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/community', label: 'Community' },
    { to: '/admin/reports', label: 'Reports' },
    { to: '/admin/hotels', label: 'Hotels' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/bookings', label: 'Bookings' },
    { to: '/admin/reviews', label: 'Reviews' },
    { to: '/admin/offers', label: 'Offers' },
    { to: '/support', label: 'Support' },
  ];

  const defaultNavLinks = [
    { to: '/', label: 'Home' },
    { to: '/hotels', label: 'Hotels' },
    { to: '/about', label: 'About' },
    ...(isAuthenticated ? [{ to: '/support', label: 'Support' }] : []),
  ];
  const navLinks = isAdmin ? adminNavLinks : defaultNavLinks;

  const handleNavClick = () => {
    setMobileOpen(false);
    setDropdownOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogoutConfirm = async () => {
    await dispatch(logoutUser());
    setMobileOpen(false);
    setDropdownOpen(false);
    setShowLogoutDialog(false);
    window.location.replace('/login');
  };

  useEffect(() => {
    if (!dropdownOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (!userMenuRef.current?.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
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
  }, [dropdownOpen]);

  return (
    <>
      <nav className={styles.navbar}>
        <div className={styles.container}>
        <Link to="/" className={styles.logo} onClick={handleNavClick}>
          <span className={styles.logoIcon}>◐</span>
          <span className={styles.logoText}>Sig<span className={styles.logoAccent}>mora</span></span>
        </Link>

        <div className={`${styles.navLinks} ${isAdmin ? styles.navLinksDense : ''} ${mobileOpen ? styles.open : ''}`}>
          {navLinks.map((item) => (
            <Link key={item.to} to={item.to} className={`${styles.navLink} ${isAdmin ? styles.navLinkCompact : ''}`} onClick={handleNavClick}>
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
            <div className={styles.userMenu} ref={userMenuRef}>
              <button
                className={styles.profileTrigger}
                onClick={() => setDropdownOpen(!dropdownOpen)}
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
                  {isAdmin && (
                    <Link to="/admin" className={styles.dropdownItem} onClick={handleNavClick}><FiGrid size={16} /> Admin Panel</Link>
                  )}
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
