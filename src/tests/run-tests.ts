import { exec, ChildProcess } from 'child_process';
import { Client } from 'pg';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import type { Pool } from 'pg';
import type { runMigrations as runMigrationsType, runAsStudent as runAsStudentType } from '../lib/db';
import type { signMagicToken as signMagicTokenType } from '../lib/auth';

let serverProcess: ChildProcess | null = null;
let PORT = 3001;
let BASE_URL = `http://localhost:${PORT}`;

let pool: Pool;
let runMigrations: typeof runMigrationsType;
let runAsStudent: typeof runAsStudentType;
let signMagicToken: typeof signMagicTokenType;

// Helper to wait for MS
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loadEnvLocal() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...parts] = trimmed.split('=');
          const val = parts.join('=').replace(/^['"]|['"]$/g, '');
          const envKey = key.trim();
          if (!process.env[envKey]) {
            process.env[envKey] = val.trim();
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to load .env.local file programmatically:', err);
  }
}

// Start the Next.js dev server
async function startServer(testDbUrl: string): Promise<void> {
  console.log(`Starting Next.js dev server on port ${PORT}...`);
  serverProcess = exec(`npx next dev -p ${PORT}`, {
    env: { 
      ...process.env, 
      PORT: String(PORT), 
      NODE_ENV: 'development',
      DATABASE_URL: testDbUrl,
      NEXT_DIST_DIR: '.next_test'
    }
  });

  serverProcess.stdout?.on('data', (data) => {
    console.log(`[Next.js Dev Server]: ${data.toString().trim()}`);
  });
  serverProcess.stderr?.on('data', (data) => {
    console.error(`[Next.js Dev Server ERROR]: ${data.toString().trim()}`);
  });

  // Wait for server to start responding
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/timeline`);
      if (res.status === 200) {
        console.log('Next.js dev server is up and running!');
        return;
      }
    } catch (err) {
      // Ignore and retry
    }
    await sleep(1000);
  }
  throw new Error('Next.js dev server failed to start in 30 seconds.');
}

// Cleanup and shutdown server
async function stopServer() {
  if (serverProcess) {
    console.log('Stopping Next.js dev server...');
    serverProcess.kill('SIGTERM');
    await sleep(2000);
  }
  
  console.log('Cleaning up all test/dummy data from database...');
  const client = await pool.connect();
  try {
    await client.query('TRUNCATE TABLE audit_logs CASCADE');
    await client.query('TRUNCATE TABLE otp_codes CASCADE');
    await client.query('TRUNCATE TABLE students CASCADE');
    await client.query('TRUNCATE TABLE degrees CASCADE');
    await client.query('TRUNCATE TABLE staff CASCADE');
    
    // Seed default administrator back so admin user exists
    await client.query(`
      INSERT INTO staff (username, name, password_hash, role)
      VALUES (
        'admin',
        'Exam Division Admin',
        '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
        'Administrator'
      )
    `);
    console.log('Database cleaned successfully.');
  } catch (err: any) {
    console.error('Failed to clean up test data:', err.message);
  } finally {
    client.release();
  }

  await pool.end();
}

async function runTests() {
  console.log('=== STARTING AUTOMATED TEST SUITE ===');

  loadEnvLocal();
  const originalDbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/reg_platform';
  
  let adminDbUrl = originalDbUrl;
  let testDbUrl = originalDbUrl;
  
  try {
    const parsed = new URL(originalDbUrl);
    parsed.pathname = '/postgres';
    adminDbUrl = parsed.toString();
    
    parsed.pathname = '/reg_platform_test';
    testDbUrl = parsed.toString();
  } catch (err) {
    console.error('Failed to parse DATABASE_URL as URL. Using defaults/fallback.');
    adminDbUrl = 'postgresql://postgres:postgres@localhost:5432/postgres';
    testDbUrl = 'postgresql://postgres:postgres@localhost:5432/reg_platform_test';
  }

  console.log('Ensuring test database exists...');
  let connected = false;
  let adminClient = new Client({ connectionString: adminDbUrl });
  try {
    await adminClient.connect();
    connected = true;
  } catch (err) {
    console.log('Failed to connect to /postgres database, trying original database URL...');
    adminClient = new Client({ connectionString: originalDbUrl });
    try {
      await adminClient.connect();
      connected = true;
    } catch (err2: any) {
      console.error('Failed to connect to database cluster:', err2.message);
      process.exit(1);
    }
  }

  if (connected) {
    try {
      const res = await adminClient.query(
        "SELECT 1 FROM pg_database WHERE datname = 'reg_platform_test'"
      );
      if (res.rows.length === 0) {
        console.log('Creating test database reg_platform_test...');
        await adminClient.query('CREATE DATABASE reg_platform_test');
        console.log('Test database created successfully.');
      } else {
        console.log('Test database reg_platform_test already exists.');
      }
    } catch (err: any) {
      console.error('Failed to check or create test database:', err.message);
      process.exit(1);
    } finally {
      await adminClient.end();
    }
  }

  process.env.DATABASE_URL = testDbUrl;
  process.env.IS_TEST_RUNNER = 'true';
  console.log(`DATABASE_URL set to test database: ${testDbUrl.replace(/:[^:@]+@/, ':****@')}`);

  console.log('Initializing database client and models...');
  const dbModule = await import('../lib/db');
  pool = dbModule.pool;
  runMigrations = dbModule.runMigrations;
  runAsStudent = dbModule.runAsStudent;

  const authModule = await import('../lib/auth');
  signMagicToken = authModule.signMagicToken;

  const dbUrl = process.env.DATABASE_URL || '';
  const isRemote = dbUrl.includes('supabase.com') || dbUrl.includes('supabase.co') || (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1'));
  const forceReset = process.env.FORCE_RESET_DB === 'true';

  if (isRemote && !forceReset) {
    console.error('\n❌ [SAFETY ABORT] The test suite was stopped to prevent data loss!');
    console.error('The active database URL appears to point to a remote/live database:');
    console.error(`  ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
    console.error('\nRunning these tests will DROP all tables and erase all student and log data.');
    console.error('If you are absolutely sure you want to reset this database and run tests, run:');
    console.error('  Windows PowerShell: $env:FORCE_RESET_DB="true"; npm run test');
    console.error('  Linux/macOS/Git Bash: FORCE_RESET_DB=true npm run test\n');
    process.exit(1);
  }

  // Reset database before testing
  console.log('Resetting database schema...');
  const client = await pool.connect();
  try {
    await client.query('DROP TABLE IF EXISTS audit_logs CASCADE');
    await client.query('DROP TABLE IF EXISTS otp_codes CASCADE');
    await client.query('DROP TABLE IF EXISTS students CASCADE');
    await client.query('DROP TABLE IF EXISTS registration_windows CASCADE');
    await client.query('DROP TABLE IF EXISTS degrees CASCADE');
    await client.query('DROP TABLE IF EXISTS staff CASCADE');
    await client.query('DROP TABLE IF EXISTS faculties CASCADE');
    await client.query('DROP TABLE IF EXISTS convocation_sessions CASCADE');
    await client.query('DROP TABLE IF EXISTS email_templates CASCADE');
  } finally {
    client.release();
  }

  await runMigrations();
  
  // Seed or update initial timeline window
  const seedClient = await pool.connect();
  try {
    await seedClient.query(
      `INSERT INTO registration_windows (open_date, close_date, convocation_year) 
       VALUES (CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '30 days', '2026')
       ON CONFLICT (convocation_year) DO UPDATE 
       SET open_date = CURRENT_TIMESTAMP - INTERVAL '1 day', 
           close_date = CURRENT_TIMESTAMP + INTERVAL '30 days',
           is_active = TRUE`
    );
  } finally {
    seedClient.release();
  }

  // Start server
  await startServer(testDbUrl);

  try {
    // ----------------------------------------------------
    // Test 1: Unit Test (Course / Degree Zod validation)
    // ----------------------------------------------------
    console.log('\n[TEST 1] Running Unit Test: Degree Zod validation...');
    const invalidDegreeRes = await fetch(`${BASE_URL}/api/degrees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'CS',
        name_en: 'Computer Science',
        // missing name_si and name_ta
        type: 'IllegalType' // illegal type
      })
    });
    
    const invalidDegreeJson = await invalidDegreeRes.json();
    if (invalidDegreeRes.status === 400 && !invalidDegreeJson.success && invalidDegreeJson.errors) {
      console.log('✓ Success: System correctly rejected illegal degree schema structure.');
    } else {
      throw new Error(`Unit Test Failed! Got: ${JSON.stringify(invalidDegreeJson)}`);
    }

    // ----------------------------------------------------
    // Test 2: Integration Test (Degree populate dropdown)
    // ----------------------------------------------------
    console.log('\n[TEST 2] Running Integration Test: Degree dropdown population...');
    
    // Add valid internal degree
    const addDegreeRes1 = await fetch(`${BASE_URL}/api/degrees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'BSc-CS',
        faculty: 'Faculty of Applied Sciences',
        degree_no: 1,
        name_en: 'BSc in Computer Science',
        name_si: 'පරිගණක විද්‍යා උපාධිය',
        name_ta: 'கணினி அறிவியல் பட்டம்',
        type: 'Internal'
      })
    });
    const deg1 = (await addDegreeRes1.json()).data;

    // Add valid external degree
    const addDegreeRes2 = await fetch(`${BASE_URL}/api/degrees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'BIT',
        faculty: 'Faculty of Social Sciences & Humanities',
        degree_no: 1,
        name_en: 'Bachelor of Information Technology',
        name_si: 'තොරතුරු තාක්ෂණ උපාධිය',
        name_ta: 'தகவல் தொழில்நுட்ப பட்டம்',
        type: 'External'
      })
    });
    const deg2 = (await addDegreeRes2.json()).data;

    // Check if GET returns both degrees immediately without reboot
    const getDegreesRes = await fetch(`${BASE_URL}/api/degrees`);
    const degreesList = (await getDegreesRes.json()).data;
    
    const hasCS = degreesList.some((d: any) => d.code === 'BSc-CS' && d.faculty === 'Faculty of Applied Sciences' && d.degree_no === 1);
    const hasBIT = degreesList.some((d: any) => d.code === 'BIT' && d.faculty === 'Faculty of Social Sciences & Humanities' && d.degree_no === 1);

    if (hasCS && hasBIT) {
      console.log('✓ Success: Degrees successfully created and immediate database population verified.');
    } else {
      throw new Error(`Integration Test Failed! Created degrees not found in list or missing new fields.`);
    }

    // ----------------------------------------------------
    // Test 3: Validation Test (Ingestion Malformed Sheet)
    // ----------------------------------------------------
    console.log('\n[TEST 3] Running Ingestion Validation Test...');
    const malformedIngestRes = await fetch(`${BASE_URL}/api/ingestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [
          {
            name_with_initials: 'A.B. Silva',
            full_name: 'Aruni Silva',
            registration_no: '2022/CS/101',
            index_no: '22001015',
            nic_no: '200112345678',
            faculty: 'Faculty of Applied Sciences',
            degree_name: 'BSc-CS',
            address: 'Colombo 7',
            contact_no: '0771234567',
            email: 'aruni@science.cmb.ac.lk',
            gpa: 'not-a-number', // Malformed GPA column
            class: 'First Class'
          },
          {
            name_with_initials: 'X.Y. Perera',
            full_name: 'Xavier Perera',
            registration_no: '2022/IS/201',
            index_no: '22002011',
            nic_no: '200187654321',
            faculty: 'Faculty of Technology',
            degree_name: 'UNKNOWN_DEGREE', // Non-existing degree validation
            address: 'Kandy',
            contact_no: '0711122334',
            email: 'invalid-email', // Malformed email
            gpa: 3.8,
            class: 'Second Upper'
          }
        ]
      })
    });

    const malformedJson = await malformedIngestRes.json();
    const row1Errors = malformedJson.results[0].errors;
    const row2Errors = malformedJson.results[1].errors;

    if (row1Errors.gpa && row2Errors.email && row2Errors.degree_name) {
      console.log('✓ Success: Malformed sheet rejected and specific offending rows/cells highlighted:');
      console.log('  Row 1 (GPA error):', row1Errors.gpa);
      console.log('  Row 2 (Email error):', row2Errors.email);
      console.log('  Row 2 (Degree error):', row2Errors.degree_name);
    } else {
      throw new Error(`Validation Test Failed! Structural errors not caught correctly: ${JSON.stringify(malformedJson)}`);
    }

    // ----------------------------------------------------
    // Test 4: Performance Test (Ingestion Batch 500 records)
    // ----------------------------------------------------
    console.log('\n[TEST 4] Running Performance Test: 500 mock student records...');
    const mockStudents: any[] = [];
    for (let i = 1; i <= 500; i++) {
      mockStudents.push({
        name_with_initials: `S.S. Student ${i}`,
        full_name: `Student Full Name ${i}`,
        registration_no: `REG/2026/${1000 + i}`,
        index_no: `INDEX-${260000 + i}`,
        nic_no: `NIC-${260000 + i}`,
        faculty: i <= 250 ? 'Faculty of Applied Sciences' : 'Faculty of Social Sciences & Humanities',
        degreeId: i <= 250 ? deg1.id : deg2.id, // BSc-CS or BIT
        address: `Student Address Line, Road ${i}`,
        contact_no: `077${String(i).padStart(7, '0')}`,
        email: `student${i}@uni.ac.lk`,
        gpa: (2.0 + (i % 200) / 100).toFixed(2), // 2.00 to 3.99
        class: i % 10 === 0 ? 'First Class' : 'General'
      });
    }

    const perfRes = await fetch(`${BASE_URL}/api/ingestion/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: mockStudents })
    });

    const perfJson = await perfRes.json();
    if (perfRes.status === 200 && perfJson.success) {
      console.log(`✓ Success: Batch insert of ${perfJson.count} students executed in ${perfJson.durationMs}ms.`);
      const threshold = isRemote ? 15000 : 2000;
      if (perfJson.durationMs > threshold) {
        throw new Error(`Performance Test Failed! DB batch execution took ${perfJson.durationMs}ms (threshold ${threshold}ms).`);
      }
    } else {
      throw new Error(`Performance Test Failed! Ingest commit failed: ${JSON.stringify(perfJson)}`);
    }

    // ----------------------------------------------------
    // Test 5: Boundary Test (Timeline & Registration window closed)
    // ----------------------------------------------------
    console.log('\n[TEST 5] Running Timeline Boundary Test...');
    
    // Obtain admin session cookie for Test 5 administrative calls
    const adminLoginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const testAdminCookieHeader = adminLoginRes.headers.get('set-cookie') || '';

    // Close the timeline window (set open to 2 days ago, close to 1 day ago)
    const closeTimelineRes = await fetch(`${BASE_URL}/api/timeline`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': testAdminCookieHeader
      },
      body: JSON.stringify({
        open_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        close_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      })
    });
    
    if (closeTimelineRes.status !== 200) {
      throw new Error(`Could not set timeline for boundary test. Status: ${closeTimelineRes.status}`);
    }

    // Attempt student login targeting mock student
    const magicTokenTest5 = signMagicToken('student1@uni.ac.lk', 'REG/2026/1001');
    const loginRes = await fetch(`${BASE_URL}/api/student/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student1@uni.ac.lk',
        registration_no: 'REG/2026/1001',
        nic_no: 'NIC-260001',
        token: magicTokenTest5
      })
    });

    if (loginRes.status === 403) {
      const loginJson = await loginRes.json();
      if (loginJson.error === 'Portal Closed') {
        console.log('✓ Success: Student login rejected with 403 Forbidden because registration window is closed.');
      } else {
        throw new Error(`Boundary Test Failed! Wrong error message: ${JSON.stringify(loginJson)}`);
      }
    } else {
      throw new Error(`Boundary Test Failed! Allowed login outside window. Status: ${loginRes.status}`);
    }

    // Attempt student login with INCORRECT registration number while portal is closed
    const loginResBadReg = await fetch(`${BASE_URL}/api/student/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student1@uni.ac.lk',
        registration_no: 'INCORRECT_REG',
        nic_no: 'NIC-260001',
        token: magicTokenTest5
      })
    });

    if (loginResBadReg.status === 401) {
      const badRegJson = await loginResBadReg.json();
      if (badRegJson.error.includes('mismatch')) {
        console.log('✓ Success: Student login rejected with 401 and credential mismatch error when invalid registration number entered while portal is closed.');
      } else {
        throw new Error(`Credential check failed! Expected mismatch error, got: ${JSON.stringify(badRegJson)}`);
      }
    } else {
      throw new Error(`Credential check failed! Status should be 401 when invalid reg no entered, got: ${loginResBadReg.status}`);
    }

    // Restore timeline window to open for remaining tests
    await fetch(`${BASE_URL}/api/timeline`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': testAdminCookieHeader
      },
      body: JSON.stringify({
        open_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
    });

    // ----------------------------------------------------
    // Test 6: Security/Penetration Test (Row-Level Security)
    // ----------------------------------------------------
    console.log('\n[TEST 6] Running RLS Security / Penetration Test...');
    
    // Acquire active session for Student 1
    const st1Email = 'student1@uni.ac.lk';
    const st1Reg = 'REG/2026/1001';
    const st1Nic = 'NIC-260001';

    // Verify credentials and capture the session cookie directly
    const magicTokenTest6 = signMagicToken(st1Email, st1Reg);
    const verifyRes = await fetch(`${BASE_URL}/api/student/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: st1Email, registration_no: st1Reg, nic_no: st1Nic, token: magicTokenTest6 })
    });

    const cookieHeader = verifyRes.headers.get('set-cookie');
    if (!cookieHeader) {
      throw new Error('Failed to acquire student session cookie.');
    }

    // Now attempt to access student 2 profile
    // Student A (student1) attempts a PATCH request targeting Student B (student2@uni.ac.lk)
    // We send the request using Student 1's cookie, but in the payload or RLS environment we try to alter student 2.
    // In our system, the endpoint uses the cookie token's email to run database queries.
    // Let's test: if we attempt to execute queries, RLS will prevent Student 1 from altering Student 2 rows because
    // runAsStudent('student1@uni.ac.lk') sets setting app.current_student_email to 'student1@uni.ac.lk'.
    // If we execute a raw database client patch manually simulating a leak, it will block.
    // Let's check: inside Next.js, the update query is:
    // UPDATE students SET full_name = 'Hacked' WHERE email = 'student2@uni.ac.lk' inside runAsStudent('student1@uni.ac.lk')
    
    const hackedCount = await runAsStudent('student1@uni.ac.lk', async (client) => {
      const hackRes = await client.query(
        "UPDATE students SET full_name = 'Hacked Name' WHERE email = 'student2@uni.ac.lk'"
      );
      return hackRes.rowCount;
    });

    if (hackedCount === 0) {
      console.log('✓ Success: Database Row-Level Security blocked Student A from modifying Student B’s row.');
    } else {
      throw new Error('Security Breach! Student A successfully modified Student B’s data under RLS simulation!');
    }

    // ----------------------------------------------------
    // Test 7: File Validation Test (Security uploads blocker)
    // ----------------------------------------------------
    console.log('\n[TEST 7] Running File Upload Security Validation Test...');
    
    // Simulate uploading a malware exe disguised as png
    const formData = new FormData();
    // Create a dummy blob representing a file
    const fileBlob = new Blob(['console.log("malware")'], { type: 'image/png' });
    formData.append('file', fileBlob, 'malware.exe.png');
    formData.append('type', 'photo');

    const uploadRes = await fetch(`${BASE_URL}/api/student/profile/upload`, {
      method: 'POST',
      headers: {
        'Cookie': cookieHeader
      },
      body: formData
    });

    const uploadJson = await uploadRes.json();
    if (uploadRes.status === 400 && uploadJson.error.includes('Security alert')) {
      console.log('✓ Success: File interceptor blocked executable payload (malware.exe.png).');
    } else {
      throw new Error(`File Validation Test Failed! Accepted invalid/malicious file: ${JSON.stringify(uploadJson)}`);
    }

    // ----------------------------------------------------
    // Test 8: Admin Authentication and Security Test
    // ----------------------------------------------------
    console.log('\n[TEST 8] Running Admin Authentication & Security Test...');
    
    // 8a. Verify administrative endpoint rejects unauthenticated request
    const unauthRes = await fetch(`${BASE_URL}/api/admin/logs`);
    if (unauthRes.status === 401) {
      console.log('✓ Success: Administrative endpoint rejected unauthenticated request.');
    } else {
      throw new Error(`Security Test Failed! Allowed unauthenticated access to /api/admin/logs. Status: ${unauthRes.status}`);
    }

    // 8b. Verify login fails with incorrect credentials
    const badLoginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
    });
    if (badLoginRes.status === 401) {
      console.log('✓ Success: Staff login correctly rejected incorrect credentials.');
    } else {
      const badLoginJson = await badLoginRes.json().catch(() => ({}));
      throw new Error(`Auth Test Failed! Allowed login with invalid credentials. Status: ${badLoginRes.status}. Error: ${JSON.stringify(badLoginJson)}`);
    }

    // 8c. Verify login succeeds with correct credentials
    const goodLoginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    const adminCookieHeader = goodLoginRes.headers.get('set-cookie');
    if (goodLoginRes.status === 200 && adminCookieHeader) {
      console.log('✓ Success: Staff login accepted valid credentials and returned admin_session cookie.');
    } else {
      throw new Error(`Auth Test Failed! Correct credentials rejected. Status: ${goodLoginRes.status}, Cookie: ${adminCookieHeader}`);
    }

    // ----------------------------------------------------
    // Test 9: Audit Log Test (Admin updates logging)
    // ----------------------------------------------------
    console.log('\n[TEST 9] Running Audit Log override verification test...');
    
    // First, student1 updates profile (request name correction, upload photo/slip, and confirms attendance)
    await fetch(`${BASE_URL}/api/student/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      body: JSON.stringify({
        name_correction_request: 'Student One Name Override',
        profile_photo_path: '/uploads/student1_photo.png',
        payment_slip_path: '/uploads/student1_slip.pdf',
        attending_convocation: true,
        attendance_confirmed: true // This locks profile!
      })
    });

    // Query student 1 details to verify they are locked
    const lockedProfileRes = await fetch(`${BASE_URL}/api/student/profile`, {
      headers: { 'Cookie': cookieHeader }
    });
    const lockedProfile = (await lockedProfileRes.json()).data;
    
    if (!lockedProfile.attendance_confirmed) {
      throw new Error('Locking failed: Attendance was not confirmed.');
    }

    // Ensure they cannot update now that profile is locked (read-only verification)
    const lockedPatchRes = await fetch(`${BASE_URL}/api/student/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      body: JSON.stringify({ name_correction_request: 'Hacked' })
    });
    
    if (lockedPatchRes.status !== 403) {
      throw new Error(`Locking verification failed: Allowed updates on locked profile. Status: ${lockedPatchRes.status}`);
    } else {
      console.log('✓ Success: Locking Mechanism verified. Profile switched to read-only on attendance confirmation.');
    }

    // Now admin reviews and approves changes (performing the name override)
    const adminReviewRes = await fetch(`${BASE_URL}/api/admin/review`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': adminCookieHeader
      },
      body: JSON.stringify({
        studentId: lockedProfile.id,
        action: 'approve'
      })
    });

    const adminReviewJson = await adminReviewRes.json();
    
    // Check if the change was logged in audit_logs
    const auditLogsRes = await pool.query(
      "SELECT * FROM audit_logs WHERE admin_id = 'admin' AND student_id = $1",
      [lockedProfile.id]
    );
    
    if (auditLogsRes.rows.length === 1 && auditLogsRes.rows[0].action_taken.includes('Name updated')) {
      console.log('✓ Success: Immutable audit log recorded with precise admin metadata.');
    } else {
      throw new Error(`Audit Log Test Failed! Log not written: ${JSON.stringify(auditLogsRes.rows)}`);
    }

    // ----------------------------------------------------
    // Test 10: Algorithmic Edge Case Test (Seating Allocation)
    // ----------------------------------------------------
    console.log('\n[TEST 10] Running Seating Allocation Algorithmic Edge Case Test...');
    
    // Clear any previous seating allocations first
    await pool.query("UPDATE students SET session_number = NULL, seat_number = NULL, certificate_number = NULL");

    // Set one student in Faculty of Applied Sciences to attending = FALSE
    const nonAttendingStudentRes = await pool.query(
      "SELECT id FROM students WHERE faculty = 'Faculty of Applied Sciences' LIMIT 1"
    );
    const nonAttendingId = nonAttendingStudentRes.rows[0].id;
    await pool.query(
      "UPDATE students SET verification_status = 'Approved', attending_convocation = TRUE"
    );
    await pool.query(
      "UPDATE students SET attending_convocation = FALSE WHERE id = $1",
      [nonAttendingId]
    );

    // Assign "Faculty of Applied Sciences" (250 students) to Session 1
    const assignFac1 = await fetch(`${BASE_URL}/api/admin/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': adminCookieHeader
      },
      body: JSON.stringify({ faculty: 'Faculty of Applied Sciences', sessionNumber: 1 })
    });
    const allocation1 = (await assignFac1.json()).data;

    // Assign "Faculty of Social Sciences & Humanities" (250 students) to Session 1
    const assignFac2 = await fetch(`${BASE_URL}/api/admin/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': adminCookieHeader
      },
      body: JSON.stringify({ faculty: 'Faculty of Social Sciences & Humanities', sessionNumber: 1 })
    });
    const allocation2 = (await assignFac2.json()).data;

    // Check that the non-attending student got NULL seat, session 1, and certificate
    const nonAttendingCheck = await pool.query(
      "SELECT seat_number, session_number, certificate_number FROM students WHERE id = $1",
      [nonAttendingId]
    );
    const naRecord = nonAttendingCheck.rows[0];

    if (naRecord.seat_number !== null) {
      throw new Error(`Expected non-attending student to have NULL seat, got: ${naRecord.seat_number}`);
    }
    if (naRecord.session_number !== 1) {
      throw new Error(`Expected non-attending student to have session 1, got: ${naRecord.session_number}`);
    }
    if (!naRecord.certificate_number) {
      throw new Error('Expected non-attending student to have a certificate number');
    }

    const seatCheck = await pool.query(
      "SELECT COUNT(*) as count FROM students WHERE faculty = 'Faculty of Applied Sciences' AND seat_number IS NOT NULL"
    );
    if (parseInt(seatCheck.rows[0].count) !== 249) {
      throw new Error(`Expected 249 attending students with seats in Faculty 1, got: ${seatCheck.rows[0].count}`);
    }

    // Check seating ranges: Faculty A should be 1-249. Faculty B should be 250-499.
    if (
      allocation1.startingSeat === 1 && allocation1.endingSeat === 249 &&
      allocation2.startingSeat === 250 && allocation2.endingSeat === 499
    ) {
      console.log(`✓ Success: Sequential seating calculations verified. Unbroken seat chain created (1-249 and 250-499) with non-attending student correctly omitted from seating but allocated session and certificate.`);
    } else {
      throw new Error(`Algorithmic Test Failed! Seating ranges: Fac1 = ${allocation1.startingSeat}-${allocation1.endingSeat}, Fac2 = ${allocation2.startingSeat}-${allocation2.endingSeat}`);
    }

    // Check certificate ranges: Faculty 1 should be 16041-16290, and Faculty 2 should be 16291-16540.
    const certsFac1 = await pool.query(
      "SELECT MIN(CAST(certificate_number AS INTEGER)) as min_cert, MAX(CAST(certificate_number AS INTEGER)) as max_cert FROM students WHERE faculty = 'Faculty of Applied Sciences' AND convocation_year = '2026'"
    );
    const certsFac2 = await pool.query(
      "SELECT MIN(CAST(certificate_number AS INTEGER)) as min_cert, MAX(CAST(certificate_number AS INTEGER)) as max_cert FROM students WHERE faculty = 'Faculty of Social Sciences & Humanities' AND convocation_year = '2026'"
    );

    if (certsFac1.rows[0].min_cert !== 20260001 || certsFac1.rows[0].max_cert !== 20260250) {
      throw new Error(`Expected Faculty 1 certificates to be 20260001-20260250, got: ${certsFac1.rows[0].min_cert}-${certsFac1.rows[0].max_cert}`);
    }
    if (certsFac2.rows[0].min_cert !== 20260251 || certsFac2.rows[0].max_cert !== 20260500) {
      throw new Error(`Expected Faculty 2 certificates to be 20260251-20260500, got: ${certsFac2.rows[0].min_cert}-${certsFac2.rows[0].max_cert}`);
    }
    console.log("✓ Success: Certificate sequential numbering verified across sessions/faculties (20260001-20260250 and 20260251-20260500).");

    // ----------------------------------------------------
    // Test 11: Asynchronous Queue Test (Certificates)
    // ----------------------------------------------------
    console.log('\n[TEST 11] Running Asynchronous Worker Queue Test...');

    // Approve the remaining students to generate certificates for all 500
    console.log('  Approving batch records in DB to enable certificate compilation...');
    await pool.query("UPDATE students SET verification_status = 'Approved'");

    const startCertTime = Date.now();
    const certTriggerRes = await fetch(`${BASE_URL}/api/admin/certificates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookieHeader
      },
      body: JSON.stringify({
        faculty: 'Faculty of Applied Sciences',
        degreeId: deg1.id
      })
    });

    const triggerDuration = Date.now() - startCertTime;
    
    if (certTriggerRes.status === 202) {
      console.log(`✓ Success: Trigger returned 202 Accepted immediately (${triggerDuration}ms) without blocking.`);
    } else {
      throw new Error(`Async Queue Test Failed! Status: ${certTriggerRes.status}, Body: ${await certTriggerRes.text()}`);
    }

    // Poll the status API until the task is completed
    console.log('  Polling worker task status...');
    let statusData: any = {};
    for (let i = 0; i < 60; i++) {
      const statRes = await fetch(`${BASE_URL}/api/admin/certificates`, {
        headers: {
          'Cookie': adminCookieHeader
        }
      });
      statusData = (await statRes.json()).data;
      
      if (statusData.status === 'completed') {
        console.log(`✓ Success: Worker thread successfully processed all ${statusData.total} certificates in background.`);
        break;
      }
      if (statusData.status === 'failed') {
        throw new Error(`Worker thread failed processing: ${statusData.error}`);
      }
      
      await sleep(1000);
    }

    if (statusData.status !== 'completed') {
      throw new Error('Worker thread timed out after 60 seconds.');
    }

    // ----------------------------------------------------
    // Test 12: Output Integrity Test (Master PDF verification)
    // ----------------------------------------------------
    console.log('\n[TEST 12] Running Master PDF Output Integrity Test...');
    const pdfRelativePath = statusData.outputPath; // relative URL, e.g. /certificates/...
    const pdfFullPath = path.join(process.cwd(), 'public', pdfRelativePath);

    if (!fs.existsSync(pdfFullPath)) {
      throw new Error(`Master PDF file does not exist at: ${pdfFullPath}`);
    }

    // Load PDF using pdf-lib
    const pdfBytes = fs.readFileSync(pdfFullPath);
    const compiledPdf = await PDFDocument.load(pdfBytes);
    const totalPages = compiledPdf.getPageCount();

    // Check that total pages = 2 * count of students (since each student gets 1 Front + 1 Back page)
    const expectedPages = 2 * statusData.total;
    if (totalPages === expectedPages) {
      console.log(`✓ Success: Duplex structure confirmed. Master PDF contains exactly ${totalPages} pages (2 pages per student).`);
    } else {
      throw new Error(`Output Integrity Test Failed! Page count = ${totalPages}, expected = ${expectedPages}`);
    }

    // ----------------------------------------------------
    // Test 13: Student Magic Link Sign-in Test
    // ----------------------------------------------------
    console.log('\n[TEST 13] Running Student Magic Link Sign-in Test...');
    
    const testEmail = 'student1@uni.ac.lk';
    const testReg = 'REG/2026/1001';
    
    // Generate valid magic link token
    const magicToken = signMagicToken(testEmail, testReg);
    
    // Attempt magic login request
    const magicLoginRes = await fetch(`${BASE_URL}/api/student/auth/magic-login?email=${encodeURIComponent(testEmail)}&token=${magicToken}`, {
      redirect: 'manual'
    });
    
    const redirectUrl = magicLoginRes.headers.get('location');
    
    if (magicLoginRes.status === 307 || magicLoginRes.status === 302) {
      if (redirectUrl && redirectUrl.includes(`/?email=${encodeURIComponent(testEmail)}`) && redirectUrl.includes('token=')) {
        console.log('✓ Success: Magic login accepted valid token, redirected to login page with prefilled email and token.');
      } else {
        throw new Error(`Magic login redirect validation failed. Redirect Location: ${redirectUrl}`);
      }
    } else {
      throw new Error(`Magic login test failed. Status: ${magicLoginRes.status}`);
    }

    // ----------------------------------------------------
    // Test 14: Restrict Unsubmitted Student Approval Test
    // ----------------------------------------------------
    console.log('\n[TEST 14] Running Restrict Unsubmitted Student Approval Test...');
    
    // Create a student who has not confirmed/submitted details
    const unconfirmedStudentEmail = 'unconfirmed@uni.ac.lk';
    const unconfirmedStudentIndex = 'INDEX-999999';
    await pool.query(
      `INSERT INTO students (index_no, registration_no, nic_no, full_name, name_with_initials, gpa, class, degree_id, faculty, email, address, contact_no, convocation_year, attendance_confirmed)
       VALUES ($1, 'REG-999999', '999999999V', 'Unconfirmed Student', 'Student U.', '3.5', 'First Class', $2, 'Faculty of Applied Sciences', $3, 'Uni Address', '0777777777', '2026', false)`,
      [unconfirmedStudentIndex, deg1.id, unconfirmedStudentEmail]
    );

    const approveUnconfirmedRes = await fetch(`${BASE_URL}/api/admin/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookieHeader
      },
      body: JSON.stringify({
        studentId: (await pool.query("SELECT id FROM students WHERE email = $1", [unconfirmedStudentEmail])).rows[0].id,
        action: 'approve'
      })
    });

    if (approveUnconfirmedRes.status === 400) {
      const json = await approveUnconfirmedRes.json();
      if (json.error && json.error.includes('Cannot approve student')) {
        console.log('✓ Success: Rejected approval request for unsubmitted student profile.');
      } else {
        throw new Error(`Unexpected error message on unsubmitted student approval: ${json.error}`);
      }
    } else {
      throw new Error(`Approval of unsubmitted student allowed! Status: ${approveUnconfirmedRes.status}`);
    }

    // ----------------------------------------------------
    // Test 15: Revoke Approval Test
    // ----------------------------------------------------
    console.log('\n[TEST 15] Running Revoke Approval Test...');
    
    // Let's create an approved student, allocate seating to them, then revoke approval
    const revokeStudentEmail = 'revoke@uni.ac.lk';
    const revokeStudentIndex = 'INDEX-888888';
    await pool.query(
      `INSERT INTO students (index_no, registration_no, nic_no, full_name, name_with_initials, gpa, class, degree_id, faculty, email, address, contact_no, convocation_year, attendance_confirmed, verification_status, attending_convocation, session_number, seat_number, certificate_number)
       VALUES ($1, 'REG-888888', '888888888V', 'Revoke Student', 'Student R.', '3.5', 'First Class', $2, 'Faculty of Applied Sciences', $3, 'Uni Address', '0777777777', '2026', true, 'Approved', true, 2, 99, 17999)`,
      [revokeStudentIndex, deg1.id, revokeStudentEmail]
    );

    const revokeStudentId = (await pool.query("SELECT id FROM students WHERE email = $1", [revokeStudentEmail])).rows[0].id;

    const revokeRes = await fetch(`${BASE_URL}/api/admin/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookieHeader
      },
      body: JSON.stringify({
        studentId: revokeStudentId,
        action: 'revoke'
      })
    });

    if (revokeRes.status === 200) {
      const revokeCheck = (await pool.query("SELECT * FROM students WHERE id = $1", [revokeStudentId])).rows[0];
      if (revokeCheck.verification_status === 'Pending Verification' &&
          revokeCheck.session_number === null &&
          revokeCheck.seat_number === null &&
          revokeCheck.certificate_number === null) {
        console.log('✓ Success: Approval revoked, verification_status reset, and seating details cleared.');
      } else {
        throw new Error(`Revoke post-state invalid: Status=${revokeCheck.verification_status}, Session=${revokeCheck.session_number}`);
      }
    } else {
      throw new Error(`Revoke request failed. Status: ${revokeRes.status}`);
    }

    console.log('\n[TEST 16] Running Student Registry Record Deletion Test...');
    
    const deleteRes = await fetch(`${BASE_URL}/api/admin/review`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookieHeader
      },
      body: JSON.stringify({
        studentId: revokeStudentId
      })
    });

    if (deleteRes.status === 200) {
      const deleteCheck = (await pool.query("SELECT * FROM students WHERE id = $1", [revokeStudentId])).rows[0];
      if (!deleteCheck) {
        console.log('✓ Success: Student registry record successfully deleted and purged from database.');
      } else {
        throw new Error('Student record still exists in the database after DELETE API request.');
      }
    } else {
      throw new Error(`Delete request failed. Status: ${deleteRes.status}`);
    }

    // ----------------------------------------------------
    // Test 17: Student Timeline Bypass Test
    // ----------------------------------------------------
    console.log('\n[TEST 17] Running Student Timeline Bypass Test...');

    // Ensure portal is closed manually first
    await pool.query("UPDATE registration_windows SET is_manually_closed = true WHERE is_active = true");

    const bypassEmail = 'bypass@uni.ac.lk';
    const bypassIndex = 'INDEX-777777';

    // Insert a student with timeline_bypass = false
    await pool.query(
      `INSERT INTO students (index_no, registration_no, nic_no, full_name, name_with_initials, gpa, class, degree_id, faculty, email, address, contact_no, convocation_year, attendance_confirmed, timeline_bypass)
       VALUES ($1, 'REG-777777', '777777777V', 'Bypass Student', 'Student B.', '3.5', 'First Class', $2, 'Faculty of Applied Sciences', $3, 'Uni Address', '0777777777', '2026', false, false)`,
      [bypassIndex, deg1.id, bypassEmail]
    );

    const bypassMagicToken = signMagicToken(bypassEmail, 'REG-777777');

    // Login should be rejected
    const blockLoginRes = await fetch(`${BASE_URL}/api/student/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: bypassEmail,
        registration_no: 'REG-777777',
        nic_no: '777777777V',
        token: bypassMagicToken
      })
    });

    if (blockLoginRes.status !== 403) {
      throw new Error(`Login was not blocked when portal is closed. Status: ${blockLoginRes.status}`);
    }

    // Grant bypass
    await pool.query("UPDATE students SET timeline_bypass = true WHERE email = $1", [bypassEmail]);

    // Login should succeed now!
    const allowLoginRes = await fetch(`${BASE_URL}/api/student/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: bypassEmail,
        registration_no: 'REG-777777',
        nic_no: '777777777V',
        token: bypassMagicToken
      })
    });

    if (allowLoginRes.status !== 200) {
      throw new Error(`Login was blocked even with timeline_bypass granted. Status: ${allowLoginRes.status}`);
    }

    const studentCookieHeader = allowLoginRes.headers.get('set-cookie');
    if (!studentCookieHeader) {
      throw new Error('Failed to retrieve student session cookie header');
    }

    // Update profile should succeed
    const updateProfileRes = await fetch(`${BASE_URL}/api/student/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': studentCookieHeader
      },
      body: JSON.stringify({
        attending_convocation: true
      })
    });

    if (updateProfileRes.status === 200) {
      console.log('✓ Success: Student successfully bypassed closed portal window using manual bypass permission.');
    } else {
      throw new Error(`Bypass profile update failed. Status: ${updateProfileRes.status}, Body: ${await updateProfileRes.text()}`);
    }

    // Reset manual closed state back for clean exit
    await pool.query("UPDATE registration_windows SET is_manually_closed = false WHERE is_active = true");

    // ----------------------------------------------------
    // Test 18: Active Year Timeline Isolation and Magic Link Extension
    // ----------------------------------------------------
    console.log('\n[TEST 18] Running Cohort Timeline Isolation and Magic Link Extension Test...');

    // 18a. Isolation: Set 2026 as active, set is_manually_closed = true
    await fetch(`${BASE_URL}/api/admin/active-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieHeader },
      body: JSON.stringify({ convocation_year: '2026' })
    });
    
    await fetch(`${BASE_URL}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieHeader },
      body: JSON.stringify({ toggle_only: true, is_manually_closed: true })
    });

    // Verify 2026 has is_manually_closed = true
    const check2026Res = await pool.query("SELECT is_manually_closed, open_date FROM registration_windows WHERE convocation_year = '2026'");
    if (check2026Res.rows[0].is_manually_closed !== true) {
      throw new Error('Failed to set 2026 manually closed override');
    }

    // 18b. Isolation: Activate a new convocation year 2027
    const act2027Res = await fetch(`${BASE_URL}/api/admin/active-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieHeader },
      body: JSON.stringify({ convocation_year: '2027' })
    });
    
    if (act2027Res.status !== 200) {
      throw new Error(`Failed to activate year 2027. Status: ${act2027Res.status}`);
    }

    // Verify 2027 has epoch dates (closed) and is_active = true
    const check2027Res = await pool.query("SELECT * FROM registration_windows WHERE convocation_year = '2027'");
    if (check2027Res.rows.length === 0) {
      throw new Error('Year 2027 registration window was not created');
    }
    const win2027 = check2027Res.rows[0];
    const epochDate = new Date(0).toISOString();
    const openDate2027 = new Date(win2027.open_date).toISOString();
    if (openDate2027 !== epochDate) {
      throw new Error(`Expected 2027 open_date to be epoch 1970-01-01, got: ${openDate2027}`);
    }
    if (win2027.is_active !== true) {
      throw new Error('Year 2027 is not marked active');
    }

    // 18c. Isolation: Switch back to 2026
    await fetch(`${BASE_URL}/api/admin/active-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieHeader },
      body: JSON.stringify({ convocation_year: '2026' })
    });

    // Verify 2026 still has is_manually_closed = true
    const check2026Again = await pool.query("SELECT is_manually_closed FROM registration_windows WHERE convocation_year = '2026'");
    if (check2026Again.rows[0].is_manually_closed !== true) {
      throw new Error('2026 is_manually_closed status was reset when switching back!');
    }
    console.log('✓ Success: Switch back to existing year successfully restored its manually closed override state.');

    // 18d. Magic Link Extension: Generate magic link while 2026 is closed
    const linkEmail = 'student1@uni.ac.lk';
    const linkReg = 'REG/2026/1001';
    const linkMagicToken = signMagicToken(linkEmail, linkReg);

    // Try to access magic login route: should fail/redirect back with error if portal is closed
    const testMagicClosedRes = await fetch(`${BASE_URL}/api/student/auth/magic-login?email=${encodeURIComponent(linkEmail)}&token=${linkMagicToken}`, {
      redirect: 'manual'
    });
    const testMagicClosedLoc = testMagicClosedRes.headers.get('location') || '';
    if (!testMagicClosedLoc.includes('error=Portal%20Closed')) {
      throw new Error(`Expected magic login to be blocked/redirected with error when portal is closed. Location: ${testMagicClosedLoc}`);
    }

    // 18e. Magic Link Extension: Extend/open the timeline for 2026 again
    await fetch(`${BASE_URL}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieHeader },
      body: JSON.stringify({ toggle_only: true, is_manually_closed: false })
    });

    // Try login again with the SAME magic link token: should now succeed (redirect with token to entry)
    const testMagicOpenRes = await fetch(`${BASE_URL}/api/student/auth/magic-login?email=${encodeURIComponent(linkEmail)}&token=${linkMagicToken}`, {
      redirect: 'manual'
    });
    const testMagicOpenLoc = testMagicOpenRes.headers.get('location') || '';
    if (!testMagicOpenLoc.includes('token=') || testMagicOpenLoc.includes('error=')) {
      throw new Error(`Expected magic login to succeed after opening timeline. Location: ${testMagicOpenLoc}`);
    }
    console.log('✓ Success: Existing magic links continue to work dynamically when timeline is extended.');

    // ----------------------------------------------------
    // Test 19: Student Deletion and Clean Re-import Test
    // ----------------------------------------------------
    console.log('\n[TEST 19] Running Student Deletion and Clean Re-import Test...');

    const test19Email = 'student999019@uni.ac.lk';
    const test19Index = 'INDEX-999019';
    
    // Insert student 19 with confirmed attendance
    const insertRes19 = await pool.query(
      `INSERT INTO students (index_no, registration_no, nic_no, full_name, name_with_initials, gpa, class, degree_id, faculty, email, address, contact_no, convocation_year, attendance_confirmed)
       VALUES ($1, 'REG-999019', 'NIC-999019', 'Student Nineteen', 'Student N.', 3.2, 'Second Upper', $2, 'Faculty of Applied Sciences', $3, 'Uni Address', '0777777777', '2026', true)
       RETURNING id`,
      [test19Index, deg1.id, test19Email]
    );
    const student19Id = insertRes19.rows[0].id;

    // Create an OTP for student 19
    await pool.query(
      "INSERT INTO otp_codes (email, code, expires_at) VALUES ($1, '123456', CURRENT_TIMESTAMP + INTERVAL '5 minutes')",
      [test19Email]
    );

    // Verify OTP exists
    const otpBefore = await pool.query("SELECT * FROM otp_codes WHERE email = $1", [test19Email]);
    if (otpBefore.rows.length !== 1) {
      throw new Error('OTP was not created correctly for Test 19');
    }

    // Delete student 19 via API
    const deleteStudent19Res = await fetch(`${BASE_URL}/api/admin/review`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookieHeader
      },
      body: JSON.stringify({
        studentId: student19Id
      })
    });

    if (deleteStudent19Res.status !== 200) {
      throw new Error(`Failed to delete student 19. Status: ${deleteStudent19Res.status}`);
    }

    // Verify student 19 is deleted
    const student19Check = await pool.query("SELECT * FROM students WHERE id = $1", [student19Id]);
    if (student19Check.rows.length !== 0) {
      throw new Error('Student 19 still exists in database after deletion');
    }

    // Verify OTP is deleted
    const otpAfter = await pool.query("SELECT * FROM otp_codes WHERE email = $1", [test19Email]);
    if (otpAfter.rows.length !== 0) {
      throw new Error('OTP code for student 19 was not deleted when student was deleted');
    }

    // Re-import student 19 via ingestion commit
    const reIngestRes = await fetch(`${BASE_URL}/api/ingestion/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [{
          name_with_initials: 'Student N.',
          full_name: 'Student Nineteen',
          registration_no: 'REG-999019',
          index_no: test19Index,
          nic_no: 'NIC-999019',
          faculty: 'Faculty of Applied Sciences',
          degreeId: deg1.id,
          address: 'Uni Address',
          contact_no: '0777777777',
          email: test19Email,
          gpa: '3.20',
          class: 'Second Upper'
        }]
      })
    });

    if (reIngestRes.status !== 200) {
      throw new Error(`Re-ingestion failed with status: ${reIngestRes.status}`);
    }

    // Fetch the re-imported student and verify they are treated as a fresh/new student (attendance_confirmed = false)
    const reImportCheck = await pool.query("SELECT * FROM students WHERE email = $1 AND convocation_year = '2026'", [test19Email]);
    if (reImportCheck.rows.length !== 1) {
      throw new Error('Re-imported student was not found in database');
    }
    const freshStudent = reImportCheck.rows[0];
    if (freshStudent.attendance_confirmed !== false) {
      throw new Error(`Expected re-imported student's attendance_confirmed to be false, got: ${freshStudent.attendance_confirmed}`);
    }
    console.log('✓ Success: Student successfully deleted with all related info, and re-import treated them as a new student.');

    // ----------------------------------------------------
    // Test 20: Multi-Year Identical Student Registry and Login
    // ----------------------------------------------------
    console.log('\n[TEST 20] Running Multi-Year Identical Student Registry and Login Test...');
    
    // Switch active year to 2027 and insert identical student info
    await fetch(`${BASE_URL}/api/admin/active-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieHeader },
      body: JSON.stringify({ convocation_year: '2027' })
    });
    
    // Open/configure the timeline for active year 2027
    await fetch(`${BASE_URL}/api/timeline`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': adminCookieHeader
      },
      body: JSON.stringify({
        open_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        close_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
      })
    });
    
    const ingest2027Res = await fetch(`${BASE_URL}/api/ingestion/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [{
          name_with_initials: 'Student One 2027',
          full_name: 'Student One Full Name 2027',
          registration_no: 'REG/2026/1001',
          index_no: 'INDEX-260001',
          nic_no: 'NIC-260001',
          faculty: 'Faculty of Applied Sciences',
          degreeId: deg1.id,
          address: 'Uni Address 2027',
          contact_no: '0777777777',
          email: 'student1@uni.ac.lk',
          gpa: '3.50',
          class: 'General'
        }]
      })
    });
    
    if (ingest2027Res.status !== 200) {
      throw new Error(`Ingesting identical student under 2027 failed. Status: ${ingest2027Res.status}`);
    }

    const magicToken2027 = signMagicToken('student1@uni.ac.lk', 'REG/2026/1001', '2027');
    const login2027Res = await fetch(`${BASE_URL}/api/student/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student1@uni.ac.lk',
        registration_no: 'REG/2026/1001',
        nic_no: 'NIC-260001',
        token: magicToken2027
      })
    });

    if (login2027Res.status !== 200) {
      throw new Error(`Login failed for identical student scoped to 2027. Status: ${login2027Res.status}, Body: ${await login2027Res.text()}`);
    }

    const cookieHeader2027 = login2027Res.headers.get('set-cookie') || '';
    
    const profile2027Res = await fetch(`${BASE_URL}/api/student/profile`, {
      headers: { 'Cookie': cookieHeader2027 }
    });
    const profile2027 = (await profile2027Res.json()).data;
    
    if (profile2027.name_with_initials !== 'Student One 2027' || profile2027.convocation_year !== '2027') {
      throw new Error(`Profile retrieval year scoping failed. Expected Student One 2027. Got: ${JSON.stringify(profile2027)}`);
    }

    console.log('✓ Success: Scoped token and session authentication successfully isolated identical students across convocation cohorts.');

    // ----------------------------------------------------
    // Test 21: Custom Certificate Layout API & rendering
    // ----------------------------------------------------
    console.log('\n[TEST 21] Running Certificate Custom Layout API & rendering Test...');
    
    await fetch(`${BASE_URL}/api/admin/active-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieHeader },
      body: JSON.stringify({ convocation_year: '2026' })
    });

    const customLayoutPost = await fetch(`${BASE_URL}/api/admin/certificate-layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieHeader },
      body: JSON.stringify({
        convocation_year: '2026',
        layout_data: {
          studentNameY: 512,
          studentNameFontSize: 24,
          registrarName: 'CUSTOM REGISTRAR NAME',
          vcName: 'CUSTOM VC NAME'
        }
      })
    });

    if (customLayoutPost.status !== 200) {
      throw new Error(`Failed to POST custom layout. Status: ${customLayoutPost.status}`);
    }

    const getLayoutRes = await fetch(`${BASE_URL}/api/admin/certificate-layout?convocation_year=2026`, {
      headers: { 'Cookie': adminCookieHeader }
    });
    const layoutResJson = await getLayoutRes.json();
    if (!layoutResJson.success || layoutResJson.data.studentNameY !== 512 || layoutResJson.data.registrarName !== 'CUSTOM REGISTRAR NAME') {
      throw new Error(`Custom layout API GET verification failed. Data: ${JSON.stringify(layoutResJson)}`);
    }

    const genCertRes = await fetch(`${BASE_URL}/api/admin/certificates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookieHeader },
      body: JSON.stringify({
        faculty: 'Faculty of Applied Sciences',
        degreeId: deg1.id
      })
    });

    if (genCertRes.status !== 202) {
      throw new Error(`Certificate trigger failed with status: ${genCertRes.status}`);
    }

    let finalStatus: any = {};
    for (let i = 0; i < 30; i++) {
      const checkRes = await fetch(`${BASE_URL}/api/admin/certificates`, {
        headers: { 'Cookie': adminCookieHeader }
      });
      finalStatus = (await checkRes.json()).data;
      if (finalStatus.status === 'completed' || finalStatus.status === 'failed') break;
      await sleep(1000);
    }

    if (finalStatus.status !== 'completed') {
      throw new Error(`Certificate compilation with custom layout failed: ${finalStatus.error}`);
    }

    console.log('✓ Success: Custom layout successfully saved, merged, and applied to background certificate compilation.');

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
  } catch (err: any) {
    console.error('\n❌ A test failed during the run:', err.message);
    process.exit(1);
  } finally {
    await stopServer();
  }
}

runTests();
