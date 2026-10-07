import db from '@/server/db';
import logger from '@/server/logger';

type TagsResponse = string[];

export default async function getTags(query?: string): Promise<TagsResponse> {
  const distinctField = 'tag';
  try {
    const distinctTags = await db.promptTag.findMany({
      distinct: [distinctField],
      select: {
        tag: true,
      },
      where: {
        tag: {
          contains: query,
          mode: 'insensitive',
        },
      },
      orderBy: {
        tag: 'asc',
      },
      take: 10,
    });

    const tagList = distinctTags.map((distinctTags) => distinctTags.tag);

    return tagList;
  } catch (error) {
    logger.error('Error fetching tags', error);
    throw new Error('Error fetching tags');
  }
}
