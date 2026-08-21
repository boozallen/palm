import { router } from '@/server/trpc';
import getAgentServices from './get-agent-services';
import testAgentService from './test-agent-service';

export default router({
  getAgentServices,
  testAgentService,
});
