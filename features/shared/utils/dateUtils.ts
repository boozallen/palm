import { SHARED_DOCUMENT_INVITATION_EXPIRY_DAYS } from '@/features/shared/types/document';
import { SHARED_WORKFLOW_INVITATION_EXPIRY_DAYS } from '@/features/workflows/types/shared-workflow';

const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function getCurrentMonthName() {
  const d = new Date();
  return months[d.getMonth()];
}

export function isoFirstDayOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
}

export function isoLastDayOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString();
}

export function toUTCTimeStamp(isoString: string): string {
  const date = new Date(isoString);

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');

  return `${yyyy}${mm}${dd}${hh}${min}`;
}

export function getSharedDocumentExpirationDate(): Date {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() - SHARED_DOCUMENT_INVITATION_EXPIRY_DAYS);
  return expirationDate;
}

export function getSharedWorkflowExpirationDate(): Date {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() - SHARED_WORKFLOW_INVITATION_EXPIRY_DAYS);
  return expirationDate;
}

export function getTimeUntilExpiration(createdAt: Date, expiryDays: number = SHARED_DOCUMENT_INVITATION_EXPIRY_DAYS): {
  timeRemaining: number;
  timeRemainingText: string;
  isExpired: boolean;
} {
  const now = new Date();
  const expirationDate = new Date(createdAt);
  expirationDate.setDate(expirationDate.getDate() + expiryDays);

  const timeRemaining = expirationDate.getTime() - now.getTime();

  if (timeRemaining <= 0) {
    return {
      timeRemaining: 0,
      timeRemainingText: 'Expired',
      isExpired: true,
    };
  }

  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    if (days === 1) {
      return {
        timeRemaining,
        timeRemainingText: `${days} day${hours > 0 ? `, ${hours}h` : ''}`,
        isExpired: false,
      };
    }
    return {
      timeRemaining,
      timeRemainingText: `${days} days${hours > 0 ? `, ${hours}h` : ''}`,
      isExpired: false,
    };
  }

  if (hours > 0) {
    return {
      timeRemaining,
      timeRemainingText: `${hours}h${minutes > 0 ? `, ${minutes}m` : ''}`,
      isExpired: false,
    };
  }

  return {
    timeRemaining,
    timeRemainingText: `${minutes}m`,
    isExpired: false,
  };
}
