import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const hotelListTrend = new Trend('hotel_list_duration');
const loginTrend = new Trend('login_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },    // Warm up: ramp to 10 users
    { duration: '1m', target: 50 },     // Ramp up to 50 users
    { duration: '2m', target: 100 },    // Hold at 100 users
    { duration: '30s', target: 50 },    // Scale down
    { duration: '30s', target: 0 },     // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],   // 95% under 500ms, 99% under 1s
    errors: ['rate<0.01'],                             // Error rate < 1%
    hotel_list_duration: ['p(95)<400'],                // Hotel listing under 400ms
    login_duration: ['p(95)<600'],                     // Login under 600ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const LOGIN_EMAIL = __ENV.LOGIN_EMAIL || 'user1@test.com';
const LOGIN_PASSWORD = __ENV.LOGIN_PASSWORD || 'User@123';

// Setup: Use a verified seeded user so OTP registration does not block load tests
export function setup() {
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    email: LOGIN_EMAIL,
    password: LOGIN_PASSWORD,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const body = JSON.parse(loginRes.body || '{}');
  if (loginRes.status !== 200 || !body.data?.accessToken) {
    throw new Error(`Unable to log in seeded user for load tests. Status: ${loginRes.status}`);
  }

  return {
    accessToken: body.data.accessToken,
    email: LOGIN_EMAIL,
    password: LOGIN_PASSWORD,
  };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.accessToken}`,
  };

  // ==========================================
  // Scenario 1: Health Check
  // ==========================================
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api/health`);
    check(res, {
      'health status 200': (r) => r.status === 200,
      'health body contains running': (r) => r.body.includes('running'),
    }) || errorRate.add(1);
  });

  sleep(0.5);

  // ==========================================
  // Scenario 2: Hotel Listing (Public, Most Common)
  // ==========================================
  group('Hotel Listing', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/hotels?page=1&limit=12`);
    hotelListTrend.add(Date.now() - start);

    check(res, {
      'hotel list status 200': (r) => r.status === 200,
      'hotel list has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && Array.isArray(body.data.hotels);
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);
  });

  sleep(0.5);

  // ==========================================
  // Scenario 3: Hotel Search with Filters
  // ==========================================
  group('Hotel Search', () => {
    const cities = ['Mumbai', 'Delhi', 'Goa', 'Bangalore', 'Jaipur'];
    const city = cities[Math.floor(Math.random() * cities.length)];

    const res = http.get(`${BASE_URL}/api/v1/hotels?city=${city}&minPrice=1000&maxPrice=10000`);
    check(res, {
      'search status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(0.5);

  // ==========================================
  // Scenario 4: Featured Hotels
  // ==========================================
  group('Featured Hotels', () => {
    const res = http.get(`${BASE_URL}/api/v1/hotels/featured`);
    check(res, {
      'featured status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(0.5);

  // ==========================================
  // Scenario 5: Login Flow
  // ==========================================
  group('Login', () => {
    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
      email: data.email,
      password: data.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
    loginTrend.add(Date.now() - start);

    check(res, {
      'login status 200': (r) => r.status === 200,
      'login has token': (r) => {
        try {
          return JSON.parse(r.body).data?.accessToken !== undefined;
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);
  });

  sleep(1);

  // ==========================================
  // Scenario 6: Authenticated - Get My Profile
  // ==========================================
  group('Get Profile', () => {
    const res = http.get(`${BASE_URL}/api/v1/auth/me`, { headers });
    check(res, {
      'profile status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(0.5);

  // ==========================================
  // Scenario 7: Popular Destinations
  // ==========================================
  group('Popular Destinations', () => {
    const res = http.get(`${BASE_URL}/api/v1/hotels/popular-destinations`);
    check(res, {
      'destinations status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);
}

export function teardown(data) {
  console.log('Load test completed. Review results above.');
}
