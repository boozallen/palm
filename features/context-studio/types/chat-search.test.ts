import {
  chatSearchQuery,
  documentSearchQuery,
  chatSearchInitialValues,
  documentSearchInitialValues,
  workflowArtifactSearchQuery,
  workflowArtifactSearchInitialValues,
} from './chat-search';

describe('chatSearchQuery schema', () => {
  it('should accept valid input with all fields', () => {
    const input = {
      search: 'hello',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      excludeAdmins: true,
      timeRange: 'week' as const,
      userGroupId: 'group-1',
      userId: 'user-1',
      page: 1,
      pageSize: 20,
    };

    const result = chatSearchQuery.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept minimal input with defaults', () => {
    const result = chatSearchQuery.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.excludeAdmins).toBe(false);
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it('should reject invalid date format', () => {
    const result = chatSearchQuery.safeParse({ startDate: '01-01-2026' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid timeRange value', () => {
    const result = chatSearchQuery.safeParse({ timeRange: 'decade' });
    expect(result.success).toBe(false);
  });

  it('should accept all valid timeRange values', () => {
    const values = ['week', 'month', 'year', 'forever'] as const;
    for (const timeRange of values) {
      const result = chatSearchQuery.safeParse({ timeRange });
      expect(result.success).toBe(true);
    }
  });

  it('should reject page less than 1', () => {
    const result = chatSearchQuery.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject pageSize greater than 1000', () => {
    const result = chatSearchQuery.safeParse({ pageSize: 1001 });
    expect(result.success).toBe(false);
  });

  it('should have correct initial values', () => {
    expect(chatSearchInitialValues).toEqual({
      search: undefined,
      startDate: undefined,
      endDate: undefined,
      excludeAdmins: false,
      timeRange: undefined,
      userGroupId: undefined,
      userId: undefined,
      page: 1,
      pageSize: 20,
    });
  });
});

describe('workflowArtifactSearchQuery schema', () => {
  it('should accept valid input with all fields', () => {
    const result = workflowArtifactSearchQuery.safeParse({
      search: 'report',
      excludeAdmins: true,
      timeRange: 'month' as const,
      userGroupId: 'group-1',
      userId: 'user-1',
      page: 1,
      pageSize: 20,
    });

    expect(result.success).toBe(true);
  });

  it('should accept minimal input with defaults', () => {
    const result = workflowArtifactSearchQuery.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.excludeAdmins).toBe(false);
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it('should reject invalid timeRange value', () => {
    const result = workflowArtifactSearchQuery.safeParse({ timeRange: 'decade' });
    expect(result.success).toBe(false);
  });

  it('should reject page less than 1', () => {
    const result = workflowArtifactSearchQuery.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject pageSize greater than 1000', () => {
    const result = workflowArtifactSearchQuery.safeParse({ pageSize: 1001 });
    expect(result.success).toBe(false);
  });

  it('should have correct initial values', () => {
    expect(workflowArtifactSearchInitialValues).toEqual({
      search: undefined,
      excludeAdmins: false,
      timeRange: undefined,
      userGroupId: undefined,
      userId: undefined,
      page: 1,
      pageSize: 20,
    });
  });
});

describe('documentSearchQuery schema', () => {
  it('should accept valid input with all fields', () => {
    const input = {
      search: 'report',
      documentType: 'pdf',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      excludeAdmins: true,
      timeRange: 'month' as const,
      userGroupId: 'group-1',
      userId: 'user-1',
      page: 1,
      pageSize: 20,
    };

    const result = documentSearchQuery.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept minimal input with defaults', () => {
    const result = documentSearchQuery.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.excludeAdmins).toBe(false);
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it('should reject invalid date format', () => {
    const result = documentSearchQuery.safeParse({ startDate: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('should accept documentType field', () => {
    const result = documentSearchQuery.safeParse({ documentType: 'xlsx' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.documentType).toBe('xlsx');
    }
  });

  it('should have correct initial values', () => {
    expect(documentSearchInitialValues).toEqual({
      search: undefined,
      documentType: undefined,
      startDate: undefined,
      endDate: undefined,
      excludeAdmins: false,
      timeRange: undefined,
      userGroupId: undefined,
      userId: undefined,
      page: 1,
      pageSize: 20,
    });
  });
});
