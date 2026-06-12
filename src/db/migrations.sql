-- SQL migrations for Graduation and Certificate Management System

-- Create a non-superuser role for executing RLS student queries
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user;
  END IF;
END
$$;

-- Grant app_user role to postgres to allow role switching (required on cloud hosts like Supabase)
GRANT app_user TO postgres;

-- Drop existing tables if they exist to start fresh
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS otp_codes CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS registration_windows CASCADE;
DROP TABLE IF EXISTS degrees CASCADE;
DROP TABLE IF EXISTS faculties CASCADE;
DROP TABLE IF EXISTS convocation_sessions CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;

-- Module 1: Course (Degree) Management
CREATE TABLE degrees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  faculty VARCHAR(100) NOT NULL,
  degree_no INT NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  name_si VARCHAR(255) NOT NULL,
  name_ta VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('Internal', 'External')),
  import_order SERIAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_faculty_degree_no UNIQUE (faculty, degree_no)
);

-- Module 3: Timeline & Registration Control
CREATE TABLE registration_windows (
  id SERIAL PRIMARY KEY,
  open_date TIMESTAMP WITH TIME ZONE NOT NULL,
  close_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_manually_closed BOOLEAN DEFAULT FALSE,
  convocation_year VARCHAR(50) UNIQUE DEFAULT '2026',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_active_convocation ON registration_windows(is_active) WHERE is_active = TRUE;

-- Module 4: Students Table
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_no VARCHAR(100) NOT NULL,
  nic_no VARCHAR(50) NOT NULL,
  registration_no VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name_with_initials VARCHAR(255) NOT NULL,
  full_name TEXT NOT NULL,
  faculty VARCHAR(100) NOT NULL,
  degree_id UUID REFERENCES degrees(id) ON DELETE RESTRICT,
  address TEXT NOT NULL,
  contact_no VARCHAR(50) NOT NULL,
  gpa NUMERIC(4, 2) NOT NULL,
  class VARCHAR(100) NOT NULL,
  
  -- Student Actions
  attending_convocation BOOLEAN DEFAULT NULL,
  attendance_confirmed BOOLEAN DEFAULT FALSE,
  profile_photo_path TEXT,
  payment_slip_path TEXT,
  name_correction_request TEXT,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  
  -- Admin controls
  verification_status VARCHAR(50) DEFAULT 'Pending Verification' CHECK (verification_status IN ('Pending Verification', 'Approved', 'Name Correction Requested')),
  email_sent BOOLEAN DEFAULT FALSE,
  magic_token TEXT DEFAULT NULL,
  convocation_year VARCHAR(50) DEFAULT '2026',
  
  -- Seating
  session_number INT CHECK (session_number > 0),
  seat_number INT,
  certificate_number VARCHAR(100),
  confirmation_email_sent BOOLEAN DEFAULT FALSE,
  import_order SERIAL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_index_no_convocation UNIQUE (index_no, convocation_year),
  CONSTRAINT unique_nic_no_convocation UNIQUE (nic_no, convocation_year),
  CONSTRAINT unique_registration_no_convocation UNIQUE (registration_no, convocation_year),
  CONSTRAINT unique_email_convocation UNIQUE (email, convocation_year)
);

-- Indexing for lookup efficiency
CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_students_index_no ON students(index_no);
CREATE INDEX idx_students_faculty ON students(faculty);

-- RLS Enablement
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE students FORCE ROW LEVEL SECURITY;

ALTER TABLE degrees ENABLE ROW LEVEL SECURITY;
ALTER TABLE degrees FORCE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS select_degrees_policy ON degrees;
CREATE POLICY select_degrees_policy ON degrees
  FOR SELECT
  USING (true);

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
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  action_taken TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed an initial registration window (e.g. active from now till next month)
INSERT INTO registration_windows (open_date, close_date)
VALUES (CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '30 days');

-- Staff Table for Exam Division Login
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) DEFAULT 'Staff',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial Exam Division admin user (password: 'admin123')
INSERT INTO staff (username, name, password_hash, role)
VALUES (
  'admin',
  'Exam Division Admin',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  'Administrator'
) ON CONFLICT (username) DO NOTHING;

-- Faculties Table
CREATE TABLE faculties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO faculties (name) VALUES
  ('Faculty of Agriculture'),
  ('Faculty of Applied Sciences'),
  ('Faculty of Management Studies'),
  ('Faculty of Medicine and Allied Sciences'),
  ('Faculty of Social Sciences & Humanities'),
  ('Faculty of Technology')
ON CONFLICT (name) DO NOTHING;

