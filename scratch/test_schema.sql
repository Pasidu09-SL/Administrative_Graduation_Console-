-- Administrative Graduation Platform Database Backup
-- Generated on: 2026-06-20T17:44:02.879Z

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Table: audit_logs
DROP TABLE IF EXISTS "audit_logs" CASCADE;

CREATE TABLE "audit_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "admin_id" character varying(255) NOT NULL,
  "student_id" uuid,
  "action_taken" text NOT NULL,
  "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id)
);

-- Table: certificate_layouts
DROP TABLE IF EXISTS "certificate_layouts" CASCADE;

CREATE TABLE "certificate_layouts" (
  "convocation_year" character varying(50) NOT NULL,
  "layout_data" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "certificate_layouts_pkey" PRIMARY KEY (convocation_year)
);

-- Table: convocation_sessions
DROP TABLE IF EXISTS "convocation_sessions" CASCADE;

CREATE SEQUENCE IF NOT EXISTS "convocation_sessions_id_seq";

CREATE TABLE "convocation_sessions" (
  "id" integer DEFAULT nextval('convocation_sessions_id_seq'::regclass) NOT NULL,
  "session_number" integer NOT NULL,
  "session_name" character varying(255),
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "allocation_group" character varying(255),
  "session_date" character varying(100),
  "session_time" character varying(100),
  "convocation_year" character varying(50) DEFAULT '2026'::character varying,
  "faculty_1" character varying(255),
  "faculty_2" character varying(255),
  CONSTRAINT "convocation_sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "convocation_sessions_session_number_unique" UNIQUE (session_number),
  CONSTRAINT "unique_session_group_year" UNIQUE (session_number, allocation_group, convocation_year)
);

ALTER SEQUENCE "convocation_sessions_id_seq" OWNED BY "convocation_sessions"."id";

-- Table: degrees
DROP TABLE IF EXISTS "degrees" CASCADE;

CREATE SEQUENCE IF NOT EXISTS "degrees_import_order_seq";

CREATE TABLE "degrees" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" character varying(50) NOT NULL,
  "faculty" character varying(100) NOT NULL,
  "degree_no" integer NOT NULL,
  "name_en" character varying(255) NOT NULL,
  "name_si" character varying(255) NOT NULL,
  "name_ta" character varying(255) NOT NULL,
  "type" character varying(50) NOT NULL,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "import_order" integer DEFAULT nextval('degrees_import_order_seq'::regclass) NOT NULL,
  CONSTRAINT "degrees_code_key" UNIQUE (code),
  CONSTRAINT "degrees_pkey" PRIMARY KEY (id),
  CONSTRAINT "degrees_type_check" CHECK (((type)::text = ANY ((ARRAY['Internal'::character varying, 'External'::character varying])::text[]))),
  CONSTRAINT "unique_faculty_degree_no" UNIQUE (faculty, degree_no)
);

ALTER SEQUENCE "degrees_import_order_seq" OWNED BY "degrees"."import_order";

ALTER TABLE "degrees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "degrees" FORCE ROW LEVEL SECURITY;
CREATE POLICY "select_degrees_policy" ON "degrees" FOR SELECT TO public USING (true);

-- Table: email_templates
DROP TABLE IF EXISTS "email_templates" CASCADE;

CREATE TABLE "email_templates" (
  "template_key" character varying(50) NOT NULL,
  "subject" character varying(255) NOT NULL,
  "body" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_templates_pkey" PRIMARY KEY (template_key)
);

-- Table: faculties
DROP TABLE IF EXISTS "faculties" CASCADE;

CREATE TABLE "faculties" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" character varying(255) NOT NULL,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "faculties_name_key" UNIQUE (name),
  CONSTRAINT "faculties_pkey" PRIMARY KEY (id)
);

-- Table: otp_codes
DROP TABLE IF EXISTS "otp_codes" CASCADE;

CREATE TABLE "otp_codes" (
  "email" character varying(255) NOT NULL,
  "code" character varying(6) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "otp_codes_pkey" PRIMARY KEY (email)
);

-- Table: registration_windows
DROP TABLE IF EXISTS "registration_windows" CASCADE;

CREATE SEQUENCE IF NOT EXISTS "registration_windows_id_seq";

CREATE TABLE "registration_windows" (
  "id" integer DEFAULT nextval('registration_windows_id_seq'::regclass) NOT NULL,
  "open_date" timestamp with time zone NOT NULL,
  "close_date" timestamp with time zone NOT NULL,
  "is_manually_closed" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "convocation_year" character varying(50) DEFAULT '2026'::character varying,
  "is_active" boolean DEFAULT true,
  CONSTRAINT "registration_windows_pkey" PRIMARY KEY (id),
  CONSTRAINT "unique_convocation_year" UNIQUE (convocation_year)
);

ALTER SEQUENCE "registration_windows_id_seq" OWNED BY "registration_windows"."id";

CREATE UNIQUE INDEX idx_active_convocation ON public.registration_windows USING btree (is_active) WHERE (is_active = true);

-- Table: staff
DROP TABLE IF EXISTS "staff" CASCADE;

CREATE TABLE "staff" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "username" character varying(100) NOT NULL,
  "password_hash" character varying(255) NOT NULL,
  "name" character varying(100) NOT NULL,
  "role" character varying(50) DEFAULT 'Staff'::character varying,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "status" character varying(50) DEFAULT 'Active'::character varying,
  CONSTRAINT "staff_pkey" PRIMARY KEY (id),
  CONSTRAINT "staff_status_check" CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Disabled'::character varying])::text[]))),
  CONSTRAINT "staff_username_key" UNIQUE (username)
);

-- Table: students
DROP TABLE IF EXISTS "students" CASCADE;

CREATE SEQUENCE IF NOT EXISTS "students_import_order_seq";

CREATE TABLE "students" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "index_no" character varying(100),
  "nic_no" character varying(50) NOT NULL,
  "registration_no" character varying(100) NOT NULL,
  "email" character varying(255) NOT NULL,
  "name_with_initials" character varying(255) NOT NULL,
  "full_name" text NOT NULL,
  "faculty" character varying(100) NOT NULL,
  "degree_id" uuid,
  "address" text NOT NULL,
  "contact_no" character varying(50) NOT NULL,
  "gpa" numeric(4,2),
  "class" character varying(100) NOT NULL,
  "attendance_confirmed" boolean DEFAULT false,
  "profile_photo_path" text,
  "payment_slip_path" text,
  "name_correction_request" text,
  "confirmed_at" timestamp with time zone,
  "verification_status" character varying(50) DEFAULT 'Pending Verification'::character varying,
  "session_number" integer,
  "seat_number" integer,
  "certificate_number" character varying(100),
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "attending_convocation" boolean,
  "email_sent" boolean DEFAULT false,
  "magic_token" text,
  "convocation_year" character varying(50) DEFAULT '2026'::character varying,
  "confirmation_email_sent" boolean DEFAULT false,
  "import_order" integer DEFAULT nextval('students_import_order_seq'::regclass) NOT NULL,
  "timeline_bypass" boolean DEFAULT false,
  "effective_date" date,
  "graduation_date" date,
  CONSTRAINT "students_pkey" PRIMARY KEY (id),
  CONSTRAINT "students_session_number_check" CHECK ((session_number > 0)),
  CONSTRAINT "students_verification_status_check" CHECK (((verification_status)::text = ANY ((ARRAY['Pending Verification'::character varying, 'Approved'::character varying, 'Name Correction Requested'::character varying])::text[]))),
  CONSTRAINT "unique_email_convocation" UNIQUE (email, convocation_year),
  CONSTRAINT "unique_index_no_convocation" UNIQUE (index_no, convocation_year),
  CONSTRAINT "unique_nic_no_convocation" UNIQUE (nic_no, convocation_year),
  CONSTRAINT "unique_registration_no_convocation" UNIQUE (registration_no, convocation_year)
);

ALTER SEQUENCE "students_import_order_seq" OWNED BY "students"."import_order";

CREATE INDEX idx_students_index_no ON public.students USING btree (index_no);
CREATE INDEX idx_students_faculty ON public.students USING btree (faculty);
CREATE INDEX idx_students_email ON public.students USING btree (email);

ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "students" FORCE ROW LEVEL SECURITY;
CREATE POLICY "student_self_service_policy" ON "students" TO public USING (((current_setting('app.is_admin'::text, true) = 'true'::text) OR ((email)::text = current_setting('app.current_student_email'::text, true)))) WITH CHECK (((current_setting('app.is_admin'::text, true) = 'true'::text) OR ((email)::text = current_setting('app.current_student_email'::text, true))));

