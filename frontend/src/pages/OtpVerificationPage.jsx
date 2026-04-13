import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FiArrowLeft, FiMail, FiShield } from 'react-icons/fi';
import { setSession } from '../redux/slices/authSlice';
import * as authApi from '../api/authApi';
import toast from 'react-hot-toast';
import styles from './AuthPage.module.css';

export default function OtpVerificationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const email = (searchParams.get('email') || '').trim();
  const purpose = searchParams.get('purpose') || 'verify-email';
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const content = useMemo(() => {
    if (purpose === 'reset-password') {
      return {
        title: 'Verify Reset OTP',
        subtitle: 'Enter the 6-digit code sent to your email to continue resetting your password.',
        backLink: '/forgot-password',
      };
    }

    return {
      title: 'Verify Your Email',
      subtitle: 'Enter the 6-digit email OTP to activate your account and continue into Sigmora.',
      backLink: '/login',
    };
  }, [purpose]);

  const handleVerify = async (event) => {
    event.preventDefault();

    if (!email) {
      toast.error('Missing email context. Please restart the auth flow.');
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }

    try {
      setLoading(true);

      if (purpose === 'reset-password') {
        const { data } = await authApi.verifyResetPasswordOtp({ email, otp });
        toast.success('OTP verified. Please set your new password.');
        navigate(`/reset-password?session=${encodeURIComponent(data.data.resetSessionToken)}&email=${encodeURIComponent(email)}`, { replace: true });
        return;
      }

      const { data } = await authApi.verifyEmailOtp({ email, otp });
      dispatch(setSession(data.data));
      toast.success('Email verified successfully');
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error('Missing email context. Please restart the auth flow.');
      return;
    }

    try {
      setResending(true);
      await authApi.resendOtp({ email, purpose });
      toast.success('A fresh OTP has been sent');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to resend OTP');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className={styles.page} style={{ gridTemplateColumns: '1fr' }}>
      <div className={styles.right}>
        <form className={styles.form} onSubmit={handleVerify} style={{ maxWidth: 460, margin: '0 auto' }}>
          <Link to={content.backLink} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-6)' }}>
            <FiArrowLeft />
            Back
          </Link>

          <div style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 118, 110, 0.1)', color: 'var(--color-primary)', marginBottom: 'var(--space-4)' }}>
            {purpose === 'reset-password' ? <FiShield size={22} /> : <FiMail size={22} />}
          </div>

          <h2>{content.title}</h2>
          <p className={styles.formSubtitle}>{content.subtitle}</p>

          <div className={styles.inputGroup}>
            <FiShield className={styles.inputIcon} />
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
          </div>

          <div style={{ marginBottom: 'var(--space-5)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.6 }}>
            Sent to <strong>{email}</strong>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>

          <button type="button" className={styles.googleBtn} onClick={handleResend} disabled={resending} style={{ marginTop: 'var(--space-4)' }}>
            {resending ? 'Sending fresh OTP...' : 'Resend OTP'}
          </button>
        </form>
      </div>
    </div>
  );
}
