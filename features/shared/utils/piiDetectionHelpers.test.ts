import { detectPii } from '@/features/shared/utils/piiDetectionHelpers';

describe('PII Detection Helpers', () => {
  describe('detectPii', () => {
    describe('Email address detection', () => {
      it('should detect single email address', () => {
        const text = 'Contact us at john.doe@example.com for more info';
        const result = detectPii(text);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          content: 'john.doe@example.com',
          startIndex: 14,
        });
      });

      it('should detect multiple email addresses', () => {
        const text = 'Send to jane@company.org and also to admin@test.io';
        const result = detectPii(text);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          content: 'jane@company.org',
          startIndex: 8,
        });
        expect(result[1]).toEqual({
          content: 'admin@test.io',
          startIndex: 37,
        });
      });

      it('should detect emails with various valid formats', () => {
        const text = 'user+tag@domain.co.uk user_name@example.com user123@test.org';
        const result = detectPii(text);

        expect(result).toHaveLength(3);
        expect(result[0].content).toBe('user+tag@domain.co.uk');
        expect(result[1].content).toBe('user_name@example.com');
        expect(result[2].content).toBe('user123@test.org');
      });

      it('should detect emails with dots and hyphens in domain', () => {
        const text = 'Contact support@sub-domain.example.com';
        const result = detectPii(text);

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('support@sub-domain.example.com');
      });

      it('should detect emails at word boundaries', () => {
        const text = 'Email:user@example.com,another@test.org';
        const result = detectPii(text);

        expect(result).toHaveLength(2);
        expect(result[0].content).toBe('user@example.com');
        expect(result[1].content).toBe('another@test.org');
      });
    });

    describe('Edge cases', () => {
      it('should return empty array for text with no PII', () => {
        const text = 'This is just regular text with no sensitive information';
        const result = detectPii(text);

        expect(result).toHaveLength(0);
      });

      it('should return empty array for empty string', () => {
        const text = '';
        const result = detectPii(text);

        expect(result).toHaveLength(0);
      });

      it('should not detect invalid email formats', () => {
        const text = 'Invalid emails: @example.com user@ user@.com user@domain user@domain.';
        const result = detectPii(text);

        expect(result).toHaveLength(0);
      });

      it('should not detect emails without proper TLD', () => {
        const text = 'Not an email: user@localhost user@domain.c';
        const result = detectPii(text);

        expect(result).toHaveLength(0);
      });

      it('should handle text with only spaces', () => {
        const text = '   ';
        const result = detectPii(text);

        expect(result).toHaveLength(0);
      });

      it('should handle newlines and special characters', () => {
        const text = 'Line 1\nContact: user@example.com\nLine 3';
        const result = detectPii(text);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          content: 'user@example.com',
          startIndex: 16,
        });
      });

      it('should detect emails in long text blocks', () => {
        const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10) + 
                        'Contact admin@example.com for assistance. ' +
                        'Lorem ipsum dolor sit amet.'.repeat(5);
        const result = detectPii(longText);

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('admin@example.com');
      });
    });

    describe('Performance and robustness', () => {
      it('should handle very long strings efficiently', () => {
        const longText = 'a'.repeat(10000) + ' user@example.com ' + 'b'.repeat(10000);
        const result = detectPii(longText);

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('user@example.com');
        expect(result[0].startIndex).toBe(10001);
      });

      it('should handle unicode and special characters', () => {
        const text = 'Café email: café@exämple.com and normal@test.org';
        const result = detectPii(text);

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('normal@test.org');
      });
    });
  });
});