-- Data for audit_logs
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('7c27f0ef-9089-473e-9ba4-e765b2d67217', 'admin', NULL, 'Saved timeline configuration: Open = 01/06/2026, 07:09:00, Close = 10/06/2026, 23:59:00', '2026-06-10T18:26:17.302Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('6f2198c4-86f1-4e0c-8fdd-969d0f389852', 'staff', NULL, 'Saved timeline configuration for year 2026: Open = 01/06/2026, 01:39:00, Close = 10/06/2026, 23:30:00', '2026-06-11T13:11:25.335Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('1bc4d02c-ff0e-4e72-bfe6-a16bb52ba1eb', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-11T15:12:04.043Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('abfee2de-82a2-45fc-8f9c-b7b30b6ca99f', 'admin', NULL, 'Activated new convocation session year ''2027''', '2026-06-11T15:13:16.193Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('75f3bbdf-58eb-4342-8479-08d451501bb4', 'admin', NULL, 'Activated new convocation session year ''2026''', '2026-06-11T15:14:04.139Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('d3f63a18-aae7-4cb3-ab29-a1f478ebf019', 'admin', NULL, 'Activated new convocation session year ''2027''', '2026-06-11T15:14:24.624Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('8b620843-ad1b-4ea0-b8b5-30a1dd8239be', 'staff', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-11T17:23:25.165Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('e0a40f0b-9caa-4edf-a26d-881ea2c39a4c', 'admin', NULL, 'Activated new convocation session year ''2026''', '2026-06-11T19:44:19.185Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('cd4d7208-ee37-42d4-aff9-78967cbd37a5', 'staff', NULL, 'Activated new convocation session year ''2027''', '2026-06-11T20:41:06.046Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('b8a16435-cbe8-4bd3-95e8-800292667c0f', 'staff', NULL, 'Activated new convocation session year ''2026''', '2026-06-11T20:41:39.866Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('3ccac46a-ee73-463e-b447-c5e2ddacb0a3', 'tharusha', NULL, 'Saved timeline configuration for year 2026: Open = 31/05/2026, 20:09:00, Close = 12/06/2026, 18:00:00', '2026-06-12T09:13:59.960Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('0b57d16f-6dbe-4476-b6c4-72f1641f128a', 'System', NULL, 'Portal opened automatically', '2026-06-12T09:14:10.660Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('0a263dfa-b271-45df-bc00-e9099169a345', 'tharusha', NULL, 'Deleted student from registry: Index No=2061, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-12T10:12:39.695Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('6af6f510-d327-4f69-9dba-cb9016d76bf5', 'tharusha', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-12T10:13:52.996Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('8bfd9d2f-99b9-4f96-bdb3-9e226c82d95b', 'tharusha', NULL, 'Activated new convocation session year ''2027''', '2026-06-12T10:14:45.324Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('7191ac30-f3ae-4b54-8140-c5a8c20972f6', 'tharusha', NULL, 'Activated new convocation session year ''2026''', '2026-06-12T10:15:40.948Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('12d1382f-0249-48ff-96b6-a2ca5ce56573', 'tharusha', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-12T10:32:59.638Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('b122f453-876c-42f0-8d84-1dded53bb438', 'tharusha', NULL, 'Saved timeline configuration for year 2026: Open = 31/05/2026, 14:39:00, Close = 12/06/2026, 12:30:00', '2026-06-12T10:40:48.851Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('1556e2cc-c248-41db-8314-3be533b53383', 'tharusha', NULL, 'Emergency override deactivated: Resumed timeline schedule for year 2026', '2026-06-12T10:41:06.976Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('92ba7b69-6e3d-48cb-8eb2-f31c1c2b1c1c', 'System', NULL, 'Portal closed automatically', '2026-06-12T10:41:23.091Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('c487c6c7-7389-4929-bb70-3085cabf953b', 'tharusha', NULL, 'Emergency override activated: Portal closed manually for year 2026', '2026-06-12T10:42:37.909Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('c3f04628-86bc-4630-9711-9d4e48c564bd', 'tharusha', NULL, 'Saved timeline configuration for year 2026: Open = 12/06/2026, 18:00:00, Close = 12/06/2026, 22:00:00', '2026-06-12T12:28:30.316Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('692b074b-325a-4252-a622-a1141ff489ee', 'tharusha', NULL, 'Saved timeline configuration for year 2026: Open = 12/06/2026, 18:00:00, Close = 12/06/2026, 22:00:00', '2026-06-12T12:30:17.456Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('8aa9408c-46dd-4e36-80f0-b5e64e78a20a', 'tharusha', NULL, 'Activated new convocation session year ''2026''', '2026-06-12T12:30:24.446Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('25ba7be9-2070-4f3e-b104-85a9dc25f84f', 'tharusha', NULL, 'Activated new convocation session year ''2027''', '2026-06-12T12:30:46.905Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('2a7754d5-87c7-45bc-9f66-1ab041c10fdc', 'System', NULL, 'Portal opened automatically', '2026-06-12T12:31:01.496Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('a4de9aa5-5284-4cdf-9e81-e00c966250f3', 'tharusha', NULL, 'Activated new convocation session year ''2026''', '2026-06-12T12:34:42.143Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('9d7857ab-cebb-4805-ba8c-568ae39c6f8f', 'admin', NULL, 'Saved timeline configuration for year 2026: Open = 12/06/2026, 18:00:00, Close = 13/06/2026, 22:00:00', '2026-06-12T13:21:51.502Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('15e3f91e-905d-4ee3-bb19-acddf6236cd6', 'admin', NULL, 'Activated new convocation session year ''2027''', '2026-06-12T13:22:12.436Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('4c526d94-929d-4793-81a0-0e453cd8ccd8', 'admin', NULL, 'Saved timeline configuration for year 2027: Open = 10/06/2026, 20:43:00, Close = 11/07/2026, 20:43:00', '2026-06-12T13:22:25.179Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('746a8973-9ae0-4292-9638-33d1c3bb573c', 'admin', NULL, 'Saved timeline configuration for year 2027: Open = 10/06/2026, 20:43:00, Close = 12/06/2026, 18:53:00', '2026-06-12T13:22:55.307Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('0c2be6c1-e8a5-4ac1-b5b0-e37257183c14', 'admin', NULL, 'Activated new convocation session year ''2026''', '2026-06-12T13:24:15.664Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('18178dfa-6f62-45da-a012-f5ab287cd630', 'admin', NULL, 'Emergency override activated: Portal closed manually for year 2026', '2026-06-12T13:24:42.936Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('b5ddd3f5-d5c6-4ee9-ab10-bca8d477ab79', 'admin', NULL, 'Emergency override deactivated: Resumed timeline schedule for year 2026', '2026-06-12T13:24:49.509Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('7ad233e6-d87e-4bcb-af7f-86d6e24e731d', 'admin', NULL, 'Saved timeline configuration for year 2026: Open = 12/06/2026, 19:00:00, Close = 13/06/2026, 22:00:00', '2026-06-12T13:25:56.840Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('ffe426ef-4027-4b44-8c96-e9eb6f2794ab', 'admin', NULL, 'Deleted student from registry: Index No=2061, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-12T13:26:09.736Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('a8e13b76-6579-4c5e-a4c6-a6545191c586', 'admin', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-12T13:26:09.736Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('8b9487ee-7ae0-43f6-9d3d-442642338b67', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-12T13:27:14.854Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('30bd8971-a684-4175-a8f5-1bd067144b7e', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-12T13:33:53.379Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('2fb549a9-7d04-4a14-aec4-df0bc16e56ff', 'admin', NULL, 'Updated email template for ''magic_link''', '2026-06-12T15:07:14.915Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('88d9825e-8008-478e-825d-be8ffcd2dc78', 'tharusha', NULL, 'Deleted student from registry: Index No=2061, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-12T15:09:45.479Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('ac42e89f-17f6-4d4b-81f7-9c77182703a0', 'tharusha', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-12T15:09:45.479Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('4263bc4f-4187-48ae-85b4-0c07cb80a0e5', 'tharusha', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-12T15:10:15.880Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('000f51f8-2de7-4c92-8934-0c9f7017773c', 'tharusha', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-12T15:11:51.302Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('cd8a978b-d70a-4edc-90e3-9cfb92d16427', 'tharusha', NULL, 'Dispatched seat confirmation email to 1 candidates', '2026-06-12T16:35:30.172Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('bb4ffa89-665f-4f98-8fd3-ad1f7309fa41', 'admin', NULL, 'Activated new convocation session year ''2027''', '2026-06-12T16:57:00.967Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('ab98ae56-f182-4131-9f53-15c4b8136ec7', 'admin', NULL, 'Saved timeline configuration for year 2027: Open = 12/06/2026, 22:27:00, Close = 12/06/2026, 22:35:00', '2026-06-12T16:58:05.136Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('09dd0ab8-e94f-4528-a290-cf2e16179c96', 'admin', NULL, 'Deleted student from registry: Index No=2061, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-12T16:59:35.446Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('2153ef88-6b6e-4458-8b61-7bcc7be98695', 'admin', NULL, 'Deleted student from registry: Index No=2062, Name=Wiraj Udara Wickramaarachchi, Faculty=Faculty of Technology', '2026-06-12T16:59:35.446Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('dc24efd0-7a3d-4554-aa79-0adee370a46e', 'admin', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-12T16:59:35.446Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('439d5019-3660-4e62-b7d8-0f85ce18bcca', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-12T17:00:27.026Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('340adc85-a751-4056-94eb-3f373e672f6d', 'admin', NULL, 'Activated new convocation session year ''2026''', '2026-06-12T17:02:47.963Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('3e174d5e-54a5-48a9-b12a-23870b3a0128', 'admin', NULL, 'Deleted student from registry: Index No=2061, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-12T17:03:10.272Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('95068a02-2026-4295-a080-084a8df86f30', 'admin', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-12T17:03:10.272Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('b65e0e02-4f7c-4645-9ece-55fe5d6c4f8a', 'admin', NULL, 'Activated new convocation session year ''2027''', '2026-06-12T17:03:21.037Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('42057bd3-906f-4d4c-9667-eca1c7c814ad', 'System', NULL, 'Portal closed automatically', '2026-06-12T17:06:39.712Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('a5ea67fc-7b1e-4127-aed3-6251fcf93076', 'admin', NULL, 'Saved timeline configuration for year 2027: Open = 12/06/2026, 22:36:00, Close = 12/06/2026, 22:40:00', '2026-06-12T17:07:19.016Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('5d7b46ba-4e9e-4899-b2fb-19a58ee5895f', 'System', NULL, 'Portal opened automatically', '2026-06-12T17:07:24.287Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('bdae5362-eaa5-42ec-8ede-639404a85dfc', 'admin', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-12T19:35:47.434Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('101695b0-970f-461c-8bdd-1a7d6233ce84', 'admin', NULL, 'Deleted student from registry: Index No=2061, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-12T19:35:47.434Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('2961616f-bbb0-4601-863a-4854cdf852f1', 'admin', NULL, 'Saved timeline configuration for year 2027: Open = 13/06/2026, 01:05:00, Close = 13/06/2026, 22:40:00', '2026-06-12T19:36:03.912Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('e03995e7-55bf-4e3f-a6e9-57ce65e914ae', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-12T19:36:37.737Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('30553fd4-5c30-407e-a99c-93d9e8044b26', 'admin', NULL, 'Activated new convocation session year ''2026''', '2026-06-12T19:41:09.342Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('098a175a-aefa-462d-9d10-9f0dd76db77f', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-12T19:41:43.272Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('007836f5-bea8-4e17-b6ba-97775cf6205a', 'admin', NULL, 'Updated certificate layout configuration for convocation year 2026', '2026-06-12T19:50:01.125Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('a772938c-eb14-42bb-a6ca-41d1ef3b4d1f', 'pasindu', NULL, 'Activated new convocation session year ''2026''', '2026-06-15T10:58:10.554Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('d877da74-f4f8-41e0-a17c-84e36a0264e4', 'pasindu', NULL, 'Activated new convocation session year ''2026''', '2026-06-15T10:59:53.871Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('96aa4522-3a18-43c1-b92c-2aafa423714f', 'pasindu', NULL, 'Saved timeline configuration for year 2026: Open = 6/15/2026, 4:29:00 PM, Close = 6/30/2026, 10:00:00 PM', '2026-06-15T11:00:05.683Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('513f29c4-c194-4d02-b26b-9dc1341ea561', 'pasindu', NULL, 'Saved timeline configuration for year 2026: Open = 6/1/2026, 4:29:00 PM, Close = 6/14/2026, 10:00:00 PM', '2026-06-15T11:00:51.739Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('c1bd4be6-8ca3-4d09-98c2-193b01573ad3', 'pasindu', NULL, 'Activated new convocation session year ''2026''', '2026-06-15T11:01:13.299Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('4a8ad8e2-bc84-4682-b0e7-9a3cb911d603', 'pasindu', NULL, 'Saved timeline configuration for year 2026: Open = 6/15/2026, 4:31:00 PM, Close = 6/15/2026, 5:30:00 PM', '2026-06-15T11:01:53.121Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('2181f32b-9a1e-4648-b71b-721b823182fb', 'pasindu', NULL, 'Deleted student from registry: Index No=2061, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-15T11:04:41.493Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('b5c564ef-d8cc-46b1-9a02-ac5e61f3032b', 'pasindu', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-15T11:04:41.493Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('e9568c5d-4fc7-434a-8b5f-68ea6df9428c', 'pasindu', NULL, 'Dispatched onboarding magic link email to 3 candidates', '2026-06-15T11:15:29.573Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('63adc06f-68b6-4d96-81cf-07012a791610', 'pasindu', NULL, 'Dispatched seat confirmation email to 1 candidates', '2026-06-15T11:44:46.564Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('40e4aaa0-d696-4bdc-8d33-2292c97ee8dc', 'admin', NULL, 'Deleted student from registry: Index No=2061, Name=Uwaiz Mohomed, Faculty=Faculty of Technology', '2026-06-16T18:00:08.777Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('2471c198-6283-4abe-920d-70b538bfaafb', 'admin', NULL, 'Deleted student from registry: Index No=2062, Name=Wiraj Pathirana, Faculty=Faculty of Technology', '2026-06-16T18:00:08.777Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('d21c2f95-7562-40cc-9429-ae986e5f90cf', 'admin', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-16T18:00:08.777Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('1333fdcd-1159-4393-8a65-0e77867f2133', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-16T18:00:36.176Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('1e0ab5eb-f736-4a9d-a5f0-9b1e3ecf48be', 'System', NULL, 'Portal closed automatically', '2026-06-16T18:01:05.178Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('1fa59f7f-95a4-46dc-a72b-5dc9723bf844', 'admin', NULL, 'Saved timeline configuration for year 2026: Open = 16/06/2026, 23:31:00, Close = 17/06/2026, 17:30:00', '2026-06-16T18:02:05.069Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('08c79e25-3260-4c3c-a889-f50c4c05d0e1', 'System', NULL, 'Portal opened automatically', '2026-06-16T18:02:16.419Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('102941d9-9067-435a-baad-4357e26c3f09', 'admin', NULL, 'Saved timeline configuration for year 2026: Open = 16/06/2026, 23:31:00, Close = 16/06/2026, 23:36:00', '2026-06-16T18:27:48.792Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('5c338747-96b3-494f-9068-442494f18df8', 'admin', NULL, 'Saved timeline configuration for year 2026: Open = 16/06/2026, 23:57:00, Close = 17/06/2026, 23:36:00', '2026-06-16T18:28:04.836Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('9bfb35b6-3d2f-49f1-a8bd-0e4fb91dc749', 'admin', NULL, 'Emergency override activated: Portal closed manually for year 2026', '2026-06-16T18:28:15.012Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('07645f78-107f-4332-a670-e0e45f4e8bf8', 'admin', NULL, 'Emergency override deactivated: Resumed timeline schedule for year 2026', '2026-06-16T18:30:43.176Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('f3d0a734-8fd4-4afc-83bd-8cca87977f17', 'admin', NULL, 'Emergency override activated: Portal closed manually for year 2026', '2026-06-16T18:31:02.795Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('94ebf566-871a-4b94-b159-2ce4fb10417b', 'admin', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-16T20:07:26.108Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('40f2f083-1e60-4b51-af16-05dfcd322403', 'admin', NULL, 'Deleted student from registry: Index No=2061, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-16T20:07:26.108Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('2b814d02-d3c2-4a5e-b865-f52c6ef5382f', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-16T20:07:54.143Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('7f8b7bb5-7fd9-41f8-91fe-8b15c08042ef', 'admin', NULL, 'Emergency override deactivated: Resumed timeline schedule for year 2026', '2026-06-16T20:09:57.034Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('737f509a-9bc2-44fe-9c42-5044f24d3cc4', 'admin', NULL, 'Dispatched absentia confirmation email to 1 candidates', '2026-06-16T20:14:18.307Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('58d8e830-814e-4672-821b-84e188ae894e', 'admin', NULL, 'Updated email template for ''magic_link''', '2026-06-16T20:32:00.474Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('df44f788-4667-46bb-b4d5-6b29a663735b', 'admin', NULL, 'Staff logged out: Exam Division Admin', '2026-06-16T20:33:09.110Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('e52188a1-428c-4b08-ab11-cff611906415', 'admin', NULL, 'Staff logged in: Exam Division Admin (Administrator)', '2026-06-17T06:58:42.158Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('e773206f-975a-412d-9e4d-f2d3561f7872', 'admin', NULL, 'Deleted student from registry: Index No=2061, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-17T08:31:19.693Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('0dc90511-01fe-4dbd-a156-3220339b7af0', 'admin', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-17T08:31:19.693Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('02166dcb-75f6-4c83-b175-0b942cdf07e4', 'admin', NULL, 'Dispatched onboarding magic link email to 2 candidates', '2026-06-17T15:10:31.660Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('09fcf7ac-7411-436c-8d34-ae799c53785f', 'admin', NULL, 'Deleted student from registry: Index No=null, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-17T20:10:23.500Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('4f4353c8-1ce6-40be-9498-09a0a5195aae', 'admin', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-17T20:10:23.500Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('062e12aa-697c-4195-a547-12aa7ab1960f', 'admin', NULL, 'Deleted student from registry: Index No=ITT-2060, Name=Tharu Pathirana, Faculty=Faculty of Technology', '2026-06-17T20:10:23.500Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('85c59fd4-0e9c-4f04-bdbe-653541526853', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-17T20:10:55.924Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('1e993844-8557-4401-b7d5-ddd3054795c9', 'System', NULL, 'Portal closed automatically', '2026-06-17T20:13:10.995Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('ac3d2170-3f81-46c0-8910-0343a3d8bbc0', 'admin', NULL, 'Deleted student from registry: Index No=null, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-17T20:35:11.418Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('5a2afe85-dff0-44ff-851c-05d2fb50e83d', 'admin', NULL, 'Deleted student from registry: Index No=ITT-2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-17T20:35:11.418Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('78becd1e-40fd-4cc8-9ba1-3c423ca22fe0', 'admin', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-17T20:35:11.418Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('f259571f-1475-4094-be73-125f53db58e6', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-17T21:06:04.746Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('b414738d-8188-4d81-b90f-81703ccdea71', 'admin', NULL, 'Deleted student from registry: Index No=null, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-18T12:19:51.045Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('a8a93383-c709-4bf6-bdb9-5780b226e254', 'admin', NULL, 'Deleted student from registry: Index No=ITT-2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-18T12:19:51.045Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('1fe622d2-135e-40bc-814f-463bd3452677', 'admin', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-18T12:19:51.045Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('391f6c29-a27d-4c8c-8638-eac96c0ddf98', 'admin', NULL, 'Saved timeline configuration for year 2026: Open = 18/06/2026, 17:52:00, Close = 19/06/2026, 23:36:00', '2026-06-18T12:23:03.457Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('95ab6aeb-0b64-40ef-965c-bbf7d1daf865', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-18T12:35:11.498Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('92801e34-92f0-4545-979e-e3b8eb26019b', 'System', NULL, 'Portal opened automatically', '2026-06-18T12:35:42.955Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('33800f22-2613-4015-b65c-c35e621c3e81', 'admin', NULL, 'Updated email template for ''confirmation''', '2026-06-18T13:04:14.432Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('c4cdaa33-f149-4e22-b94e-bd762389d2d4', 'admin', NULL, 'Updated email template for ''confirmation''', '2026-06-18T13:12:09.672Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('43d6b604-cf3b-4a63-963c-6e07549ff4b7', 'admin', NULL, 'Updated email template for ''confirmation''', '2026-06-18T13:15:56.348Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('4b7f11a0-fc99-4ac5-88e2-18fe40e61dda', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-18T15:55:32.666Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('ac7c4509-65bf-4b64-8231-1483f5cbebe1', 'admin', NULL, 'Emergency override activated: Portal closed manually for year 2026', '2026-06-18T15:57:18.598Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('0a5bc60a-f2bc-4e49-8fa2-aa2eb08276bb', 'admin', NULL, 'Emergency override deactivated: Resumed timeline schedule for year 2026', '2026-06-18T15:57:57.326Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('25709f17-bad5-4a58-aa7f-d9ef705afd61', 'admin', NULL, 'Activated new convocation session year ''2027''', '2026-06-18T16:14:26.393Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('df13a787-82bc-4019-91d2-55fa1edbef9c', 'admin', NULL, 'Deleted student from registry: Index No=2061, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-18T16:14:38.323Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('7503bb87-7f4d-48fb-9c0b-5f968830a38d', 'admin', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-18T16:14:38.323Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('36679c08-4d1c-4f0d-bf7d-e4ad0c5778cd', 'admin', NULL, 'Activated new convocation session year ''2026''', '2026-06-18T16:16:20.742Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('db7d0ba2-1ec1-41d4-98a7-c351cc79c478', 'admin', NULL, 'Updated email template for ''magic_link''', '2026-06-18T16:22:39.105Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('c0267f92-8f6e-4b27-b440-8c3beb4d231d', 'admin', NULL, 'Dispatched seat confirmation email to 1 candidates', '2026-06-18T16:37:58.373Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('1ee25aa5-010f-4d97-8636-81669e859d3d', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-18T16:45:01.050Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('cc8d2e2c-cd7a-4de7-a7b2-ce02d49b5526', 'admin', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-18T20:58:35.488Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('9be2aedb-714c-40d3-acbc-3ed3818b867c', 'admin', NULL, 'Deleted student from registry: Index No=ITT-2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-18T20:58:35.488Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('9f441475-15ff-4df0-a490-6adc2b5e762c', 'admin', NULL, 'Deleted student from registry: Index No=null, Name=Thimira, Faculty=Faculty of Technology', '2026-06-18T20:58:35.488Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('d5362477-215f-4b1a-bb0e-162aa4ff56ee', 'admin', NULL, 'Activated new convocation session year ''2026''', '2026-06-18T21:04:18.741Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('ac0824f0-0aff-454b-8ff4-4cd368bee02f', 'admin', NULL, 'Updated email template for ''confirmation''', '2026-06-18T21:08:15.942Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('3acb5b20-bae9-4a82-aede-5b09bd1e7be2', 'admin', NULL, 'Updated email template for ''confirmation''', '2026-06-18T21:09:23.471Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('3617845d-5b98-467d-8342-7538d9688266', 'admin', NULL, 'Updated email template for ''confirmation''', '2026-06-18T21:09:46.151Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('d7670852-f231-4647-b5aa-2e1bdebf3c2b', 'admin', NULL, 'Saved timeline configuration for year 2026: Open = 18/06/2026, 17:52:00, Close = 19/06/2026, 23:36:00', '2026-06-18T21:27:48.538Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('ea0d3b0a-3998-4fc2-b9c0-3a0b2c5f0d32', 'admin', NULL, 'Activated new convocation session year ''2026''', '2026-06-18T21:27:55.196Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('332d5735-54ee-490e-9533-870cdf6fbc95', 'admin', NULL, 'Updated email template for ''magic_link''', '2026-06-18T21:32:00.326Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('ec22ba66-dc34-4246-8b77-142959089086', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-18T21:40:26.694Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('eb6ab5ba-af75-4893-9e71-145c73024c8d', 'admin', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-18T21:55:34.121Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('e196e538-7b8f-4d91-8144-6f35f5ace26b', 'admin', NULL, 'Deleted student from registry: Index No=null, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-18T21:55:34.121Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('13d89c99-57ab-45c8-8aee-9d246072eb3c', 'admin', NULL, 'Deleted student from registry: Index No=ITT-2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-18T21:55:34.121Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('9f269c06-8aaa-4706-a92b-b77927f4830f', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-18T21:59:56.378Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('fa832a22-5709-4727-bd2e-4465794dd31b', 'admin', NULL, 'Dispatched seat confirmation email to 1 candidates', '2026-06-18T22:05:06.782Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('b7b8a703-0eee-4938-a0e8-f06eeb59a652', 'admin', NULL, 'Updated email template for ''magic_link''', '2026-06-18T22:07:15.253Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('73bb3d2b-8f3e-4052-85fb-aa771906d29f', 'admin', NULL, 'Activated new convocation session year ''2027''', '2026-06-19T04:01:01.552Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('a3fa8bbf-ec8c-4ea9-b4ea-8fc4a55d096c', 'admin', NULL, 'Activated new convocation session year ''2026''', '2026-06-19T04:01:19.194Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('d8610b08-dcb4-4764-b91e-eade516c26cd', 'admin', NULL, 'Deleted student from registry: Index No=null, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-19T04:01:51.199Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('3d345ae0-56af-47bf-bd58-fc617c74b2e9', 'admin', NULL, 'Deleted student from registry: Index No=ITT-2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-19T04:01:51.199Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('6545b681-3b13-49f1-b69c-91168e003aea', 'admin', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-19T04:01:51.199Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('6f5bed1d-db13-4bc6-978f-f53448880ca7', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-19T14:26:05.897Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('1c91f63d-d836-472a-b316-b1f70d7e0912', 'admin', NULL, 'Deleted student from registry: Index No=2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-20T07:14:34.778Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('df33e49d-3c2f-485b-a0c2-e2d119776b56', 'admin', NULL, 'Deleted student from registry: Index No=null, Name=Thimira Pathirana, Faculty=Faculty of Technology', '2026-06-20T07:14:34.778Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('14b384a2-8801-4f1f-99db-04bf363981de', 'admin', NULL, 'Deleted student from registry: Index No=ITT-2060, Name=Heeralu Pathirannahalage Tharusha Pathirana, Faculty=Faculty of Technology', '2026-06-20T07:14:34.778Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('c99626bc-84c9-4c33-8671-e0d49d03b04d', 'admin', NULL, 'Saved timeline configuration for year 2026: Open = 20/06/2026, 12:44:00, Close = 21/06/2026, 23:36:00', '2026-06-20T07:14:51.133Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('6bbfa540-dd65-4668-b33a-46509fc2ca47', 'admin', NULL, 'Dispatched onboarding magic link email to 1 candidates', '2026-06-20T07:19:32.721Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('266dbe90-bfd7-4ac1-a3b3-faaf547e2428', 'admin', '0c1c21ad-3669-4efd-a4cb-0509314fb725', 'Approved student profile.', '2026-06-20T07:21:39.280Z');
INSERT INTO "audit_logs" ("id", "admin_id", "student_id", "action_taken", "timestamp") VALUES ('60ad1a72-0444-4217-beaa-7b1a0c0f3971', 'admin', NULL, 'Updated certificate layout configuration for convocation year 2026', '2026-06-20T08:24:20.492Z');

-- Data for certificate_layouts
INSERT INTO "certificate_layouts" ("convocation_year", "layout_data", "created_at", "updated_at") VALUES ('2026', '{"vcX":496.063,"titleY":500,"vcName":"වෛද්‍ය පී.එච්.ජේ. පුෂ්පකුමාර / வைத்தியர் பி.எச்.ஜி.ஜே. புஷ்பகுமார","vcTitle":"වැඩ බලන උපකුලපති / பதில் உபவேந்தர்","suffixSi":"පිරිනමන ලද බව මෙයින් සහතික කරමු.","suffixTa":"வழங்கப்பட்டதென இத்தால்\nஉறுதிப்படுத்துகின்றோம்.","b_si_date":"2023 ජූලි මස 27 වන දින","preambleY":482,"b_si_date2":"2023 ජූලි මස 27 වන දින සිට","b_ta_date1":"27 ஜூன் 2023","b_ta_date2":"27 ஜூலை 2023","f_vc_title":"Acting Vice Chancellor","registrarX":99.213,"signatureY":118,"dateSiLine1":"වලංගු වීමේ දිනය: 15/01/2023","dateSiLine2":"උපාධි ප්‍රදානෝත්සවය: 2023 ජූලි මස 27","dateTaLine1":"செல்லுபடியாகும் திகதி: 15/01/2023","dateTaLine2":"பட்டமளிப்பு விழா: 27 ஜூலை 2023","dateVerbalY":245,"degreeNameY":405,"f_reg_title":"Registrar","b_si_vc_name":"වෛද්‍ය පී.එච්.ජේ. පුෂ්පකුමාර","b_ta_vc_name":"வைத்தியர் பி.எச்.ஜி.ஜே. புஷ்பகுமார","dateDigitalY":350,"studentNameY":490,"b_si_reg_name":"එස්.සී. හේරත්","b_si_vc_title":"වැඩ බලන උපකුලපති","b_ta_reg_name":"எஸ்.சி.ஹேரத்","b_ta_vc_title":"பதில் உபவேந்தர்","f_date_verbal":"Twenty Seventh Day of July in the Year Two Thousand Twenty Three","registrarName":"එස්.සී. හේරත් / எஸ்.சி.ஹேரத்","b_si_reg_title":"ලේඛකාධිකාරි","b_ta_reg_title":"பதிவாளர்","dateVerbalText":"Twenty Seventh Day of July in the Year Two Thousand Twenty Three","f_date_digital":"15th January 2023","registrarTitle":"ලේඛකාධිකාරි / பதிவாளர்","dateDigitalText":"15th January 2023","degreeNameFontSize":20,"preambleSiExternal":"මෙම විශ්වවිද්‍යාලයේ බාහිර අපේක්ෂකයෙකු ලෙස\nනියමිත අධ්‍යයන පාඨමාලා සහ පරීක්ෂණ සාර්ථක\nලෙස නිම කිරීමෙන් පසු මෙහි පසු පිටේ නම\nසඳහන් අය වෙත","preambleSiInternal":"මෙම විශ්වවිද්‍යාලයේ අභ්‍යන්තර අපේක්ෂකයෙකු ලෙස\nනියමිත අධ්‍යයන පාඨමාලා සහ පරීක්ෂණ සාර්ථක\nලෙස නිම කිරීමෙන් පසු මෙහි පසු පිටේ නම\nසඳහන් අය වෙත","preambleTaExternal":"இப்பல்கலைக்கழகத்தில் குறிப்பிட்ட வெளிவாரி கற்கை\nநெறிகளையும் பரீட்சைகளையும் வெற்றிகரமாக\nநிறைவு செய்ததன் பின்னர், இச்சான்றிதழின்\nமறுபக்கத்தில் பெயர் குறிப்பிடப்பட்டுள்ளவருக்கு","preambleTaInternal":"இப்பல்கலைக்கழகத்தில் குறிப்பிட்ட உள்வாரி கற்கை\nநெறிகளையும் பரீட்சைகளையும் வெற்றிகரமாக\nநிறைவு செய்ததன் பின்னர், இச்சான்றிதழின்\nமறுபக்கத்தில் பெயர் குறிப்பிடப்பட்டுள்ளவருக்கு","studentNameFontSize":26}', '2026-06-12T19:50:01.125Z', '2026-06-20T08:24:20.492Z');

-- Data for convocation_sessions
INSERT INTO "convocation_sessions" ("id", "session_number", "session_name", "created_at", "allocation_group", "session_date", "session_time", "convocation_year", "faculty_1", "faculty_2") VALUES (872, 1, 'Session 1', '2026-06-17T20:10:43.464Z', 'Unassigned', '2027-01-01', '09:00', '2026', 'Faculty of Technology (Internal)', 'Faculty of Applied Sciences (Internal)');
INSERT INTO "convocation_sessions" ("id", "session_number", "session_name", "created_at", "allocation_group", "session_date", "session_time", "convocation_year", "faculty_1", "faculty_2") VALUES (2, 2, 'Session 2', '2026-06-11T09:22:32.935Z', 'Unassigned', '2027-01-01', '14:00', '2026', 'Faculty of Management Studies (Internal)', NULL);
INSERT INTO "convocation_sessions" ("id", "session_number", "session_name", "created_at", "allocation_group", "session_date", "session_time", "convocation_year", "faculty_1", "faculty_2") VALUES (3, 3, 'Session 3', '2026-06-11T09:22:32.935Z', 'Unassigned', '2027-01-02', '09:00', '2026', 'Faculty of Medicine and Allied Sciences (Internal)', 'Faculty of Agriculture (Internal)');
INSERT INTO "convocation_sessions" ("id", "session_number", "session_name", "created_at", "allocation_group", "session_date", "session_time", "convocation_year", "faculty_1", "faculty_2") VALUES (4, 4, 'Session 4', '2026-06-11T09:22:32.935Z', 'Unassigned', '2027-01-02', '14:00', '2026', 'Faculty of Social Sciences & Humanities (Internal)', 'All External Degrees');

SELECT setval('public.convocation_sessions_id_seq', COALESCE((SELECT MAX("id") FROM "convocation_sessions"), 1), COALESCE((SELECT MAX("id") FROM "convocation_sessions") IS NOT NULL, false));
-- Data for degrees
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('0042406d-20f6-40ad-8b09-47203a21000f', 'FA-DEG-1', 'Faculty of Agriculture', 1, 'Master of Agriculture', 'කෘෂිකර්මපති උපාධිය', 'விவசாய முதுமாணிப் பட்டம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 41);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('1019e3ea-ae38-4e90-bc1e-a0c4eefe4aa0', 'FMS-DEG-7', 'Faculty of Management Studies', 7, 'Master of Business Administration', 'ව්‍යාපාර පරිපාලනපති උපාධිය', 'வியாபார நிர்வாக முதுமாணிப் பட்டம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 61);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('ec334019-c6a2-45ca-8a29-dbcf0533a869', 'FT-DEG-4', 'Faculty of Technology', 4, 'Bachelor of Engineering Technology Honours Degree in Materials Technology', 'ඉංජිනේරු තාක්ෂණවේදි ගෞරව උපාධිය - ද්‍රව්‍ය තාක්ෂණය', 'பொறியியல்  தொழில்நுட்ப கௌரவ இளமாணிப் பட்டம் - பொருட்கள் தொழிநுட்பம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 79);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('f5fdc015-1b9c-47e4-b0df-7d2e50f4d5e2', 'FT-DEG-5', 'Faculty of Technology', 5, 'Bachelor of Information and  Communication Technology Honours Degree', 'තොරතුරු සහ සන්නිවේදන තාක්ෂණවේදි ගෞරව උපාධිය', 'கௌரவ இளமாணிப் பட்டம் - தகவல் மற்றும் தொடர்பாடல் தொழில்நுட்பம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 80);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('e2938d5b-4b34-4a0c-87cf-9feb962ab7ed', 'FA-DEG-2', 'Faculty of Agriculture', 2, 'Postgraduate Diploma in Rural Development', 'ග්‍රාමීය සංවර්ධන පශ්චාත් උපාධි  ඩිප්ලෝමාව', 'கிராமிய அபிவிருத்தியில் பட்டப்பின் படிப்பு டிப்ளோமா பட்டம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 42);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('f32cb7be-bf15-4744-9bda-9e91811031d7', 'FA-DEG-3', 'Faculty of Agriculture', 3, 'Bachelor of Science Honours in Agriculture', 'කෘෂිකර්ම විද්‍යාවේදී ගෞරව උපාධිය', 'விவசாயத்தில் கௌரவ விஞ்ஞானமாணிப் பட்டம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 43);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('b4f12f23-490c-4381-ae72-ee14ab10f587', 'FAS-DEG-1', 'Faculty of Applied Sciences', 1, 'Bachelor of Science Honours In Information Technology', 'තොරතුරු තාක්ෂණය විද්‍යාවේදී (ගෞරව) උපාධිය', 'கௌரவ விஞ்ஞான இளமாணி - தகவல் தொழில்நுட்பம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 44);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('d94840d2-9ed3-4ecc-b11b-008908be4991', 'FAS-DEG-2', 'Faculty of Applied Sciences', 2, 'Bachelor of Science In Information Technology', 'තොරතුරු තාක්ෂණය විද්‍යාවේදී උපාධිය', 'விஞ்ஞான இளமாணி - தகவல் தொழில்நுட்பம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 45);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('9fb22479-09ab-4a0d-adf4-02f4a24abcf3', 'FAS-DEG-3', 'Faculty of Applied Sciences', 3, 'Bachelor of Science (Joint Major) Degree in Chemistry & Physics', 'භෞතික විද්‍යා හා රසායන විද්‍යා (එකාබද්ධ ප්‍රධාන) විද්‍යාවේදී උපාධිය', 'விஞ்ஞான இளமாணிப் (இணைந்த முதன்மை பாடத்துறை) பட்டம் - இரசாயனவியல் மற்றும் பௌதீகவியல்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 46);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('9b4ab19d-9f34-47d0-b001-a053ff1379b8', 'FAS-DEG-4', 'Faculty of Applied Sciences', 4, 'Bachelor of Science Honours in Industrial Mathematics', 'කර්මාන්ත ගණිතයවේදී  ගෞරව විද්‍යා උපාධිය', 'கௌரவ விஞ்ஞான இளமாணி -  தொழில்துறை கணிதம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 47);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('790a0427-99eb-4e12-b4bd-dc35b6f89a36', 'FAS-DEG-5', 'Faculty of Applied Sciences', 5, 'Bachelor of Science Honours in Microbiology', 'ක්ෂුද්‍ර ජීව විද්‍යා විද්‍යාවේදී ගෞරව උපාධිය', 'கௌரவ விஞ்ஞான இளமாணி - நுண்ணுயிரியல்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 48);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('dd4293b0-4f90-4ec1-9126-d992aa1f80f8', 'FAS-DEG-6', 'Faculty of Applied Sciences', 6, 'Bachelor of Science Honours in Applied Sciences', 'ව්‍යවහාරික විද්‍යා විද්‍යාවේදී ‍ගෞරව උපාධිය', 'கௌரவ விஞ்ஞான இளமாணி - பிரயோக விஞ்ஞானங்கள்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 49);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('fc711ef9-6123-478c-bf6c-77670b0691b2', 'FAS-DEG-7', 'Faculty of Applied Sciences', 7, 'Bachelor of Science Honours in Applied Biology', 'ව්‍යවහාරික ජෛව විද්‍යා විද්‍යාවේදි ගෞරව උපාධිය', 'கௌரவ விஞ்ஞான இளமாணி - பிரயோக உயிரியல்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 50);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('3bfe0e99-383c-4d01-85bf-7ceb8bec5a3c', 'FAS-DEG-8', 'Faculty of Applied Sciences', 8, 'Bachelor of Science Honours in Health Promotion', 'සෞඛ්‍ය ප්‍රවර්ධනය පිළිබඳ විද්‍යාවේදි ගෞරව උපාධිය', 'கௌரவ விஞ்ஞான இளமாணி - சுகாதா விருத்தி', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 51);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('eda484c0-5e5d-409f-968c-ab84fa671650', 'FAS-DEG-9', 'Faculty of Applied Sciences', 9, 'Bachelor of Science in Applied Sciences', 'ව්‍යවහාරික විද්‍යා විද්‍යාවේදී උපාධිය', 'விஞ்ஞான இளமாணி - பிரயோக விஞ்ஞானங்கள்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 52);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('d6c56e83-cac3-452e-ba2b-4b606ab901a1', 'FAS-DEG-10', 'Faculty of Applied Sciences', 10, 'Bachelor of Science in Health Promotion', 'සෞඛ්‍ය ප්‍රවර්ධනවේදි විද්‍යා උපාධිය', 'விஞ்ஞான இளமாணி - சுகாதார  விருத்தி', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 53);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('660c8a39-dd99-4e0a-ad98-6f80f51c2daf', 'FAS-DEG-11', 'Faculty of Applied Sciences', 11, 'Postgraduate Diploma in Child Protection', 'පශ්චාත් උපාධි ළමා ආරක්ෂක ඩිප්ලෝමා උපාධිය', 'பட்டப்பின் படிப்பு டிப்ளோமா பட்டம் - குழந்தைகள் பாதுகாப்பு', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 54);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('4263b481-3dbe-4364-9d5a-d390f361d051', 'FMS-DEG-1', 'Faculty of Management Studies', 1, 'Bachelor of Science Honours in Human Resource Management', 'මානව සම්පත් කළමනාකරණ - විද්‍යාවේදී ගෞරව උපාධිය', 'கௌரவ விஞ்ஞான இளமாணி - மனிதவள முகாமைத்துவம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 55);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('3658746a-0237-4775-9ce8-d2e329481bb0', 'FMS-DEG-2', 'Faculty of Management Studies', 2, 'Bachelor of Science Honours in Marketing Management', 'අලෙවිකරණ කළමනාකරණ - විද්‍යාවේදී ගෞරව උපාධිය', 'கௌரவ விஞ்ஞான இளமாணி - சந்தைப்படுத்தல் முகாமைத்துவம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 56);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('2065fa40-8149-4417-b4fe-5e7d69f941c0', 'FMS-DEG-3', 'Faculty of Management Studies', 3, 'Bachelor of Science Honours in Accountancy and Finance', 'ගිණුම්කරණය හා මූල්‍ය - විද්‍යාවේදී ගෞරව උපාධිය', 'கௌரவ விஞ்ஞான இளமாணி - கணக்கியல் மற்றும் நிதியியல்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 57);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('e281a17e-3f22-4e85-b22b-a3daeb1e2013', 'FMS-DEG-4', 'Faculty of Management Studies', 4, 'Bachelor of Science Honours in Business Management', 'ව්‍යාපාර කළමනාකරණ - විද්‍යාවේදී ගෞරව උපාධිය', 'கௌரவ விஞ்ஞான இளமாணி - வணிக முகாமைத்துவம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 58);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('338cfb7c-8463-495a-b710-17aca5b163bc', 'FMS-DEG-5', 'Faculty of Management Studies', 5, 'Bachelor of Science Honours in Information Systems', 'තොරතුරු පද්ධති - විද්‍යාවේදී ගෞරව උපාධිය', 'கௌரவ விஞ்ஞான இளமாணி - தகவல் முறைமைகள்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 59);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('8fdcaa8f-0a13-4d62-9565-673d28e1eb62', 'FMS-DEG-6', 'Faculty of Management Studies', 6, 'Bachelor of Science Honours in Tourism and Hospitality Management', 'සංචාරක සහ ආගන්තුක සත්කාර කළමනාකරණ - විද්‍යාවේදී ගෞරව උපාධිය', 'கௌரவ விஞ்ஞான இளமாணி - சுற்றுலா மற்றும் விருந்தோம்பல் முகாமைத்துவம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 60);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('11f6549e-f94e-495e-8119-e62674b77151', 'FMS-DEG-8', 'Faculty of Management Studies', 8, 'Postgraduate Diploma in Management', 'පශ්චාද් උපාධි කළමනාකරණ ඩිප්ලෝමා උපාධිය', 'பட்டப்பின் படிப்பு டிப்ளோமா பட்டம் - முகாமைத்துவம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 62);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('7a956fad-0085-465e-a05c-7dcc62f709e4', 'FMS-DEG-9', 'Faculty of Management Studies', 9, 'Bachelor of Business Administration', 'ව්‍යාපාර පරිපාලනවේදී උපාධිය', 'வியாபார நிர்வாக இளமாணிப் பட்டம்', 'External', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 63);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('3d1544e2-b17b-45af-9317-8333850ee7aa', 'FMAS-DEG-1', 'Faculty of Medicine and Allied Sciences', 1, 'Bachelor of Medicine and Bachelor of Surgery', 'වෛද්‍ය හා ශල්‍යවේදී උපාධිය', 'மருத்துவ இளமாணி மற்றும் சத்திரசிகிச்சை இளமாணிப் பட்டம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 64);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('e26f5428-0819-4645-93f2-cbc3eaab3989', 'FMAS-DEG-2', 'Faculty of Medicine and Allied Sciences', 2, 'Doctor of Philosophy', 'දර්ශනශූරී උපාධිය', 'கலாநிதிப் பட்டம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 65);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('6ab33741-c161-482f-b602-375951547244', 'FMAS-DEG-3', 'Faculty of Medicine and Allied Sciences', 3, 'Master of Philosophy', 'දර්ශනපති උපාධිය', 'முதுதத்துவமாணிப் பட்டம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 66);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('6bba787d-12df-4dde-bc98-356a5cda572c', 'FSSH-DEG-1', 'Faculty of Social Sciences & Humanities', 1, 'Postgraduate Diploma in Education', 'පශ්චාත් උපාධි අධ්‍යාපන ඩිප්ලෝමා උපාධිය', 'பட்டப்பின் படிப்பு டிப்ளோமா பட்டம் - கல்வியியல்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 67);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('6288f834-b677-495a-8bf2-02f87573d52e', 'FSSH-DEG-2', 'Faculty of Social Sciences & Humanities', 2, 'Bachelor of Arts', 'ශාස්ත්‍රවේදී උපාධිය', 'கலைமாணிப் பட்டம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 68);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('688948fc-5b32-4f96-ba14-8d163cebed36', 'FSSH-DEG-3', 'Faculty of Social Sciences & Humanities', 3, 'Bachelor of Arts Honours in Archeology and Heritage Management', 'පුරාවිද්‍යා සහ උරුම කළමනාකරණය ශාස්ත්‍රවේදී ගෞරව උපාධිය', 'கௌரவ கலைமாணி பட்டம் - தொல்லியல் மற்றும் மரபுரிமை முகாமைத்துவம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 69);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('4c238346-38ad-45ca-ab0c-6e34b4accdff', 'FSSH-DEG-4', 'Faculty of Social Sciences & Humanities', 4, 'Bachelor of Arts Honours  in Sociology', 'සමාජ විද්‍යාව ශාස්ත්‍රවේදී ගෞරව උපාධිය', 'கௌரவ கலைமாணி பட்டம் - சமூக விஞ்ஞானம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 70);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('1d7fbfa3-95d6-43f9-ac42-95a25a7ad226', 'FSSH-DEG-5', 'Faculty of Social Sciences & Humanities', 5, 'Bachelor of Arts Honours in History', 'ඉතිහාසය ශාස්ත්‍රවේදී ගෞරව උපාධිය', 'கௌரவ கலைமாணி பட்டம் - வரலாறு', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 71);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('e7d458d6-bcc1-4832-a167-d72b188f6b9d', 'FSSH-DEG-6', 'Faculty of Social Sciences & Humanities', 6, 'Bachelor of Arts Honours in Sinhala', 'සිංහල ශාස්ත්‍රවේදී ගෞරව උපාධිය', 'கௌரவ கலைமாணி பட்டம் - சிங்களம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 72);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('af3c7333-b1e9-48af-afeb-0d0583e1cbb5', 'FSSH-DEG-7', 'Faculty of Social Sciences & Humanities', 7, 'Bachelor of Arts Honours in Economics', 'ආර්ථික විද්‍යාව ශාස්ත්‍රවේදී ගෞරව උපාධිය', 'கௌரவ கலைமாணி பட்டம் - பொருளியல்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 73);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('3efe741d-718d-4603-a0be-db1ca4855096', 'FSSH-DEG-8', 'Faculty of Social Sciences & Humanities', 8, 'Bachelor of Arts Honours in Mass Communication', 'ජන සන්නිවේදනය ශාස්ත්‍රවේදී ගෞරව උපාධිය', 'கௌரவ கலைமாணி பட்டம் - வெகுஜன தொடர்பாடல்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 74);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('a55d3226-9c3f-4854-96dc-b9c7ab739823', 'FSSH-DEG-9', 'Faculty of Social Sciences & Humanities', 9, 'Bachelor of Arts Honours in Environmental Management', 'පරිසර කළමනාකරණය ශාස්ත්‍රවේදී ගෞරව උපාධිය', 'கௌரவ கலைமாணி பட்டம் - சுற்றுச்சூழல் முகமைத்துவம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 75);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('314e5219-0730-4940-a5ec-42610012165c', 'FT-DEG-1', 'Faculty of Technology', 1, 'Bachelor of Biosystems Technology Honours Degree in Bioprocess Technology', 'ජෛවපද්ධති තාක්ෂණවේදි ගෞරව උපාධිය - ජෛව ක්‍රියාවලි තාක්ෂණය', 'உயிர் முறைமைகள் தொழில்நுட்ப கௌரவ இளமாணிப் பட்டம் - உயிர் செயன்முறை தொழில்நுட்பம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 76);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('80efb5b2-99a9-42e7-b240-7d989e10bee1', 'FT-DEG-2', 'Faculty of Technology', 2, 'Bachelor of Biosystems Technology Honours Degree in Food Technology', 'ජෛවපද්ධති තාක්ෂණවේදි ගෞරව උපාධිය - ආහාර තාක්ෂණය', 'உயிர் முறைமைகள் தொழில்நுட்ப கௌரவ இளமாணிப் பட்டம் -  உணவு தொழிநுட்பம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 77);
INSERT INTO "degrees" ("id", "code", "faculty", "degree_no", "name_en", "name_si", "name_ta", "type", "created_at", "updated_at", "import_order") VALUES ('c30ea995-0ad0-4884-9a66-2969558e49bc', 'FT-DEG-3', 'Faculty of Technology', 3, 'Bachelor of Engineering Technology Honours Degree in Electrical and Electronic Technology', 'ඉංජිනේරු තාක්ෂණවේදි ගෞරව උපාධිය- විදුලි හා විද්‍යුත් තාක්ෂණය', 'பொறியியல்  தொழில்நுட்ப கௌரவ இளமாணிப் பட்டம் - மின் மற்றும் மின்னணு தொழிநுட்பம்', 'Internal', '2026-06-10T09:36:17.495Z', '2026-06-11T13:21:21.804Z', 78);

SELECT setval('public.degrees_import_order_seq', COALESCE((SELECT MAX("import_order") FROM "degrees"), 1), COALESCE((SELECT MAX("import_order") FROM "degrees") IS NOT NULL, false));
-- Data for email_templates
INSERT INTO "email_templates" ("template_key", "subject", "body", "updated_at") VALUES ('otp', 'Verification Code', '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Verification Code</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; } .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); } .header { background: #1e3a8a; padding: 32px; text-align: center; } .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; } .body { padding: 40px 32px; } .intro { font-size: 15px; color: #334155; line-height: 1.6; margin-top: 0; } .otp-card { background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin: 32px 0; border: 1px dashed #cbd5e1; } .otp-code { font-size: 32px; font-weight: 800; color: #1e3a8a; letter-spacing: 6px; font-family: Courier, monospace; margin: 0; } .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; } .alert { color: #ef4444; font-weight: 600; margin-top: 16px; font-size: 13px; }</style></head><body><div class="container"><div class="header"><h1>University Graduation Portal</h1></div><div class="body"><p class="intro">Hello student,</p><p class="intro">You requested a verification code to access your Graduation Self-Service Portal. Please use the following single-use passcode:</p><div class="otp-card"><div class="otp-code">{{otp_code}}</div></div><p class="intro">This code is cryptographically locked to your session and will automatically expire in <strong>5 minutes</strong>.</p><p class="alert">If you did not initiate this request, please ignore this email immediately.</p></div><div class="footer">&copy; 2026 University Exam Division. This email was sent automatically.</div></div></body></html>', '2026-06-11T09:22:33.291Z');
INSERT INTO "email_templates" ("template_key", "subject", "body", "updated_at") VALUES ('rejection', 'Graduation Registration Rejected', '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Graduation Registration Rejected</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; } .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); } .header { background: #b91c1c; padding: 32px; text-align: center; } .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; } .body { padding: 40px 32px; } .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; } .text { font-size: 15px; color: #334155; line-height: 1.6; } .reason-card { background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0; padding: 20px; text-align: left; margin: 28px 0; } .reason-title { font-weight: 700; color: #991b1b; font-size: 14px; margin-bottom: 6px; } .reason-text { font-size: 13.5px; color: #7f1d1d; line-height: 1.5; margin: 0; } .cta-area { text-align: center; margin: 36px 0; } .button { display: inline-block; background-color: #dc2626; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 14px 28px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 10px rgba(220, 38, 38, 0.2); } .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }</style></head><body><div class="container"><div class="header"><h1>Graduation Registry Correction Alert</h1></div><div class="body"><p class="greeting">Dear {{student_name}},</p><p class="text">Upon review by the Exam Division Coordinator, your graduation registration details have been <strong>rejected and unlocked for editing</strong>.</p><div class="reason-card"><div class="reason-title">Reason for spelling or document rejection:</div><p class="reason-text">{{rejection_reason}}</p></div><p class="text">Your profile has been temporarily unlocked. Please click the button below to log back into your portal, edit your details, upload correct documentation (photographs/payment slips), and re-submit your registration for confirmation:</p><div class="cta-area"><a href="{{login_url}}" class="button" target="_blank">Correct Registration Details</a></div></div><div class="footer">&copy; 2026 University Exam Division. This email was sent automatically.</div></div></body></html>', '2026-06-11T09:22:33.291Z');
INSERT INTO "email_templates" ("template_key", "subject", "body", "updated_at") VALUES ('confirmation', 'Convocation Seat Confirmation', '<!DOCTYPE html>
<html suppresshydrationwarning="true" data-qb-installed="true"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convocation Seat Confirmation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #1e3a8a; padding: 32px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; }
    .body { padding: 40px 32px; }
    .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; }
    .text { font-size: 15px; color: #334155; line-height: 1.6; }
    .seating-card { background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 32px 0; border: 1px dashed #cbd5e1; }
    .seating-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; text-align: center; }
    .seating-item { background: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .seating-label { font-size: 11px; text-transform: uppercase; font-weight: bold; color: #64748b; }
    .seating-value { font-size: 18px; font-weight: 800; color: #1e3a8a; margin-top: 4px; }
    .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }
  </style>
<style>
      body:focus { outline: none !important; }
      * { outline: none !important; }
    </style><style></style><style>
      body:focus { outline: none !important; }
      * { outline: none !important; }
    </style><style></style><style>
      body:focus { outline: none !important; }
      * { outline: none !important; }
    </style><style></style><style>
      body:focus { outline: none !important; }
      * { outline: none !important; }
    </style><style></style><style>
      body:focus { outline: none !important; }
      * { outline: none !important; }
    </style><style></style><style>
      body:focus { outline: none !important; }
      * { outline: none !important; }
    </style><style></style></head>
<body contenteditable="true" spellcheck="false" data-new-gr-c-s-check-loaded="14.1303.0" data-gr-ext-installed="" data-new-gr-c-s-loaded="14.1303.0">
  <div class="container">
    <div class="header">
      <h1>Convocation Seating Confirmation</h1>
    </div>
    <div class="body">
      <p class="greeting">Dear {{student_name}},</p>
      <p class="text"><span style="font-family: Arial, Helvetica, sans-serif;">Your graduation registration details have been verified and approved by the Exam Division. </span>Your seating and session allocation for the upcoming Convocation of the Rajarata University of Sri Lanka has been finalized. Please find your seat and certificate details below:</p>
      <div class="seating-card">
        <div class="seating-grid">
          <div class="seating-item">
            <div class="seating-label">Session Number</div>
            <div class="seating-value">Session {{session_number}}</div>
          </div>
          <div class="seating-item">
            <div class="seating-label">Seat Number</div>
            <div class="seating-value">Seat {{seat_number}}</div>
          </div>
        </div>
        <div style="margin-top: 16px; text-align: center; background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div class="seating-label">Certificate Serial Number</div>
          <div class="seating-value" style="font-size: 16px;">{{certificate_number}}</div>
        </div>
      </div>
      <p class="text"><b><u>Obtaining Ceremonial Cloak, Garland &amp; Documents</u></b><br><br>Ceremonial Cloak, Garland &amp; Documents can be obtaioned on following days during the office hours (08.30 a.m. - 04.30 p.m.) at the Main Administration Building of Rajarata University of Sri Lanka. It is compulsory to submit your student your Student Record Book and Student Identity Card to obtain the Cloak, Garland, &amp; any other documents. The Cloak and Garland will not be issued on the day of the Convocation and to any other person under any circumstances.<br></p><ul><li><b>19th July 2026</b></li><li><b>20th July 2026</b></li><li><b>26th July 2026</b></li><li><b>27th July 2026</b></li></ul><p class="text">Degree certificate can be obtained during office hours from the Deputy Registrar/ Examinations &amp; Academic, Rajarata University of Sri Lanka, Mihintale after returning the cloak and the garland after your session. It is compulsory to submit your Admission Card, Student Identity Card &amp; Record Book to obtain the degree certificate.&nbsp;</p><p class="text">The relevant graduate can obtain the Degree Certificate from Deputy Registrar/ Examinations &amp; Academic only personally. Degree Certificate <b><u>Will Not Be Issued or Handed Over To A Third Party.</u></b></p><p class="text"><i>Please note that university shall not be responsible for the certificates which are not taken within 03 (Three) months after the Convocation.</i></p><p class="text">We look forward to seeing you at the convocation.</p>
    </div>
    <div class="footer">© 2026 University Exam Division. This email was sent automatically.</div>
  </div>

<grammarly-desktop-integration data-grammarly-shadow-root="true" style="visibility: visible !important;"></grammarly-desktop-integration></body></html>', '2026-06-18T21:09:46.151Z');
INSERT INTO "email_templates" ("template_key", "subject", "body", "updated_at") VALUES ('absentia', 'Graduation Registration Confirmed - In Absentia', '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Registration Confirmed</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; } .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); } .header { background: #1e3a8a; padding: 32px; text-align: center; } .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; } .body { padding: 40px 32px; } .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; } .text { font-size: 15px; color: #334155; line-height: 1.6; } .details-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; } .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; } .details-row:last-child { border-bottom: none; } .details-label { font-size: 13px; color: #64748b; font-weight: 600; } .details-value { font-size: 14px; color: #0f172a; font-weight: 700; font-family: monospace; } .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }</style></head><body><div class="container"><div class="header"><h1>Registration Confirmed</h1></div><div class="body"><p class="greeting">Dear {{student_name}},</p><p class="text">Your graduation registration details have been verified and approved by the Exam Division. We have recorded your response that you will be graduating <strong>in absentia</strong> (not attending the convocation ceremony).</p><p class="text">Your certificate number has been allocated:</p><div class="details-card"><div class="details-row"><span class="details-label">Certificate Number:</span><span class="details-value">{{certificate_number}}</span></div></div><p class="text"><strong>Material & Certificate Collection Details:</strong></p><div class="details-card"><div class="details-row"><span class="details-label">Collection Date:</span><span class="details-value">Starting October 15, 2026</span></div><div class="details-row"><span class="details-label">Collection Time:</span><span class="details-value">09:00 AM - 04:00 PM (Weekdays)</span></div><div class="details-row"><span class="details-label">Collection Place:</span><span class="details-value">Exam Division Office, RUSL</span></div></div><p class="text">Please bring your University Student Identity Card or National Identity Card (NIC) to collect your certificate and materials.</p></div><div class="footer">&copy; 2026 University Exam Division. This email was sent automatically.</div></div></body></html>', '2026-06-16T20:06:13.079Z');
INSERT INTO "email_templates" ("template_key", "subject", "body", "updated_at") VALUES ('in_absentia', 'Graduation Registration Confirmed - In Absentia', '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Registration Confirmed - In Absentia</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; } .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); } .header { background: #1e3a8a; padding: 32px; text-align: center; } .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; } .body { padding: 40px 32px; } .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; } .text { font-size: 15px; color: #334155; line-height: 1.6; } .details-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; } .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; } .details-row:last-child { border-bottom: none; } .details-label { font-size: 13px; color: #64748b; font-weight: 600; } .details-value { font-size: 14px; color: #0f172a; font-weight: 700; font-family: monospace; } .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }</style></head><body><div class="container"><div class="header"><h1>Registration Confirmed</h1></div><div class="body"><p class="greeting">Dear {{student_name}},</p><p class="text">Your graduation registration details have been verified and approved by the Exam Division. Since you chose to graduate in absentia (not attending the convocation ceremony), your certificate has been allocated:</p><div class="details-card"><div class="details-row"><span class="details-label">Graduation Status:</span><span class="details-value">In Absentia</span></div><div class="details-row"><span class="details-label">Certificate Number:</span><span class="details-value">{{certificate_number}}</span></div></div><p class="text">Please contact the Exam Division office to collect your certificate or for instructions regarding certificate postage details.</p></div><div class="footer">&copy; 2026 University Exam Division. This email was sent automatically.</div></div></body></html>', '2026-06-18T09:56:21.720Z');
INSERT INTO "email_templates" ("template_key", "subject", "body", "updated_at") VALUES ('magic_link', 'Convocation Registration - Action Required', '<!DOCTYPE html>
<html suppresshydrationwarning="true" data-qb-installed="true"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Graduation Onboarding Portal</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; } .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); } .header { background: #1e3a8a; padding: 32px; text-align: center; } .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; } .body { padding: 40px 32px; } .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; } .text { font-size: 15px; color: #334155; line-height: 1.6; } .cta-area { text-align: center; margin: 36px 0; } .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 14px 28px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2); } .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }</style><style>
      body:focus { outline: none !important; }
      * { outline: none !important; }
    </style><style></style><style>
      body:focus { outline: none !important; }
      * { outline: none !important; }
    </style><style></style></head><body contenteditable="true" spellcheck="false" data-new-gr-c-s-check-loaded="14.1303.0" data-gr-ext-installed="" data-new-gr-c-s-loaded="14.1303.0"><div class="container"><div class="header"><h1>University Graduation Portal</h1></div><div class="body"><p class="greeting">Dear {{student_name}},</p><p class="text">Your completed academic records have been successfully imported into the Graduation Registry. Registration for the upcoming convocation is now open.{{portal_window}}</p>{{session_details_table}}<p class="text">Please click the button below to enter your secure portal, verify your billing address, confirm names translation, upload certificates documentation, and lock your seating seat number allocation:</p><div class="cta-area"><a href="{{magic_link_url}}" class="button" target="_blank">Access Graduation Portal</a></div><p class="text"><em>Note: This magic link is cryptographically tied to your email and is valid for 30 days. Do not share this email with others.</em></p></div><div class="footer">© 2026 University Exam Division. This email was sent automatically.</div></div><grammarly-desktop-integration data-grammarly-shadow-root="true" style="visibility: visible !important;"></grammarly-desktop-integration></body></html>', '2026-06-18T22:07:15.253Z');

-- Data for faculties
INSERT INTO "faculties" ("id", "name", "created_at") VALUES ('b324a3d7-aa2f-4054-b24b-758fabe3ca87', 'Faculty of Agriculture', '2026-06-11T09:22:32.775Z');
INSERT INTO "faculties" ("id", "name", "created_at") VALUES ('d6954702-b3d5-412e-a75e-2f26a93d4116', 'Faculty of Applied Sciences', '2026-06-11T09:22:32.775Z');
INSERT INTO "faculties" ("id", "name", "created_at") VALUES ('479e38c3-7243-4990-8c69-b804f9d1bdf9', 'Faculty of Management Studies', '2026-06-11T09:22:32.775Z');
INSERT INTO "faculties" ("id", "name", "created_at") VALUES ('f10d7ae1-fd74-48ee-a0a4-3fab9b7f891f', 'Faculty of Medicine and Allied Sciences', '2026-06-11T09:22:32.775Z');
INSERT INTO "faculties" ("id", "name", "created_at") VALUES ('c674ccec-eef9-4782-8ce8-80854b69e62d', 'Faculty of Social Sciences & Humanities', '2026-06-11T09:22:32.775Z');
INSERT INTO "faculties" ("id", "name", "created_at") VALUES ('5910ba72-b9fc-4272-9c71-22bc1a3ec0b4', 'Faculty of Technology', '2026-06-11T09:22:32.775Z');

-- Data for registration_windows
INSERT INTO "registration_windows" ("id", "open_date", "close_date", "is_manually_closed", "created_at", "convocation_year", "is_active") VALUES (23, '2026-06-20T07:14:00.000Z', '2026-06-21T18:06:00.000Z', FALSE, '2026-06-10T18:26:17.302Z', '2026', TRUE);
INSERT INTO "registration_windows" ("id", "open_date", "close_date", "is_manually_closed", "created_at", "convocation_year", "is_active") VALUES (25, '2026-06-12T19:35:00.000Z', '2026-06-13T17:10:00.000Z', FALSE, '2026-06-11T15:13:16.193Z', '2027', FALSE);

SELECT setval('public.registration_windows_id_seq', COALESCE((SELECT MAX("id") FROM "registration_windows"), 1), COALESCE((SELECT MAX("id") FROM "registration_windows") IS NOT NULL, false));
-- Data for staff
INSERT INTO "staff" ("id", "username", "password_hash", "name", "role", "created_at", "status") VALUES ('e3172574-8eb0-4e65-9320-64810b2641db', 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'Exam Division Admin', 'Administrator', '2026-06-04T08:40:59.862Z', 'Active');
INSERT INTO "staff" ("id", "username", "password_hash", "name", "role", "created_at", "status") VALUES ('4ce880c4-5027-4cfb-830e-fe1370f14c33', 'tharusha', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'Tharusha Pathirana', 'Staff', '2026-06-11T14:26:47.665Z', 'Active');
INSERT INTO "staff" ("id", "username", "password_hash", "name", "role", "created_at", "status") VALUES ('6aa19ffa-a8c2-4f28-847f-23e9a9eb5e86', 'pasindu', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'Pasindu Sachintha', 'Staff', '2026-06-12T10:17:58.180Z', 'Active');

-- Data for students
INSERT INTO "students" ("id", "index_no", "nic_no", "registration_no", "email", "name_with_initials", "full_name", "faculty", "degree_id", "address", "contact_no", "gpa", "class", "attendance_confirmed", "profile_photo_path", "payment_slip_path", "name_correction_request", "confirmed_at", "verification_status", "session_number", "seat_number", "certificate_number", "created_at", "updated_at", "attending_convocation", "email_sent", "magic_token", "convocation_year", "confirmation_email_sent", "import_order", "timeline_bypass", "effective_date", "graduation_date") VALUES ('0c1c21ad-3669-4efd-a4cb-0509314fb725', '2060', '200210201330', 'ITT/2022/080', 'thanushanga@gmail.com', 'H.P.T.A.Pathirana', 'Heeralu Pathirannahalage Tharusha Pathirana', 'Faculty of Applied Sciences', '660c8a39-dd99-4e0a-ad98-6f80f51c2daf', 'Dutugamunu boys hostel', '074-2831800', NULL, 'SECOND CLASS(LOWER DIVISION)', TRUE, '/uploads/ITT_2022_080_photo_1781940061809.jpg', '/uploads/ITT_2022_080_slip_1781940069811.jpg', NULL, '2026-06-20T07:21:21.556Z', 'Approved', 1, 1, '20260001', '2026-06-20T07:19:06.408Z', '2026-06-20T07:21:39.280Z', TRUE, TRUE, 'eyJlbWFpbCI6InRoYW51c2hhbmdhQGdtYWlsLmNvbSIsInJlZ2lzdHJhdGlvbl9ubyI6IklUVC8yMDIyLzA4MCIsImNvbnZvY2F0aW9uX3llYXIiOiIyMDI2IiwiZXhwIjoxNzg0NTMxOTcyMzY4fQ==.fb217308268b1144bc570757ebd91e92f4de28a1381538cb83f8ff6cdaf89254', '2026', FALSE, 64, FALSE, '2027-12-18T18:30:00.000Z', '2026-12-31T18:30:00.000Z');
INSERT INTO "students" ("id", "index_no", "nic_no", "registration_no", "email", "name_with_initials", "full_name", "faculty", "degree_id", "address", "contact_no", "gpa", "class", "attendance_confirmed", "profile_photo_path", "payment_slip_path", "name_correction_request", "confirmed_at", "verification_status", "session_number", "seat_number", "certificate_number", "created_at", "updated_at", "attending_convocation", "email_sent", "magic_token", "convocation_year", "confirmation_email_sent", "import_order", "timeline_bypass", "effective_date", "graduation_date") VALUES ('c6586814-5f28-4bf3-81a4-f7e482720747', NULL, '200210201331', 'ITT/2022/081', 'itt2022080@tec.rjt.ac.lk', 'H.S.T.Pathirana', 'Thimira Pathirana', 'Faculty of Applied Sciences', '660c8a39-dd99-4e0a-ad98-6f80f51c2daf', 'Dutugamunu boys hostel', '075-4969504', '3.29', 'SECOND CLASS(LOWER DIVISION)', FALSE, NULL, NULL, NULL, NULL, 'Pending Verification', NULL, NULL, NULL, '2026-06-20T07:19:06.408Z', '2026-06-20T07:19:06.408Z', NULL, FALSE, 'eyJlbWFpbCI6Iml0dDIwMjIwODBAdGVjLnJqdC5hYy5sayIsInJlZ2lzdHJhdGlvbl9ubyI6IklUVC8yMDIyLzA4MSIsImNvbnZvY2F0aW9uX3llYXIiOiIyMDI2IiwiZXhwIjoxNzg0NTMxOTQ1Njk5fQ==.e41fd8009f2e93b9a2cbddf8d3258d236f0f25c91e750fb805453262c1ec66a7', '2026', FALSE, 65, FALSE, '2027-12-18T18:30:00.000Z', '2026-12-31T18:30:00.000Z');
INSERT INTO "students" ("id", "index_no", "nic_no", "registration_no", "email", "name_with_initials", "full_name", "faculty", "degree_id", "address", "contact_no", "gpa", "class", "attendance_confirmed", "profile_photo_path", "payment_slip_path", "name_correction_request", "confirmed_at", "verification_status", "session_number", "seat_number", "certificate_number", "created_at", "updated_at", "attending_convocation", "email_sent", "magic_token", "convocation_year", "confirmation_email_sent", "import_order", "timeline_bypass", "effective_date", "graduation_date") VALUES ('bfd99159-5222-4522-aff1-36b18a80a8f2', 'ITT-2060', '200210201332', 'ITT/2022/082', 'anushan411@gmail.com', 'H.P.T.A.Pathirana', 'Heeralu Pathirannahalage Tharusha Pathirana', 'Faculty of Applied Sciences', '660c8a39-dd99-4e0a-ad98-6f80f51c2daf', 'Dutugamunu boys hostel', '074-2831800', '3.61', 'FIRST CLASS', FALSE, NULL, NULL, NULL, NULL, 'Pending Verification', NULL, NULL, NULL, '2026-06-20T07:19:06.408Z', '2026-06-20T07:19:06.408Z', NULL, FALSE, 'eyJlbWFpbCI6ImFudXNoYW40MTFAZ21haWwuY29tIiwicmVnaXN0cmF0aW9uX25vIjoiSVRULzIwMjIvMDgyIiwiY29udm9jYXRpb25feWVhciI6IjIwMjYiLCJleHAiOjE3ODQ1MzE5NDU3MDB9.38f1413617d8c59c7df72e0f8d2f80489843cd3ca7b1c2647621aaed5604f3c5', '2026', FALSE, 66, FALSE, '2027-12-18T18:30:00.000Z', '2026-12-31T18:30:00.000Z');

SELECT setval('public.students_import_order_seq', COALESCE((SELECT MAX("import_order") FROM "students"), 1), COALESCE((SELECT MAX("import_order") FROM "students") IS NOT NULL, false));
-- Foreign Key Constraints
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_degree_id_fkey" FOREIGN KEY (degree_id) REFERENCES degrees(id) ON DELETE RESTRICT;

-- Role and Permissions Setup
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user;
  END IF;
END
$$;
GRANT app_user TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
