import { router } from '@/server/trpc';
import {
  webPolicyCompliance,
  getComplianceStatus,
} from './certa/web-policy-compliance';
import getAvailablePolicies from './certa/get-available-policies';

import { startResearchJob } from './radar/start-research-job';
import { getResearchJobStatus } from './radar/get-research-job-status';
import { getResearchJobResults } from './radar/get-research-job-results';

export default router({
  webPolicyCompliance,
  getComplianceStatus,
  getAvailablePolicies,
  startResearchJob,
  getResearchJobStatus,
  getResearchJobResults,
});
