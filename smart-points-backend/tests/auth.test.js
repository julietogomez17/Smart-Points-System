
const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = 'http://localhost:5000/api/auth/login';

async function testLogin(body, expectedStatus, expectedMessage) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const result = await response.json();

  assert.equal(response.status, expectedStatus);
  assert.equal(result.message, expectedMessage);

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);
  console.log('Error Code:', result.code);
}

test('CASE-001: Login with empty email', async () => {
  await testLogin(
    { email: '', password: 'ExamplePassword123!' },
    400,
    'Email and password are required.'
  );
});

test('CASE-002: Login with empty password', async () => {
  await testLogin(
    { email: 'test@example.com', password: '' },
    400,
    'Email and password are required.'
  );
});

test('CASE-003: Login with invalid email format', async () => {
  const response = await fetch(
    'http://localhost:5000/api/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'invalidemail',
        password: 'ExamplePassword123!'
      })
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(response.status, 400);
  assert.match(result.message, /invalid email/i);
});


test('CASE-004: Login with incorrect password', async () => {
  const response = await fetch(
    'http://localhost:5000/api/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'your_registered_email@gmail.com',
        password: 'WrongPassword123!'
      })
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(response.status, 401);
  assert.equal(result.message, 'Invalid email or password.');
});


test('CASE-005: Login with valid credentials', async () => {
  const email = process.env.TEST_LOGIN_EMAIL;
  const password = process.env.TEST_LOGIN_PASSWORD;

  assert.ok(email, 'Set TEST_LOGIN_EMAIL before testing.');
  assert.ok(password, 'Set TEST_LOGIN_PASSWORD before testing.');

  const response = await fetch(
    'http://localhost:5000/api/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(response.status, 200);
  assert.equal(result.message, 'Login successful.');
  assert.ok(result.token, 'Authentication token was not returned.');
  assert.ok(result.user?.user_id, 'User ID was not returned.');
});


test('CASE-006: Login with unverified email', async () => {
  const email = process.env.TEST_UNVERIFIED_EMAIL;
  const password = process.env.TEST_UNVERIFIED_PASSWORD;

  assert.ok(email, 'Set TEST_UNVERIFIED_EMAIL.');
  assert.ok(password, 'Set TEST_UNVERIFIED_PASSWORD.');

  const response = await fetch(
    'http://localhost:5000/api/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(response.status, 403);
  assert.equal(
    result.message,
    'Please verify your email address before logging in.'
  );
  assert.equal(result.code, 'EMAIL_NOT_VERIFIED');
});

// =====================================================
// CASE-007: Forgot Password with Empty Email
// =====================================================

test('CASE-007: Forgot password with empty email', async () => {
  const response = await fetch(
    'http://localhost:5000/api/auth/forgot-password',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: ''
      })
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(response.status, 400);
  assert.equal(result.message, 'Enter a valid email address.');
});


test('CASE-008: Forgot password with invalid email format', async () => {
  const response = await fetch(
    'http://localhost:5000/api/auth/forgot-password',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'invalidemail123'
      })
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(response.status, 400);
  assert.equal(result.message, 'Enter a valid email address.');
});


test('CASE-009: Forgot password with registered email', async () => {
  const email = process.env.TEST_LOGIN_EMAIL;

  assert.ok(email, 'Set TEST_LOGIN_EMAIL before testing.');

  const response = await fetch(
    'http://localhost:5000/api/auth/forgot-password',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(response.status, 200);
 
assert.equal(
  result.message,
  'If an account exists with this email, a password reset code will be sent.'
);

});


test('CASE-010: Forgot password with incorrect OTP', async () => {
  const response = await fetch(
    'http://localhost:5000/api/auth/verify-reset-otp',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'YOUR_REGISTERED_EMAIL@gmail.com',
        otp: '000000'
      })
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(response.status, 400);
 assert.match(
  result.message,
  /invalid|incorrect|expired/i
);
  assert.equal(result.resetToken, undefined);
});


