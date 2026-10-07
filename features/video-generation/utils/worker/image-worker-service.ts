import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

import { getConfig } from '@/server/config';
import { logger } from '@/server/logger';

const NOVA_CANVAS_MODEL = 'amazon.nova-canvas-v1:0';

function buildPrompt(query: string): string {
  return `cinematic professional photography: ${query}, beautiful natural lighting, sharp focus, photorealistic, high quality`;
}

function buildNegativePrompt(): string {
  return 'text, watermark, logo, blurry, low quality, pixelated, cartoon, illustration, distorted, ugly, oversaturated, people, faces, person';
}

export function queryToSeed(q: string, seedParam: string): number {
  const n = parseInt(seedParam, 10);
  if (!isNaN(n)) {
    return n % 2147483647;
  }
  let hash = 0;
  const combined = q + seedParam;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2147483647;
}

type BedrockImageResponse = {
  images?: string[];
};

export async function tryNovaCanvas(q: string, seed: number): Promise<Buffer | null> {
  const config = getConfig().bedrock;
  if (!config.accessKeyId || !config.secretAccessKey) {
    return null;
  }

  const client = new BedrockRuntimeClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      ...(config.sessionToken ? { sessionToken: config.sessionToken } : {}),
    },
  });

  try {
    const command = new InvokeModelCommand({
      modelId: NOVA_CANVAS_MODEL,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        taskType: 'TEXT_IMAGE',
        textToImageParams: {
          text: buildPrompt(q),
          negativeText: buildNegativePrompt(),
        },
        imageGenerationConfig: {
          numberOfImages: 1,
          height: 512,
          width: 512,
          cfgScale: 7.5,
          seed,
          quality: 'standard',
        },
      }),
    });
    const response = await client.send(command);
    const body = JSON.parse(new TextDecoder().decode(response.body)) as BedrockImageResponse;
    const base64 = body.images?.[0];
    if (!base64) {
      return null;
    }
    return Buffer.from(base64, 'base64');
  } catch (err) {
    logger.warn('Nova Canvas failed in imageService', { error: err, q });
    return null;
  }
}

export async function fetchImageAsDataUrl(
  searchTerm: string,
  seed: number,
): Promise<string | null> {
  const imageBuffer = await tryNovaCanvas(searchTerm, seed);
  if (imageBuffer) {
    return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  }

  return null;
}
