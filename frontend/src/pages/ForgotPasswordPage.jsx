import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
import * as authApi from '../api/authApi';
import toast from 'react-hot-toast';
import styles from './AuthPage.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authApi.forgotPassword({ email });
      setSent(true);
      toast.success('Reset OTP sent!');
      if (data.data?.requiresOtp) {
        navigate(`/auth/otp?email=${encodeURIComponent(email)}&purpose=reset-password`, { replace: true });
      }
    }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setLoading(false);
  };

  return (
    <div className={styles.page} style={{ gridTemplateColumns: '1fr' }}>
      <div className={styles.right}>
        <form className={styles.form} onSubmit={handleSubmit} style={{ maxWidth: 420, margin: '0 auto' }}>
          <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-6)' }}><FiArrowLeft /> Back to login</Link>
          <h2>Forgot Password</h2>
          <p className={styles.formSubtitle}>Enter your email and we’ll send you a 6-digit reset OTP.</p>
          {sent ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'rgba(16,185,129,0.1)', borderRadius: 'var(--radius-lg)' }}>
              <p style={{ color: '#10b981', fontWeight: 600 }}>✅ Reset OTP sent to {email}</p>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>Check your email inbox.</p>
            </div>
          ) : (
            <>
              <div className={styles.inputGroup}><FiMail className={styles.inputIcon} /><input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required /></div>
              <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? 'Sending...' : 'Send Reset OTP'}</button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