test('CASE-011: Forgot password with valid OTP and successful reset', async () => {
  const readline = require('node:readline/promises');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let email;
  let otp;
  let newPassword;

  try {
    email = (await rl.question('Enter registered test email: ')).trim();
    otp = (await rl.question('Enter the latest 6-digit OTP: ')).trim();
    newPassword = await rl.question('Enter NEW password (at least 12 characters): ');
  } finally {
    rl.close();
  }

  assert.match(email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  assert.match(otp, /^\d{6}$/);
  assert.ok(newPassword.length >= 12, 'Password must have at least 12 characters.');
  assert.ok(Buffer.byteLength(newPassword, 'utf8') <= 72);

  // Step 1: Verify the OTP.
  const verifyResponse = await fetch(
    'http://localhost:5000/api/auth/verify-reset-otp',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    }
  );

  const verifyResult = await verifyResponse.json();

  
console.log('OTP Verification:', verifyResult.message);
console.log('OTP HTTP Status:', verifyResponse.status);

if (verifyResponse.status !== 200) {
  console.log('OTP Verification Failed:', verifyResult.message);
}

assert.equal(
  verifyResponse.status,
  200,
  `OTP verification failed: ${verifyResult.message}`
);

  assert.equal(verifyResult.message, 'Code verified successfully.');
  assert.equal(verifyResult.success, true);
  assert.match(verifyResult.resetToken, /^[a-f0-9]{64}$/i);

  // Step 2: Reset the password using the authorization token.
  const resetResponse = await fetch(
    'http://localhost:5000/api/auth/reset-password',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resetToken: verifyResult.resetToken,
        newPassword
      })
    }
  );

  const resetResult = await resetResponse.json();

  console.log('Password Reset:', resetResult.message);
  console.log('Reset HTTP Status:', resetResponse.status);

  assert.equal(resetResponse.status, 200);
  assert.equal(resetResult.message, 'Password reset successfully.');
  assert.equal(resetResult.success, true);

  // Step 3: Confirm that the new password works.
  const loginResponse = await fetch(
    'http://localhost:5000/api/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: newPassword
      })
    }
  );

  const loginResult = await loginResponse.json();

  console.log('Login Verification:', loginResult.message);
  console.log('Login HTTP Status:', loginResponse.status);

  assert.equal(loginResponse.status, 200);
  assert.equal(loginResult.message, 'Login successful.');
  assert.ok(loginResult.token, 'Authentication token is missing.');
});


