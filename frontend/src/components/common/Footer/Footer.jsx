import { Link } from 'react-router-dom';
import { FiTwitter, FiInstagram, FiFacebook, FiMail } from 'react-icons/fi';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <span className={styles.logo}>🏨 Sig<span className={styles.accent}>mora</span></span>
            <p>Discover your perfect stay. Book unique hotels across India with best prices and verified properties.</p>
            <div className={styles.socials}>
              <Link to="/blog" aria-label="Journal"><FiTwitter /></Link>
              <Link to="/about" aria-label="About"><FiInstagram /></Link>
              <Link to="/help-center" aria-label="Help Center"><FiFacebook /></Link>
              <Link to="/contact" aria-label="Contact"><FiMail /></Link>
            </div>
          </div>
          <div className={styles.column}>
            <h4>Company</h4>
            <Link to="/about">About Us</Link>
            <Link to="/careers">Careers</Link>
            <Link to="/blog">Blog</Link>
          </div>
          <div className={styles.column}>
            <h4>Support</h4>
            <Link to="/help-center">Help Center</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/contact">Contact Us</Link>
          </div>
          <div className={styles.column}>
            <h4>Legal</h4>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/cookies">Cookie Policy</Link>
          </div>
        </div>
        <div className={styles.bottom}>
          <p>© {new Date().getFullYear()} Sigmora. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
