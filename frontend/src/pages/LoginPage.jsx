import { useState, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { FiMail, FiLock, FiEye, FiEyeOff, FiAlertCircle } from 'react-icons/fi';
import { loginUser } from '../redux/slices/authSlice';
import { getGoogleAuthUrl } from '../api/authApi';
import { getPostAuthRedirect } from '../utils/routeHelpers';
import { isValidEmail } from '../utils/validators';
import toast from 'react-hot-toast';
import styles from './AuthPage.module.css';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading } = useSelector(s => s.auth);
  const from = location.state?.from || '/';

  // Validate individual field
  const validateField = useCallback((name, value) => {
    switch (name) {
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!isValidEmail(value)) return 'Please enter a valid email address';
        return '';
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        return '';
      default: return '';
    }
  }, []);

  // Handle field change with live validation
  const handleChange = (name, value) => {
    setForm(prev => ({ ...prev, [name]: value }));
    if (submitError) setSubmitError('');
    if (touched[name]) {
      setErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  // Handle field blur — mark as touched and validate
  const handleBlur = (name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: validateField(name, form[name]) }));
  };

  // Full form validation
  const validateForm = () => {
    const newErrors = {};
    Object.keys(form).forEach(key => {
      const error = validateField(key, form[key]);
      if (error) newErrors[key] = error;
    });
    setErrors(newErrors);
    setTouched({ email: true, password: true });
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!validateForm()) return;
    const result = await dispatch(loginUser(form));
    if (result.meta.requestStatus === 'fulfilled') {
      if (result.payload?.requiresOtp) {
        toast.success('Please verify the OTP sent to your email');
        navigate(`/auth/otp?email=${encodeURIComponent(result.payload.email)}&purpose=${encodeURIComponent(result.payload.purpose || 'verify-email')}`, { replace: true });
        return;
      }

      toast.success('Welcome back!');
      navigate(getPostAuthRedirect(result.payload.user, from), { replace: true });
    } else {
      const message = result.payload || 'Login failed';
      setSubmitError(message);
      toast.error(message);
    }
  };

  const handleGoogleAuth = () => {
    window.location.href = getGoogleAuthUrl(from);
  };

  const getFieldClass = (name) => {
    if (!touched[name]) return styles.inputGroup;
    if (errors[name]) return `${styles.inputGroup} ${styles.inputError}`;
    return `${styles.inputGroup} ${styles.inputValid}`;
  };

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <div className={styles.leftContent}>
          <span className={styles.leftLabel}>WELCOME TO</span>
          <h1>Sig<span className={styles.accent}>mora</span></h1>
          <p>Book premium hotels across India with the best prices and verified properties.</p>
          <div className={styles.features}>
            <div className={styles.feature}><span>✨</span> 30,000+ Verified Hotels</div>
            <div className={styles.feature}><span>🔒</span> Secure End-to-End Payments</div>
            <div className={styles.feature}><span>⭐</span> Genuine Guest Reviews</div>
          </div>
        </div>
      </div>
      <div className={styles.right}>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <h2>Sign In</h2>
          <p className={styles.formSubtitle}>Welcome back! Please enter your details.</p>

          <div className={getFieldClass('email')}>
            <FiMail className={styles.inputIcon} />
            <input
              name="email"
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={e => handleChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              required
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {touched.email && errors.email && (
              <span className={styles.fieldError} id="email-error"><FiAlertCircle size={12} /> {errors.email}</span>
            )}
          </div>

          <div className={getFieldClass('password')}>
            <FiLock className={styles.inputIcon} />
            <input
              name="password"
              type={showPass ? 'text' : 'password'}
              placeholder="Password"
              value={form.password}
              onChange={e => handleChange('password', e.target.value)}
              onBlur={() => handleBlur('password')}
              required
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)} aria-label="Toggle password visibility">
              {showPass ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
            {touched.password && errors.password && (
              <span className={styles.fieldError} id="password-error"><FiAlertCircle size={12} /> {errors.password}</span>
            )}
          </div>

          {submitError && (
            <div className={styles.submitError} role="alert" aria-live="polite">
              <FiAlertCircle size={14} />
              <span>{submitError}</span>
            </div>
          )}

          <div className={styles.formActions}>
            <label className={styles.remember}><input type="checkbox" /> Remember me</label>
            <Link to="/forgot-password" className={styles.forgotLink}>Forgot password?</Link>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <><span className={styles.spinner} /> Signing in...</> : 'Sign In'}
          </button>

          <div className={styles.divider}><span>OR</span></div>

          <button type="button" className={styles.googleBtn} onClick={handleGoogleAuth}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width={20} />
            Continue with Google
          </button>

          <p className={styles.switchAuth}>Don't have an account? <Link to="/register">Sign Up</Link></p>
        </form>
      </div>
    </div>
  );
}
