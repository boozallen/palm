import { router } from '@/server/trpc';
import {
  webPolicyCompliance,
  getComplianceStatus,
} from './certa/web-policy-compliance';
import getAvailablePolicies from './certa/get-available-policies';

import { startResearchJob } from './radar/start-research-job';
import { getResearchJobStatus } from './radar/get-research-job-status';
import { getResearchJobResults } from './radar/get-research-job-results';

import uploadRateCard from './rcast/upload-rate-card';
import { getRcastStatus } from './rcast/get-rcast-status';
import getRateCards from './rcast/get-rate-cards';
import getRateCardCategories from './rcast/get-rate-card-categories';
import exportRateCard from './rcast/export-rate-card';
import fetchSalaryComData from './rcast/fetch-salary-com-data';

import analyzeWarrant from './swear/analyze-warrant';
import { getSwearStatus } from './swear/get-swear-status';

import startOdramAnalysis from './odram/start-odram-analysis';
import { getOdramStatus } from './odram/get-odram-status';
import { getOdramUploadUrls } from './odram/get-odram-upload-urls';
import getActiveOdramJob from './odram/get-active-odram-job';
import getOdramResults from './odram/get-odram-results';
import getOdramJobs from './odram/get-odram-jobs';

import analyzeProposal from './prism/analyze-proposal';
import { getPrismStatus } from './prism/get-prism-status';
import getPrismResults from './prism/get-prism-results';
import getPrismJobs from './prism/get-prism-jobs';
import { getPrismUploadUrls } from './prism/get-prism-upload-urls';
import getActivePrismJob from './prism/get-active-prism-job';

import uploadFinancials from './margin/upload-financials';
import { getMarginUploadUrl } from './margin/get-margin-upload-url';
import getMarginAnalyses from './margin/get-margin-analyses';
import getMarginAnalysis from './margin/get-margin-analysis';
import exportMarginAnalysis from './margin/export-margin-analysis';

export default router({
  webPolicyCompliance,
  getComplianceStatus,
  getAvailablePolicies,
  startResearchJob,
  getResearchJobStatus,
  getResearchJobResults,

  uploadRateCard,
  getRcastStatus,
  getRateCards,
  getRateCardCategories,
  exportRateCard,
  fetchSalaryComData,
  analyzeWarrant,
  getSwearStatus,
  startOdramAnalysis,
  getOdramStatus,
  getOdramUploadUrls,
  getActiveOdramJob,
  getOdramResults,
  getOdramJobs,
  analyzeProposal,
  getPrismStatus,
  getPrismResults,
  getPrismJobs,
  getPrismUploadUrls,
  getActivePrismJob,
  uploadFinancials,
  getMarginUploadUrl,
  getMarginAnalyses,
  getMarginAnalysis,
  exportMarginAnalysis,
});