-- Sessions Table
CREATE TABLE convocation_sessions (
  id SERIAL PRIMARY KEY,
  session_number INT UNIQUE NOT NULL,
  session_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO convocation_sessions (session_number, session_name) VALUES
  (1, 'Session 1'),
  (2, 'Session 2'),
  (3, 'Session 3'),
  (4, 'Session 4')
ON CONFLICT (session_number) DO NOTHING;

-- Email Templates Table
CREATE TABLE email_templates (
  template_key VARCHAR(50) PRIMARY KEY,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO email_templates (template_key, subject, body) VALUES
  ('otp', 'Verification Code', '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Verification Code</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; } .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); } .header { background: #1e3a8a; padding: 32px; text-align: center; } .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; } .body { padding: 40px 32px; } .intro { font-size: 15px; color: #334155; line-height: 1.6; margin-top: 0; } .otp-card { background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin: 32px 0; border: 1px dashed #cbd5e1; } .otp-code { font-size: 32px; font-weight: 800; color: #1e3a8a; letter-spacing: 6px; font-family: Courier, monospace; margin: 0; } .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; } .alert { color: #ef4444; font-weight: 600; margin-top: 16px; font-size: 13px; }</style></head><body><div class="container"><div class="header"><h1>University Graduation Portal</h1></div><div class="body"><p class="intro">Hello student,</p><p class="intro">You requested a verification code to access your Graduation Self-Service Portal. Please use the following single-use passcode:</p><div class="otp-card"><div class="otp-code">{{otp_code}}</div></div><p class="intro">This code is cryptographically locked to your session and will automatically expire in <strong>5 minutes</strong>.</p><p class="alert">If you did not initiate this request, please ignore this email immediately.</p></div><div class="footer">&copy; 2026 University Exam Division. This email was sent automatically.</div></div></body></html>'),
  ('magic_link', 'Convocation Registration - Action Required', '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Graduation Onboarding Portal</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; } .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); } .header { background: #1e3a8a; padding: 32px; text-align: center; } .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; } .body { padding: 40px 32px; } .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; } .text { font-size: 15px; color: #334155; line-height: 1.6; } .cta-area { text-align: center; margin: 36px 0; } .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 14px 28px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2); } .link-fallback { background: #f8fafc; border-radius: 8px; padding: 16px; font-size: 12px; color: #64748b; word-break: break-all; margin-top: 24px; border: 1px solid #e2e8f0; } .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }</style></head><body><div class="container"><div class="header"><h1>University Graduation Portal</h1></div><div class="body"><p class="greeting">Dear {{student_name}},</p><p class="text">Your academic records have been successfully verified and imported into the Graduation Registry. Registration for the upcoming convocation is now open.</p><p class="text">Please click the button below to enter your secure portal, verify your billing address, confirm names translation, upload certificates documentation, and lock your seating seat number allocation:</p><div class="cta-area"><a href="{{magic_link_url}}" class="button" target="_blank">Access Graduation Portal</a></div><p class="text"><em>Note: This magic link is cryptographically tied to your email and is valid for 7 days. Do not share this email with others.</em></p><div class="link-fallback"><strong>Button not working?</strong> Copy and paste this URL into your browser:<br><span style="user-select: all;">{{magic_link_url}}</span></div></div><div class="footer">&copy; 2026 University Exam Division. This email was sent automatically.</div></div></body></html>'),
  ('rejection', 'Graduation Registration Rejected', '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Graduation Registration Rejected</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; } .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); } .header { background: #b91c1c; padding: 32px; text-align: center; } .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; } .body { padding: 40px 32px; } .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; } .text { font-size: 15px; color: #334155; line-height: 1.6; } .reason-card { background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0; padding: 20px; text-align: left; margin: 28px 0; } .reason-title { font-weight: 700; color: #991b1b; font-size: 14px; margin-bottom: 6px; } .reason-text { font-size: 13.5px; color: #7f1d1d; line-height: 1.5; margin: 0; } .cta-area { text-align: center; margin: 36px 0; } .button { display: inline-block; background-color: #dc2626; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 14px 28px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 10px rgba(220, 38, 38, 0.2); } .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }</style></head><body><div class="container"><div class="header"><h1>Graduation Registry Correction Alert</h1></div><div class="body"><p class="greeting">Dear {{student_name}},</p><p class="text">Upon review by the Exam Division Coordinator, your graduation registration details have been <strong>rejected and unlocked for editing</strong>.</p><div class="reason-card"><div class="reason-title">Reason for spelling or document rejection:</div><p class="reason-text">{{rejection_reason}}</p></div><p class="text">Your profile has been temporarily unlocked. Please click the button below to log back into your portal, edit your details, upload correct documentation (photographs/payment slips), and re-submit your registration for confirmation:</p><div class="cta-area"><a href="{{login_url}}" class="button" target="_blank">Correct Registration Details</a></div></div><div class="footer">&copy; 2026 University Exam Division. This email was sent automatically.</div></div></body></html>'),
  ('confirmation', 'Graduation Registration Confirmed - Seating Allocation', '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Registration Confirmed</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; } .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); } .header { background: #1e3a8a; padding: 32px; text-align: center; } .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; } .body { padding: 40px 32px; } .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; } .text { font-size: 15px; color: #334155; line-height: 1.6; } .details-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; } .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; } .details-row:last-child { border-bottom: none; } .details-label { font-size: 13px; color: #64748b; font-weight: 600; } .details-value { font-size: 14px; color: #0f172a; font-weight: 700; font-family: monospace; } .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }</style></head><body><div class="container"><div class="header"><h1>Registration Confirmed</h1></div><div class="body"><p class="greeting">Dear {{student_name}},</p><p class="text">Your graduation registration details have been verified and approved by the Exam Division. Your seating and session allocation has been finalized:</p><div class="details-card"><div class="details-row"><span class="details-label">Session Number:</span><span class="details-value">Session {{session_number}}</span></div><div class="details-row"><span class="details-label">Seat Number:</span><span class="details-value">Seat {{seat_number}}</span></div><div class="details-row"><span class="details-label">Certificate Number:</span><span class="details-value">{{certificate_number}}</span></div></div><p class="text">Please present this information at the entrance. We look forward to seeing you at the convocation ceremony.</p></div><div class="footer">&copy; 2026 University Exam Division. This email was sent automatically.</div></div></body></html>')
ON CONFLICT (template_key) DO NOTHING;

-- Staff status update
ALTER TABLE staff ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Disabled'));

-- Grant all privileges to the app_user role so it can query and modify inside the RLS context
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
