import db from '@/server/db';
import logger from '@/server/logger';

export default async function getMostCommonPromptTags(): Promise<string[]> {
  try {
    const mostCommonPromptTags = await db.promptTag.groupBy({
      by: ['tag'],
      _count: {
        tag: true,
      },
      orderBy: {
        _count: {
          tag: 'desc',
        },
      },
      take: 25,
    });

    const output = mostCommonPromptTags.map((promptTag) => promptTag.tag);

    return output;
  } catch (error) {
    logger.error('Error fetching most common prompt tags', error);
    throw new Error('Error fetching most common prompt tags');
  }
}
