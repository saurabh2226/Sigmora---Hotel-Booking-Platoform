// ===== Frontend Validation Utilities =====
// Mirrors backend validation rules for consistency

// Email validation (RFC 5322 simplified)
export const isValidEmail = (email) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email?.trim());

export const normalizePhoneInput = (phone = '') => {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }

  return digits.slice(0, 10);
};

// Indian phone number validation (+91XXXXXXXXXX or 10 digit starting with 6-9)
export const isValidPhone = (phone) =>
  /^[6-9]\d{9}$/.test(normalizePhoneInput(phone));

// Indian PIN code
export const isValidPinCode = (pin) => /^[1-9][0-9]{5}$/.test(pin);

// Name validation
export const isValidName = (name) =>
  name?.trim().length >= 2
  && name.trim().length <= 50
  && /^[a-zA-Z][a-zA-Z\s'.-]*$/.test(name.trim());

// Password strength checker with individual check results
export const isStrongPassword = (password) => {
  const checks = {
    length: password?.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  return {
    ...checks,
    score,
    strength: score <= 2 ? 'weak' : score <= 3 ? 'medium' : 'strong',
    isValid: score === 5,
  };
};

// Date validation
export const isValidDate = (date) => !isNaN(new Date(date).getTime());
export const isFutureDate = (date) => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
};
export const isCheckoutAfterCheckin = (checkIn, checkOut) => new Date(checkOut) > new Date(checkIn);
export const getMaxBookingNights = () => 30;

// Price validation
export const isValidPrice = (price) => !isNaN(price) && Number(price) >= 100 && Number(price) <= 500000;

// Coupon code validation
export const isValidCouponCode = (code) => /^[A-Z0-9]{3,20}$/.test(code?.toUpperCase());

// Rating validation
export const isValidRating = (rating) => Number.isInteger(Number(rating)) && rating >= 1 && rating <= 5;

// Generic field validator — returns first error or empty string
export const validateField = (rules, value) => {
  for (const rule of rules) {
    const error = rule(value);
    if (error) return error;
  }
  return '';
};

// Validator rule factories
export const required = (fieldName) => (value) =>
  !value || (typeof value === 'string' && !value.trim()) ? `${fieldName} is required` : '';

export const minLength = (fieldName, min) => (value) =>
  value && value.length < min ? `${fieldName} must be at least ${min} characters` : '';

export const maxLength = (fieldName, max) => (value) =>
  value && value.length > max ? `${fieldName} cannot exceed ${max} characters` : '';

export const matchField = (fieldName, matchValue) => (value) =>
  value !== matchValue ? `${fieldName} do not match` : '';
