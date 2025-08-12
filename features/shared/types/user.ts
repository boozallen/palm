import { z } from 'zod';

export enum UserRole {
  Admin = 'Admin',
  User = 'User',
}

export enum UserRoleIdleTimeMS {
  Admin = 600000, // 10 minutes
  User = 900000,  // 15 minutes
}

export function isValidUserRole(role: any): role is UserRole {
  return Object.values(UserRole).includes(role);
}

export const addAdminFormSchema = z.object({
  userId: z.string().uuid('A user must be selected'),
});

export type AddAdminFormValues = z.infer<typeof addAdminFormSchema>;
