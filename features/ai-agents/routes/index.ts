import { router } from '@/server/trpc';
import {
  webPolicyCompliance,
  getComplianceStatus,
} from './certa/web-policy-compliance';
import getAvailablePolicies from './certa/get-available-policies';

export default router({
  webPolicyCompliance,
  getComplianceStatus,
  getAvailablePolicies,
});
