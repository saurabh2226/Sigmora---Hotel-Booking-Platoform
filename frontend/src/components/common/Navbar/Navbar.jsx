<Link to="/" className={styles.logo} onClick={handleNavClick}>
  <span className={styles.logoIcon}>◐</span>
  <span className={styles.logoText}>
    Sig<span className={styles.logoAccent}>mora</span>
  </span>
</Link>

<div className={`${styles.navLinks} ${isAdmin ? styles.navLinksDense : ''} ${mobileOpen ? styles.open : ''}`}>
  {navLinks.map((item) => (
    <Link
      key={item.to}
      to={item.to}
      className={`${styles.navLink} ${isAdmin ? styles.navLinkCompact : ''}`}
      onClick={handleNavClick}
    >
      {item.label}
    </Link>
  ))}

  {!isAuthenticated && mobileOpen && (
    <div className={styles.mobileAuth}>
      <Link to="/login" className={styles.loginBtn} onClick={handleNavClick}>
        Login
      </Link>
      <Link to="/register" className={styles.registerBtn} onClick={handleNavClick}>
        Register
      </Link>
    </div>
  )}
</div>