import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiPhone, FiAlertCircle, FiCheck } from 'react-icons/fi';
import { registerUser } from '../redux/slices/authSlice';
import { getGoogleAuthUrl } from '../api/authApi';
import { getPostAuthRedirect } from '../utils/routeHelpers';
import { isValidEmail, isValidPhone, isStrongPassword, normalizePhoneInput } from '../utils/validators';
import toast from 'react-hot-toast';
import styles from './AuthPage.module.css';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading } = useSelector(s => s.auth);

  const strength = isStrongPassword(form.password);
  const strengthColors = { weak: '#ba1a1a', medium: '#f59e0b', strong: '#10b981' };
  const strengthLabels = { weak: 'Weak — add uppercase, numbers, symbols', medium: 'Fair — add more variety', strong: 'Strong password ✓' };

  const validateField = useCallback((name, value) => {
    switch (name) {
      case 'name':
        if (!value.trim()) return 'Full name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        if (value.trim().length > 50) return 'Name cannot exceed 50 characters';
        if (!/^[a-zA-Z][a-zA-Z\s'.-]*$/.test(value.trim())) return 'Name can only contain letters, spaces, apostrophes, dots, and hyphens';
        return '';
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!isValidEmail(value)) return 'Please enter a valid email address';
        return '';
      case 'phone':
        if (value && !isValidPhone(value)) return 'Enter a valid 10-digit Indian phone number';
        return '';
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Z]/.test(value)) return 'Must contain at least one uppercase letter';
        if (!/[a-z]/.test(value)) return 'Must contain at least one lowercase letter';
        if (!/\d/.test(value)) return 'Must contain at least one number';
        if (!/[!@#$%^&*]/.test(value)) return 'Must contain at least one special character (!@#$%^&*)';
        return '';
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== form.password) return 'Passwords do not match';
        return '';
      default: return '';
    }
  }, [form.password]);

  const handleChange = (name, value) => {
    const nextValue = name === 'phone' ? normalizePhoneInput(value) : value;
    setForm(prev => ({ ...prev, [name]: nextValue }));
    if (submitError) setSubmitError('');
    if (touched[name]) setErrors(prev => ({ ...prev, [name]: validateField(name, nextValue) }));
    // Re-validate confirm password when password changes
    if (name === 'password' && touched.confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: form.confirmPassword && form.confirmPassword !== nextValue ? 'Passwords do not match' : '' }));
    }
  };

  const handleBlur = (name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: validateField(name, form[name]) }));
  };

  const validateForm = () => {
    const newErrors = {};
    Object.keys(form).forEach(key => {
      const error = validateField(key, form[key]);
      if (error) newErrors[key] = error;
    });
    if (!agreed) newErrors.agreed = 'You must agree to the Terms & Conditions';
    setErrors(newErrors);
    setTouched({ name: true, email: true, phone: true, password: true, confirmPassword: true });
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }
    const result = await dispatch(registerUser({ name: form.name, email: form.email, phone: form.phone, password: form.password }));
    if (result.meta.requestStatus === 'fulfilled') {
      if (result.payload?.requiresOtp) {
        toast.success('Account created. Please verify the OTP from your email.');
        navigate(`/auth/otp?email=${encodeURIComponent(result.payload.email)}&purpose=${encodeURIComponent(result.payload.purpose || 'verify-email')}`, { replace: true });
        return;
      }

      toast.success('Account created!');
      navigate(getPostAuthRedirect(result.payload.user, '/dashboard'), { replace: true });
    }
    else {
      const message = result.payload || 'Registration failed';
      setSubmitError(message);
      toast.error(message);
    }
  };

  const handleGoogleAuth = () => {
    window.location.href = getGoogleAuthUrl('/dashboard');
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
          <span className={styles.leftLabel}>JOIN US</span>
          <h1>Sig<span className={styles.accent}>mora</span></h1>
          <p>Create your account and start exploring the best hotels across India.</p>
          <div className={styles.features}>
            <div className={styles.feature}><span>🎁</span> Exclusive member deals</div>
            <div className={styles.feature}><span>📱</span> Manage bookings easily</div>
            <div className={styles.feature}><span>💰</span> Earn rewards on every stay</div>
          </div>
        </div>
      </div>
      <div className={styles.right}>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <h2>Create Account</h2>
          <p className={styles.formSubtitle}>Fill in your details to get started.</p>

          <div className={getFieldClass('name')}>
            <FiUser className={styles.inputIcon} />
            <input name="name" type="text" placeholder="Full Name" value={form.name} onChange={e => handleChange('name', e.target.value)} onBlur={() => handleBlur('name')} required minLength={2} maxLength={50} autoComplete="name" />
            {touched.name && !errors.name && form.name && <FiCheck className={styles.validIcon} />}
            {touched.name && errors.name && <span className={styles.fieldError}><FiAlertCircle size={12} /> {errors.name}</span>}
          </div>

          <div className={getFieldClass('email')}>
            <FiMail className={styles.inputIcon} />
            <input name="email" type="email" placeholder="Email address" value={form.email} onChange={e => handleChange('email', e.target.value)} onBlur={() => handleBlur('email')} required autoComplete="email" />
            {touched.email && !errors.email && form.email && <FiCheck className={styles.validIcon} />}
            {touched.email && errors.email && <span className={styles.fieldError}><FiAlertCircle size={12} /> {errors.email}</span>}
          </div>

          <div className={getFieldClass('phone')}>
            <FiPhone className={styles.inputIcon} />
            <input name="phone" type="number" placeholder="Phone (optional)" value={form.phone} onChange={e => handleChange('phone', e.target.value)} onBlur={() => handleBlur('phone')} autoComplete="tel" inputMode="numeric" min="0" />
            {touched.phone && errors.phone && <span className={styles.fieldError}><FiAlertCircle size={12} /> {errors.phone}</span>}
          </div>

          <div className={getFieldClass('password')}>
            <FiLock className={styles.inputIcon} />
            <input name="password" type={showPass ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={e => handleChange('password', e.target.value)} onBlur={() => handleBlur('password')} required minLength={8} autoComplete="new-password" />
            <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)} aria-label="Toggle password">
              {showPass ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
            {touched.password && errors.password && <span className={styles.fieldError}><FiAlertCircle size={12} /> {errors.password}</span>}
          </div>
          {form.password && (
            <div className={styles.strengthSection}>
              <div className={styles.strengthBar}>
                <div className={styles.strengthFill} style={{ width: `${strength.score * 20}%`, background: strengthColors[strength.strength] }} />
              </div>
              <p className={styles.strengthText} style={{ color: strengthColors[strength.strength] }}>{strengthLabels[strength.strength]}</p>
              <div className={styles.strengthChecks}>
                <span className={strength.length ? styles.checkPass : styles.checkFail}>8+ characters</span>
                <span className={strength.upper ? styles.checkPass : styles.checkFail}>Uppercase</span>
                <span className={strength.lower ? styles.checkPass : styles.checkFail}>Lowercase</span>
                <span className={strength.number ? styles.checkPass : styles.checkFail}>Number</span>
                <span className={strength.special ? styles.checkPass : styles.checkFail}>Symbol</span>
              </div>
            </div>
          )}

          <div className={getFieldClass('confirmPassword')} style={{ marginTop: form.password ? 'var(--space-4)' : 0 }}>
            <FiLock className={styles.inputIcon} />
            <input name="confirmPassword" type="password" placeholder="Confirm Password" value={form.confirmPassword} onChange={e => handleChange('confirmPassword', e.target.value)} onBlur={() => handleBlur('confirmPassword')} required autoComplete="new-password" />
            {touched.confirmPassword && !errors.confirmPassword && form.confirmPassword && <FiCheck className={styles.validIcon} />}
            {touched.confirmPassword && errors.confirmPassword && <span className={styles.fieldError}><FiAlertCircle size={12} /> {errors.confirmPassword}</span>}
          </div>

          <label className={`${styles.remember} ${errors.agreed ? styles.errorText : ''}`} style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <input type="checkbox" checked={agreed} onChange={() => { setAgreed(!agreed); if (errors.agreed) setErrors(prev => ({ ...prev, agreed: '' })); }} />
            I agree to the <Link to="/about" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Terms & Conditions</Link>
          </label>
          {errors.agreed && <span className={styles.fieldError} style={{ marginTop: '-var(--space-4)', marginBottom: 'var(--space-4)' }}><FiAlertCircle size={12} /> {errors.agreed}</span>}

          {submitError && (
            <div className={styles.submitError} role="alert" aria-live="polite">
              <FiAlertCircle size={14} />
              <span>{submitError}</span>
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <><span className={styles.spinner} /> Creating account...</> : 'Create Account'}
          </button>

          <div className={styles.divider}><span>OR</span></div>
          <button type="button" className={styles.googleBtn} onClick={handleGoogleAuth}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width={20} />
            Continue with Google
          </button>
          <p className={styles.switchAuth}>Already have an account? <Link to="/login">Sign In</Link></p>
        </form>
      </div>
    </div>
  );
}