test('CASE-012: Registration with empty required fields', async () => {
  const form = new FormData();

  // Valid role, but all required personal fields are empty.
  form.append('role', 'community_member');
  form.append('first_name', '');
  form.append('last_name', '');
  form.append('email', '');
  form.append('phone', '');
  form.append('password', '');
  form.append('date_of_birth', '');

  const response = await fetch(
    'http://localhost:5000/api/auth/register',
    {
      method: 'POST',
      body: form
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(response.status, 400);
  assert.equal(
    result.message,
    'Complete all required personal information.'
  );
});


test('CASE-013: Registration with invalid email format', async () => {
  const form = new FormData();

  form.append('role', 'community_member');
  form.append('first_name', 'Test');
  form.append('last_name', 'Citizen');
  form.append('email', 'invalidemail');
  form.append('phone', '09123456789');
  form.append('password', 'TestPassword123!');
  form.append('date_of_birth', '2000-01-01');

  const response = await fetch(
    'http://localhost:5000/api/auth/register',
    {
      method: 'POST',
      body: form
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(response.status, 400);
  assert.equal(result.message, 'Invalid email address.');
});


test('CASE-014: Registration with invalid Philippine mobile number', async () => {
  const form = new FormData();

  form.append('role', 'community_member');
  form.append('first_name', 'Test');
  form.append('last_name', 'Citizen');
  form.append('email', 'testcitizen@example.com');
  form.append('phone', '12345');
  form.append('password', 'TestPassword123!');
  form.append('date_of_birth', '2000-01-01');

  const response = await fetch(
    'http://localhost:5000/api/auth/register',
    {
      method: 'POST',
      body: form
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(response.status, 400);
  assert.equal(
    result.message,
    'Enter a valid Philippine mobile number.'
  );
});


test('CASE-015: Registration with password below minimum length', async () => {
  const form = new FormData();

  form.append('role', 'community_member');
  form.append('first_name', 'Test');
  form.append('last_name', 'Citizen');
  form.append('email', 'testcitizen@example.com');
  form.append('phone', '09123456789');

  // Invalid password: fewer than 8 characters
  form.append('password', '12345');

  form.append('date_of_birth', '2000-01-01');

  const response = await fetch(
    'http://localhost:5000/api/auth/register',
    {
      method: 'POST',
      body: form
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(response.status, 400);
  assert.equal(
    result.message,
    'Password must contain at least 8 characters.'
  );
});


test('CASE-016: Registration with missing date of birth', async () => {
  const form = new FormData();

  form.append('role', 'community_member');
  form.append('first_name', 'Test');
  form.append('last_name', 'Citizen');
  form.append('email', 'testcitizen@example.com');
  form.append('phone', '09123456789');
  form.append('password', 'TestPassword123!');
  form.append('date_of_birth', '');

  const response = await fetch(
    'http://localhost:5000/api/auth/register',
    {
      method: 'POST',
      body: form
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(response.status, 400);
  assert.equal(
    result.message,
    'A valid date of birth is required.'
  );
});


test('CASE-017: Registration with future date of birth', async () => {
  const form = new FormData();

  // Generate tomorrow's date in local time.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const futureDate = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, '0'),
    String(tomorrow.getDate()).padStart(2, '0')
  ].join('-');

  form.append('role', 'community_member');
  form.append('first_name', 'Test');
  form.append('last_name', 'Citizen');
  form.append('email', 'testcitizen@example.com');
  form.append('phone', '09123456789');
  form.append('password', 'TestPassword123!');
  form.append('date_of_birth', futureDate);

  const response = await fetch(
    'http://localhost:5000/api/auth/register',
    {
      method: 'POST',
      body: form
    }
  );

  const result = await response.json();

  console.log('Test Date of Birth:', futureDate);
  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(response.status, 400);
  assert.equal(
    result.message,
    'Enter a valid date of birth that is not in the future.'
  );
});


test('CASE-017: Registration with invalid barangay', async () => {
  const form = new FormData();

  form.append('role', 'community_member');
  form.append('first_name', 'Test');
  form.append('last_name', 'Citizen');
  form.append('email', 'testcitizen@example.com');
  form.append('phone', '09123456789');
  form.append('password', 'TestPassword123!');
  form.append('date_of_birth', '2000-01-01');

form.append('address', '123 Test Street, Mandaue City, Cebu');


  // Barangay that does not belong to Mandaue City
  form.append('barangay', 'InvalidBarangay123');

  const response = await fetch(
    'http://localhost:5000/api/auth/register',
    {
      method: 'POST',
      body: form
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(
    response.status,
    400,
    `Expected HTTP 400, received ${response.status}: ${JSON.stringify(result)}`
  );

  assert.match(
    result.message || '',
    /barangay/i,
    'Expected an error message specifically about the invalid barangay.'
  );
});


test('CASE-017: Registration with missing barangay', async () => {
  const form = new FormData();

  form.append('role', 'community_member');
  form.append('first_name', 'Test');
  form.append('last_name', 'Citizen');
  form.append('email', 'testcitizen@example.com');
  form.append('phone', '09123456789');
  form.append('password', 'TestPassword123!');
  form.append('date_of_birth', '2000-01-01');

  // Provide a residential address to avoid the previous error.
  form.append('address', '123 Test Street, Mandaue City, Cebu');

  // Barangay intentionally left empty.
  form.append('barangay', '');

  const response = await fetch(
    'http://localhost:5000/api/auth/register',
    {
      method: 'POST',
      body: form
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(
    response.status,
    400,
    `Expected HTTP 400, received ${response.status}: ${JSON.stringify(result)}`
  );

  assert.match(
    result.message || '',
    /barangay/i,
    'Expected an error message about the missing barangay.'
  );
});

test('CASE-018: Registration with missing ID verification document', async () => {
  const form = new FormData();

  form.append('role', 'community_member');
  form.append('first_name', 'Test');
  form.append('last_name', 'Citizen');
  form.append('email', 'testcitizen@example.com');
  form.append('phone', '09123456789');
  form.append('password', 'TestPassword123!');
  form.append('date_of_birth', '2000-01-01');
  form.append('address', 'Purok 3, Mabini Street');
  form.append('barangay', 'Alang-Alang');

  // No ID verification document is attached.

  const response = await fetch(
    'http://localhost:5000/api/auth/register',
    {
      method: 'POST',
      body: form
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(
    response.status,
    400,
    `Expected HTTP 400, received ${response.status}: ${JSON.stringify(result)}`
  );

  assert.match(
    result.message || '',
    /id|identification|document|upload|photo|proof/i,
    'Expected a validation message about the missing ID document.'
  );
});


test('CASE-019: Registration with missing ID image upload', async () => {
  const form = new FormData();

  // Valid citizen information
  form.append('role', 'community_member');
  form.append('first_name', 'Test');
  form.append('last_name', 'Citizen');
  form.append('email', 'testcitizen@example.com');
  form.append('phone', '09123456789');
  form.append('password', 'TestPassword123!');
  form.append('date_of_birth', '2000-01-01');

  // Valid residential information
  form.append('address', 'Purok 3, Mabini Street');
  form.append('barangay', 'Alang-Alang');

  // Valid government ID type
  form.append('id_type', 'national_id');

  // ID image intentionally NOT uploaded

  const response = await fetch(
    'http://localhost:5000/api/auth/register',
    {
      method: 'POST',
      body: form
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(
    response.status,
    400,
    `Expected HTTP 400, received ${response.status}: ${JSON.stringify(result)}`
  );

  assert.match(
    result.message || '',
    /id|image|photo|upload|document|verification/i,
    'Expected a validation message about the missing ID image.'
  );
});


test('CASE-020: Registration with missing back ID image', async () => {
  const form = new FormData();

  // Valid citizen information
  form.append('role', 'community_member');
  form.append('first_name', 'Test');
  form.append('last_name', 'Citizen');
  form.append('email', 'testcitizen@example.com');
  form.append('phone', '09123456789');
  form.append('password', 'TestPassword123!');
  form.append('date_of_birth', '2000-01-01');

  // Valid residential information
  form.append('address', 'Purok 3, Mabini Street');
  form.append('barangay', 'Alang-Alang');

  // Valid government ID type
  form.append('id_type', 'national_id');

  // Use a temporary test image, not a real government ID.
  const fs = require('node:fs');
  const path = require('node:path');

  const imagePath = path.join(__dirname, 'test-front-id.jpg');

  assert.ok(
    fs.existsSync(imagePath),
    'Place test-front-id.jpg inside the tests folder first.'
  );

  const imageBuffer = fs.readFileSync(imagePath);

  form.append(
    'id_front',
    new Blob([imageBuffer], { type: 'image/jpeg' }),
    'test-front-id.jpg'
  );

  // Back ID image intentionally NOT uploaded.

  const response = await fetch(
    'http://localhost:5000/api/auth/register',
    {
      method: 'POST',
      body: form
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(
    response.status,
    400,
    `Expected HTTP 400, received ${response.status}: ${JSON.stringify(result)}`
  );

  assert.equal(
    result.message,
    'A valid back ID document is required.'
  );
});


test('CASE-021: Registration with identical front and back ID images', async () => {
  const fs = require('node:fs');
  const path = require('node:path');

  const imagePath = path.join(__dirname, 'test-front-id.jpg');

  assert.ok(
    fs.existsSync(imagePath),
    'The test-front-id.jpg fixture must exist in the tests folder.'
  );

  const imageBuffer = fs.readFileSync(imagePath);

  const form = new FormData();

  // Citizen registration information
  form.append('role', 'community_member');
  form.append('first_name', 'Test');
  form.append('last_name', 'Citizen');
  form.append('email', 'testcitizen@example.com');
  form.append('phone', '09123456789');
  form.append('password', 'TestPassword123!');
  form.append('date_of_birth', '2000-01-01');

  // Residential information
  form.append('address', 'Purok 3, Mabini Street');
  form.append('barangay', 'Alang-Alang');

  // Accepted government ID type
  form.append('id_type', 'national_id');

  // Required registration declarations
  form.append('residency_declaration', 'true');
  form.append('privacy_acknowledgment', 'true');


  // Upload the exact same image bytes for both sides.
  form.append(
    'id_front',
    new Blob([imageBuffer], { type: 'image/jpeg' }),
    'front-test.jpg'
  );

  form.append(
    'id_back',
    new Blob([imageBuffer], { type: 'image/jpeg' }),
    'back-test.jpg'
  );

  const response = await fetch(
    'http://localhost:5000/api/auth/register',
    {
      method: 'POST',
      body: form
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(
    response.status,
    400,
    `Expected HTTP 400, received ${response.status}: ${JSON.stringify(result)}`
  );

  assert.match(
    result.message || '',
    /same|identical|duplicate|different|front.*back|back.*front/i,
    'Expected an error specifically about identical front and back ID images.'
  );
});


test('CASE-022: Registration with duplicate email address', async () => {
  const fs = require('node:fs');
  const path = require('node:path');

  const existingEmail = process.env.TEST_EXISTING_EMAIL;

  assert.ok(
    existingEmail,
    'Set TEST_EXISTING_EMAIL to an email already registered in CitiPoints.'
  );

  const imagePath = path.join(__dirname, 'test-front-id.jpg');

  assert.ok(
    fs.existsSync(imagePath),
    'Place test-front-id.jpg inside the tests folder.'
  );

  const imageBuffer = fs.readFileSync(imagePath);

  const form = new FormData();

  // Valid citizen registration information
  form.append('role', 'community_member');
  form.append('first_name', 'Duplicate');
  form.append('last_name', 'Emailtest');
  form.append('email', existingEmail);
  form.append('phone', '09123456789');
  form.append('password', 'TestPassword123!');
  form.append('date_of_birth', '2000-01-01');

  // Residential information
  form.append('address', 'Purok 3, Mabini Street');
  form.append('barangay', 'Alang-Alang');

  // Government ID information
  form.append('id_type', 'national_id');

  // Required declarations
  form.append('residency_declaration', 'true');
  form.append('privacy_acknowledgment', 'true');

  // Different image content is required for this test.
  const backImagePath = path.join(__dirname, 'test-back-id.jpg');

  assert.ok(
    fs.existsSync(backImagePath),
    'Place test-back-id.jpg inside the tests folder.'
  );

  const backImageBuffer = fs.readFileSync(backImagePath);

  assert.notDeepEqual(
    imageBuffer,
    backImageBuffer,
    'Front and back test images must be different.'
  );

  form.append(
    'id_front',
    new Blob([imageBuffer], { type: 'image/jpeg' }),
    'front-test.jpg'
  );

  form.append(
    'id_back',
    new Blob([backImageBuffer], { type: 'image/jpeg' }),
    'back-test.jpg'
  );

  const response = await fetch(
    'http://localhost:5000/api/auth/register',
    {
      method: 'POST',
      body: form
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.ok(
    [400, 409].includes(response.status),
    `Expected HTTP 400 or 409, received ${response.status}: ${JSON.stringify(result)}`
  );

  assert.match(
    result.message || '',
    /email.*(already|exist|registered|taken|used)|duplicate.*email/i,
    'Expected an error specifically about a duplicate email address.'
  );
});

test('CASE-023: Registration with invalid name format', async () => {
  const fs = require('node:fs');
  const path = require('node:path');

  const frontPath = path.join(__dirname, 'test-front-id.jpg');
  const backPath = path.join(__dirname, 'test-back-id.jpg');

  assert.ok(fs.existsSync(frontPath), 'Front test image is missing.');
  assert.ok(fs.existsSync(backPath), 'Back test image is missing.');

  const frontBuffer = fs.readFileSync(frontPath);
  const backBuffer = fs.readFileSync(backPath);

  const form = new FormData();

  // Intentionally invalid first name
  form.append('role', 'community_member');
  form.append('first_name', 'John123');
  form.append('last_name', 'Citizen');

  // Other registration information
  form.append('email', 'invalidname-test@example.com');
  form.append('phone', '09123456789');
  form.append('password', 'TestPassword123!');
  form.append('date_of_birth', '2000-01-01');

  // Valid residential information
  form.append('address', 'Purok 3, Mabini Street');
  form.append('barangay', 'Alang-Alang');

  // Valid ID type
  form.append('id_type', 'national_id');

  // Required declarations
  form.append('residency_declaration', 'true');
  form.append('privacy_acknowledgment', 'true');

  // Two different dummy ID images
  form.append(
    'id_front',
    new Blob([frontBuffer], { type: 'image/jpeg' }),
    'front-test.jpg'
  );

  form.append(
    'id_back',
    new Blob([backBuffer], { type: 'image/jpeg' }),
    'back-test.jpg'
  );

  const response = await fetch(
    'http://localhost:5000/api/auth/register',
    {
      method: 'POST',
      body: form
    }
  );

  const result = await response.json();

  console.log('Actual Result:', result.message);
  console.log('HTTP Status:', response.status);

  assert.equal(
    response.status,
    400,
    `Expected HTTP 400, received ${response.status}: ${JSON.stringify(result)}`
  );

  assert.match(
    result.message || '',
    /name|letters|alphabet|characters|invalid/i,
    'Expected an error specifically about the invalid name.'
  );
});
