import { z } from 'zod';
import { SelectOption } from './forms';

export const userGroupFormSchema = z.object({
  label: z.string().trim().min(1, 'A label is required'),
});

export type UserGroupForm = z.infer<typeof userGroupFormSchema>;

export const userGroupSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  joinCode: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  memberCount: z.number(),
});

export type UserGroup = z.infer<typeof userGroupSchema>;

export enum UserGroupRole {
  Lead = 'Lead',
  User = 'User',
}

export const UserGroupRoleInputOptions: SelectOption[] = Object.values(UserGroupRole).map(role => ({
  value: role,
  label: role,
}));

export const userGroupMembershipSchema = z.object({
  userGroupId : z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  role: z.nativeEnum(UserGroupRole),
  email: z.string().email().nullable(),
  lastLoginAt: z.date().nullable(),
});

export type UserGroupMembership = z.infer<typeof userGroupMembershipSchema>;

export const userGroupMemberFormSchema = z.object({
  userId: z.string().uuid('A user must be selected'),
  role: z.nativeEnum(UserGroupRole),
});

export type UserGroupMemberForm = z.infer<typeof userGroupMemberFormSchema>;
