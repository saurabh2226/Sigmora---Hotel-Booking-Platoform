import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

/**
 * Stress Test — Find the breaking point
 * Ramps to 500 VUs to identify system limits
 */
export const options = {
  stages: [
    { duration: '1m', target: 50 },     // Below normal load
    { duration: '2m', target: 100 },    // Normal load
    { duration: '2m', target: 200 },    // Around expected peak
    { duration: '2m', target: 300 },    // Beyond expected peak
    { duration: '2m', target: 500 },    // Stress level — find the limit
    { duration: '2m', target: 500 },    // Hold at stress level
    { duration: '2m', target: 0 },      // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],   // Relaxed: 95% under 2s
    errors: ['rate<0.1'],                // Allow up to 10% errors
    http_req_failed: ['rate<0.1'],       // Less than 10% failures
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  // Mix of API calls simulating real user patterns
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/health`],
    ['GET', `${BASE_URL}/api/v1/hotels?page=1&limit=12`],
    ['GET', `${BASE_URL}/api/v1/hotels/featured`],
  ]);

  responses.forEach((res, idx) => {
    const passed = check(res, {
      [`batch[${idx}] status is 200`]: (r) => r.status === 200,
      [`batch[${idx}] response time < 2s`]: (r) => r.timings.duration < 2000,
    });
    if (!passed) errorRate.add(1);
  });

  sleep(Math.random() * 2 + 0.5); // Random sleep 0.5-2.5s
}
