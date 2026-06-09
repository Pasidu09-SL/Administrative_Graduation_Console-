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
  } finally {
    client.release();
  }

  await runMigrations();
  
  // Seed initial timeline window
  const seedClient = await pool.connect();
  try {
    await seedClient.query(
      `INSERT INTO registration_windows (open_date, close_date) 
       VALUES (CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '30 days')`
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
        faculty: 'Faculty of Applied Science',
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
        faculty: 'Faculty of Social Science and Humanities',
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
    
    const hasCS = degreesList.some((d: any) => d.code === 'BSc-CS' && d.faculty === 'Faculty of Applied Science' && d.degree_no === 1);
    const hasBIT = degreesList.some((d: any) => d.code === 'BIT' && d.faculty === 'Faculty of Social Science and Humanities' && d.degree_no === 1);

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
            faculty: 'Faculty of Applied Science',
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
        faculty: i <= 250 ? 'Faculty of Applied Science' : 'Faculty of Social Science and Humanities',
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
      const threshold = isRemote ? 10000 : 2000;
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
    
    // Close the timeline window (set open to 2 days ago, close to 1 day ago)
    const closeTimelineRes = await fetch(`${BASE_URL}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        open_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        close_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      })
    });
    
    if (closeTimelineRes.status !== 200) {
      throw new Error('Could not set timeline for boundary test.');
    }

    // Attempt student login targeting mock student
    const magicTokenTest5 = signMagicToken('student1@uni.ac.lk', 'INDEX-260001');
    const loginRes = await fetch(`${BASE_URL}/api/student/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student1@uni.ac.lk',
        index_no: 'INDEX-260001',
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

    // Restore timeline window to open for remaining tests
    await fetch(`${BASE_URL}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const st1Index = 'INDEX-260001';
    const st1Nic = 'NIC-260001';

    // Verify credentials and capture the session cookie directly
    const magicTokenTest6 = signMagicToken(st1Email, st1Index);
    const verifyRes = await fetch(`${BASE_URL}/api/student/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: st1Email, index_no: st1Index, nic_no: st1Nic, token: magicTokenTest6 })
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
      throw new Error(`Auth Test Failed! Allowed login with invalid credentials. Status: ${badLoginRes.status}`);
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
    
    // Approve all students so they are eligible for seating allocation, and set them as attending
    await pool.query("UPDATE students SET verification_status = 'Approved', attending_convocation = TRUE");

    // Assign "Faculty of Applied Science" (250 students) to Session 1
    const assignFac1 = await fetch(`${BASE_URL}/api/admin/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': adminCookieHeader
      },
      body: JSON.stringify({ faculty: 'Faculty of Applied Science', sessionNumber: 1 })
    });
    const allocation1 = (await assignFac1.json()).data;

    // Assign "Faculty of Social Science and Humanities" (250 students) to Session 1
    const assignFac2 = await fetch(`${BASE_URL}/api/admin/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': adminCookieHeader
      },
      body: JSON.stringify({ faculty: 'Faculty of Social Science and Humanities', sessionNumber: 1 })
    });
    const allocation2 = (await assignFac2.json()).data;

    // Check seating ranges: Faculty A should be 1-250. Faculty B should be 251-500.
    if (
      allocation1.startingSeat === 1 && allocation1.endingSeat === 250 &&
      allocation2.startingSeat === 251 && allocation2.endingSeat === 500
    ) {
      console.log(`✓ Success: Sequential seating calculations verified. Unbroken seat chain created (1-250 and 251-500).`);
    } else {
      throw new Error(`Algorithmic Test Failed! Seating ranges: Fac1 = ${allocation1.startingSeat}-${allocation1.endingSeat}, Fac2 = ${allocation2.startingSeat}-${allocation2.endingSeat}`);
    }

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
        'Cookie': adminCookieHeader
      }
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
    const testIndex = 'INDEX-260001';
    
    // Generate valid magic link token
    const magicToken = signMagicToken(testEmail, testIndex);
    
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

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
  } catch (err: any) {
    console.error('\n❌ A test failed during the run:', err.message);
    process.exit(1);
  } finally {
    await stopServer();
  }
}

runTests();
