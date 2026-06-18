import { z } from 'zod';

// Module 1: Degree validation schema
export const degreeSchema = z.object({
  code: z.string().min(1, 'Degree Code is required'),
  faculty: z.string().min(1, 'Faculty is required'),
  degree_no: z.coerce.number().int().positive('Degree Number must be a positive integer'),
  name_en: z.string().min(1, 'English name is required'),
  name_si: z.string().min(1, 'Sinhala name is required'),
  name_ta: z.string().min(1, 'Tamil name is required'),
  type: z.enum(['Internal', 'External'], {
    message: 'Degree Type must be either Internal or External',
  }),
});

// Module 2: Single Student record validation schema for Ingestion
export const studentSchema = z.object({
  name_with_initials: z.string().min(1, 'Name with Initials is required'),
  full_name: z.string().min(1, 'Full Name is required'),
  registration_no: z.string().min(1, 'Registration Number is required'),
  index_no: z.string().min(1, 'Index Number is required'),
  nic_no: z.string().min(1, 'NIC Number is required'),
  faculty: z.string().min(1, 'Faculty is required'),
  degree_name: z.string().min(1, 'Degree Name is required'), // This will map to a degree code or name in DB
  address: z.string().min(1, 'Address is required'),
  contact_no: z.string().min(1, 'Contact Number is required'),
  email: z.string().email('Invalid email address'),
  gpa: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      const strVal = String(val).trim();
      if (strVal === "") return undefined;
      if (strVal === "-") return "-";
      const parsed = parseFloat(strVal);
      return isNaN(parsed) ? strVal : parsed;
    },
    z.any().refine(val => val === "-" || (typeof val === "number" && val >= 0 && val <= 4.0), {
      message: 'GPA is required and must be a number or "-"'
    })
  ),
  class: z.string().min(1, 'Class is required'),
});

// Module 3: Timeline validation schema
export const timelineSchema = z.object({
  open_date: z.string().datetime({ message: 'Invalid open datetime' }),
  close_date: z.string().datetime({ message: 'Invalid close datetime' }),
  is_manually_closed: z.boolean().optional(),
}).refine(data => new Date(data.open_date) < new Date(data.close_date), {
  message: 'Close date must be after open date',
  path: ['close_date'],
});
