-- SQL migrations for Graduation and Certificate Management System

-- Create a non-superuser role for executing RLS student queries
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user;
  END IF;
END
$$;

-- Drop existing tables if they exist to start fresh
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS otp_codes CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS registration_windows CASCADE;
DROP TABLE IF EXISTS degrees CASCADE;

-- Module 1: Course (Degree) Management
CREATE TABLE degrees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  name_si VARCHAR(255) NOT NULL,
  name_ta VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('Internal', 'External')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Module 3: Timeline & Registration Control
CREATE TABLE registration_windows (
  id SERIAL PRIMARY KEY,
  open_date TIMESTAMP WITH TIME ZONE NOT NULL,
  close_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_manually_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Module 4: Students Table
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_no VARCHAR(100) UNIQUE NOT NULL,
  registration_no VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name_with_initials VARCHAR(255) NOT NULL,
  full_name TEXT NOT NULL,
  faculty VARCHAR(100) NOT NULL,
  degree_id UUID REFERENCES degrees(id) ON DELETE RESTRICT,
  address TEXT NOT NULL,
  contact_no VARCHAR(50) NOT NULL,
  gpa NUMERIC(4, 2) NOT NULL,
  class VARCHAR(100) NOT NULL,
  
  -- Student Actions
  attendance_confirmed BOOLEAN DEFAULT FALSE,
  profile_photo_path TEXT,
  payment_slip_path TEXT,
  name_correction_request TEXT,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  
  -- Admin controls
  verification_status VARCHAR(50) DEFAULT 'Pending Verification' CHECK (verification_status IN ('Pending Verification', 'Approved', 'Name Correction Requested')),
  
  -- Seating
  session_number INT CHECK (session_number BETWEEN 1 AND 4),
  seat_number INT,
  certificate_number VARCHAR(100),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for lookup efficiency
CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_students_index_no ON students(index_no);
CREATE INDEX idx_students_faculty ON students(faculty);

-- RLS Enablement
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE students FORCE ROW LEVEL SECURITY;

-- RLS Policy
DROP POLICY IF EXISTS student_self_service_policy ON students;
CREATE POLICY student_self_service_policy ON students
  FOR ALL
  USING (
    current_setting('app.is_admin', true) = 'true'
    OR email = current_setting('app.current_student_email', true)
  )
  WITH CHECK (
    current_setting('app.is_admin', true) = 'true'
    OR email = current_setting('app.current_student_email', true)
  );

-- OTP Codes for Multi-Factor passwordless login
CREATE TABLE otp_codes (
  email VARCHAR(255) PRIMARY KEY,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Module 5: Immutable Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id VARCHAR(255) NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  action_taken TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed an initial registration window (e.g. active from now till next month)
INSERT INTO registration_windows (open_date, close_date)
VALUES (CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '30 days');

-- Grant all privileges to the app_user role so it can query and modify inside the RLS context
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
