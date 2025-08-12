import { AuditorDetails, AuditorOptions } from '@/server/auditor';

export type AuditRecordOutcome = 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO';

export type AuditRecordEvent = 
  | 'CREATE_USER'
  | 'USER_SIGN_IN'
  | 'USER_SIGN_OUT'
  | 'MODIFY_USER_ROLE'
  | 'CREATE_USER_GROUP'
  | 'DELETE_USER_GROUP'
  | 'CREATE_USER_GROUP_MEMBERSHIP'
  | 'DELETE_USER_GROUP_MEMBERSHIP'
  | 'MODIFY_USER_GROUP_MEMBERSHIP_ROLE'
  | 'MODIFY_ACCOUNT';

export interface AuditRecord extends AuditorOptions, AuditorDetails { };
