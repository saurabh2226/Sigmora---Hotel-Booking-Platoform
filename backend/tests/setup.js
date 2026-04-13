// Environment variable setup — runs before Jest framework loads
// This file is referenced by jest config "setupFiles"
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_key_for_testing';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_for_testing';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.PORT = '5001';
process.env.RAZORPAY_KEY_ID = 'rzp_test_backend_suite';
process.env.RAZORPAY_KEY_SECRET = 'razorpay_backend_suite';
process.env.RAZORPAY_WEBHOOK_SECRET = 'razorpay_webhook_backend_suite';
