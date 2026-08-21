import { toUTCTimeStamp } from '@/features/shared/utils/dateUtils';

export function createDateQuery(startDate: string, endDate: string): string {
  const start = toUTCTimeStamp(startDate);
  const end = toUTCTimeStamp(endDate);

  return `(submittedDate:[${start} TO ${end}])`;
}

function removeDuplicateCategories(categories: string[]): string[] {
  return Array.from(new Set(categories));
}

export function createCategoryQuery(categories: string[]): string | null {
  const uniqueCategories = removeDuplicateCategories(categories);
  const categoryQuery = uniqueCategories.map((cat) => `cat:${cat}`).join(' OR ');

  return uniqueCategories.length ?
    `(${categoryQuery})` :
    null;
}
