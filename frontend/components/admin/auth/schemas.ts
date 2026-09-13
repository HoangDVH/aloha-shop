import { z } from "zod";

export const staffLoginSchema = z.object({
  username: z.string().trim().min(1, "Nhập tên đăng nhập"),
  password: z.string().min(1, "Nhập mật khẩu"),
});

export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

export type AdminUser = {
  id: string;
  username: string;
  fullName: string;
  role: "manager" | "staff";
  permissions: string[];
  active: boolean;
  approvalStatus?: string;
};
