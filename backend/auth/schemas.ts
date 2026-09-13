import { z } from "zod";

export const loginBodySchema = z.object({
  username: z.string().trim().min(1, "Nhập tài khoản"),
  password: z.string().min(1, "Nhập mật khẩu"),
});

export const registerBodySchema = z.object({
  username: z.string().trim().min(2, "Tài khoản tối thiểu 2 ký tự").max(64),
  password: z.string().min(4, "Mật khẩu tối thiểu 4 ký tự").max(128),
  fullName: z.string().trim().min(1, "Nhập họ tên").max(120),
  role: z.enum(["manager", "staff"]).default("staff"),
  permissions: z.array(z.string()).optional().default([]),
  zaloId: z.string().trim().min(1).optional().nullable(),
});

export const unlockBodySchema = z.object({
  username: z.string().trim().min(1),
});

export const linkZaloBodySchema = z.object({
  username: z.string().trim().min(1),
  zaloId: z.string().trim().min(1),
});

export const publicUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string(),
  role: z.enum(["manager", "staff"]),
  permissions: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  zaloId: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type RegisterBody = z.infer<typeof registerBodySchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
