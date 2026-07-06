import { z } from "zod";

// Phone number regex
const phoneRegex = /^[+]?[\d\s()-]{10,15}$/;

// Patient registration validation
export const patientSchema = z.object({
  first_name: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must be less than 50 characters"),

  middle_name: z.string().max(50).optional().or(z.literal("")),

  last_name: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must be less than 50 characters"),

  date_of_birth: z
    .string()
    .min(1, "Date of birth is required")
    .refine((date) => {
      const birthDate = new Date(date);
      const today = new Date();
      return birthDate < today;
    }, "Date of birth cannot be in the future"),

  gender: z.string().min(1, "Gender is required"),

  blood_group: z.string().optional().or(z.literal("")),

  phone: z
    .string()
    .min(1, "Phone number is required")
    .regex(phoneRegex, "Invalid phone number format"),

  alternate_phone: z
    .string()
    .regex(phoneRegex, "Invalid phone number format")
    .optional()
    .or(z.literal("")),

  email: z.string().email("Invalid email address").optional().or(z.literal("")),

  address: z
    .string()
    .max(500, "Address must be less than 500 characters")
    .optional()
    .or(z.literal("")),

  emergency_contact_name: z.string().max(100).optional().or(z.literal("")),

  emergency_contact_phone: z
    .string()
    .regex(phoneRegex, "Invalid phone number format")
    .optional()
    .or(z.literal("")),

  emergency_contact_relation: z.string().max(50).optional().or(z.literal("")),

  allergies: z.string().max(500).optional().or(z.literal("")),

  chronic_conditions: z.string().max(500).optional().or(z.literal("")),
});

// Login validation
export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),

  password: z.string().min(6, "Password must be at least 6 characters"),
});
