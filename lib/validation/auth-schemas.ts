import { z } from "zod";

export const LoginSchema = z.object({
  emailOrUsername: z
    .string()
    .min(1, "Email or username is required")
    .max(100, "Username/Email is too long"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password is too long"),
  rememberMe: z.boolean().optional(),
});

export const RegisterSchema = z
  .object({
    firstName: z
      .string()
      .min(1, "First name is required")
      .max(50, "First name is too long"),
    lastName: z
      .string()
      .max(50, "Last name is too long")
      .optional()
      .default(""),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(60, "Username is too long")
      .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, dots, dashes, and underscores")
      .optional(),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address")
      .max(100, "Email is too long"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(128, "Password is too long"),
    confirmPassword: z
      .string()
      .min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const ForgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .max(100, "Email is too long"),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
