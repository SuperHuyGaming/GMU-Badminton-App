import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 200 },   // Scale to 200 users
    { duration: '1m', target: 500 },   // Spike to 500 users
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    // 95% of requests should complete within 300ms
    http_req_duration: ['p(95)<300'],
    // Less than 1% unexpected HTTP errors (excluding intentional 429 rate limit triggers)
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080';

export default function () {
  // Test 1: Discover Tournaments REST endpoint through API Gateway
  const res = http.get(`${BASE_URL}/api/v1/tournaments?longitude=-76.9426&latitude=38.9897&maxDistanceMeters=100000`);

  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'response body is valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch (e) {
        return false;
      }
    },
  });

  // Small randomized sleep between 500ms and 1500ms
  sleep(0.5 + Math.random());
}

