import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';
import * as authApi from '../api/authApi';
import toast from 'react-hot-toast';
import styles from './AuthPage.module.css';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const resetSessionToken = searchParams.get('session') || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      if (resetSessionToken) {
        await authApi.resetPasswordWithSession({ sessionToken: resetSessionToken, password: form.password });
      } else {
        await authApi.resetPassword(token, { password: form.password });
      }
      toast.success('Password reset!');
      navigate('/', { replace: true });
    }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setLoading(false);
  };

  return (
    <div className={styles.page} style={{ gridTemplateColumns: '1fr' }}>
      <div className={styles.right}>
        <form className={styles.form} onSubmit={handleSubmit} style={{ maxWidth: 420, margin: '0 auto' }}>
          <h2>Reset Password</h2>
          <p className={styles.formSubtitle}>Enter your new password below to finish the reset flow.</p>
          <div className={styles.inputGroup}><FiLock className={styles.inputIcon} /><input type="password" placeholder="New password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} /></div>
          <div className={styles.inputGroup}><FiLock className={styles.inputIcon} /><input type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} required /></div>
          <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</button>
        </form>
      </div>
    </div>
  );
}
