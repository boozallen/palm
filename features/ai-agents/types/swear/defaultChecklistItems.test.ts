import defaultChecklistItems from './defaultChecklistItems';

describe('defaultChecklistItems', () => {
  it('should export an array of checklist items', () => {
    expect(Array.isArray(defaultChecklistItems)).toBe(true);
    expect(defaultChecklistItems.length).toBeGreaterThan(0);
  });

  it('should have items with required properties', () => {
    defaultChecklistItems.forEach((item) => {
      expect(item).toHaveProperty('category');
      expect(item).toHaveProperty('item');
      expect(item).toHaveProperty('sortOrder');
      expect(typeof item.category).toBe('string');
      expect(typeof item.item).toBe('string');
      expect(typeof item.sortOrder).toBe('number');
    });
  });

  it('should have expected categories', () => {
    const categories = [...new Set(defaultChecklistItems.map((item) => item.category))];
    const expectedCategories = [
      'Preliminary Information',
      'Probable Cause',
      'Particularity',
      'Service of the Warrant',
      'Administrative and Procedural Concerns',
    ];

    expectedCategories.forEach((category) => {
      expect(categories).toContain(category);
    });
  });

  it('should have items with sort orders starting at 1', () => {
    const categories = [...new Set(defaultChecklistItems.map((item) => item.category))];

    categories.forEach((category) => {
      const categoryItems = defaultChecklistItems.filter((item) => item.category === category);
      const sortOrders = categoryItems.map((item) => item.sortOrder);
      expect(Math.min(...sortOrders)).toBe(1);
    });
  });

  it('should have non-empty item descriptions', () => {
    defaultChecklistItems.forEach((item) => {
      expect(item.item.trim().length).toBeGreaterThan(0);
    });
  });
});
