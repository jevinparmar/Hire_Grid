import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Load Test Configuration for 200-300 Concurrent Users
export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp-up to 50 users
    { duration: '1m',  target: 150 }, // Ramp-up to 150 users
    { duration: '2m',  target: 300 }, // Peak load: 300 concurrent users
    { duration: '1m',  target: 100 }, // Scale down
    { duration: '30s', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests should complete within 1000ms
    http_req_failed: ['rate<0.05'],    // Error rate under 5%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:5000/api';

export default function () {
  // Step 1: Health / Auth Ping
  const authRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'student_test@example.com',
    password: 'password123',
    isAdminLogin: false,
    deviceId: `k6_device_${__VU}`,
    deviceName: 'k6 Virtual Student'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(authRes, {
    'login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  let token = null;
  if (authRes.status === 200) {
    const body = JSON.parse(authRes.body);
    token = body.token;
  }

  const authHeaders = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
  };

  sleep(1);

  // Step 2: Fetch Available Modules
  const modulesRes = http.get(`${BASE_URL}/modules?where_moduleType==:company`, authHeaders);
  check(modulesRes, {
    'modules status is 200': (r) => r.status === 200,
  });

  sleep(2);

  // Step 3: Fetch Questions for Module
  const sampleModuleId = 'sample_module_id';
  const questionsRes = http.get(`${BASE_URL}/modules/${sampleModuleId}/questions`, authHeaders);
  check(questionsRes, {
    'questions status is 200 or 403 or 404': (r) => [200, 403, 404].includes(r.status),
  });

  sleep(3);

  // Step 4: Submit Score
  if (token) {
    const scoreRes = http.post(`${BASE_URL}/scores`, JSON.stringify({
      moduleId: sampleModuleId,
      studentId: `k6_student_${__VU}`,
      score: 85,
      isRetake: false,
      xp: 150,
      level: 2,
      rank: 'Rising Scholar'
    }), authHeaders);

    check(scoreRes, {
      'score submit status is 200 or 403': (r) => r.status === 200 || r.status === 403,
    });
  }

  sleep(2);
}
