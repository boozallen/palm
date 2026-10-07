import { router } from '@/server/trpc';

import { synthesizeNarration } from '@/features/video-generation/routes/synthesize-narration';
import { renderToMp4 } from '@/features/video-generation/routes/render-to-mp4';
import { getRenderStatus } from '@/features/video-generation/routes/get-render-status';

export default router({
  synthesizeNarration,
  renderToMp4,
  getRenderStatus,
});
