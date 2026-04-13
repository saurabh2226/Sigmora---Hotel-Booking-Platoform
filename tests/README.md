# Testing Guide

This project now keeps the requested testing coverage in these places:

- `backend/tests/integration/`
  API functional testing with `Supertest + Jest`
  Covers auth, hotel, booking, status codes, responses, and error handling.
- `backend/tests/unit/`
  Backend unit testing with `Jest`
  Includes controller tests, middleware tests, utility tests, and service-level tests.
- `backend/tests/security/`
  OWASP-style security coverage
  Covers access control, validation, JWT handling, bcrypt hashing, headers, injection hardening, and health monitoring.
- `e2e/tests/`
  UI testing with `Playwright`
  Covers login, signup + OTP verification, hotel search/listing, booking navigation, forms, and basic UI validation.
- `load-tests/`
  Non-functional load testing with `k6`
  Covers concurrent traffic, response times, and failure thresholds.
- `tests/pytest/`
  Conceptual `pytest` examples
  Shows fixture and mocking patterns for teams that also document Python-style test strategy.

## How To Run

### 1. API Functional Testing

```bash
cd /Users/as-mac-1345/Downloads/hotel-booking-app/backend
npm run test:api
```

### 2. Backend Unit Testing

```bash
cd /Users/as-mac-1345/Downloads/hotel-booking-app/backend
npm run test:unit
```

### 3. Security / OWASP Testing

```bash
cd /Users/as-mac-1345/Downloads/hotel-booking-app/backend
npm run test:security
```

Note:
- Jest security tests run with `NODE_ENV=test`, so the global request limiter is intentionally skipped there.
- To observe rate limiting behavior itself, run the app locally and then exercise the auth/payment endpoints manually or with `k6`.

### 4. UI Testing With Playwright

```bash
cd /Users/as-mac-1345/Downloads/hotel-booking-app/e2e
npm install
npx playwright install
npm run test:ui
```

Targeted UI suites:

```bash
cd /Users/as-mac-1345/Downloads/hotel-booking-app/e2e
npm run test:auth
npm run test:hotels
npm run test:booking
```

### 5. Load Testing With k6

Seed the app first so the default verified user exists:

```bash
cd /Users/as-mac-1345/Downloads/hotel-booking-app/backend
npm run seed
```

Then run:

```bash
cd /Users/as-mac-1345/Downloads/hotel-booking-app
k6 run load-tests/k6-config.js
```

Optional custom credentials:

```bash
LOGIN_EMAIL=user1@test.com LOGIN_PASSWORD=User@123 k6 run load-tests/k6-config.js
```

Stress test:

```bash
cd /Users/as-mac-1345/Downloads/hotel-booking-app
k6 run load-tests/stress-test.js
```

### 6. Pytest Conceptual Reference

These files are documentation-style examples and are not part of the Node test runner:

```bash
cd /Users/as-mac-1345/Downloads/hotel-booking-app/tests/pytest
ls
```
