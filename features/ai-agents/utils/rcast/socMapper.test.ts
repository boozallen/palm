import { parseLlmResponse } from './socMapper';

describe('socMapper (rcast)', () => {
  describe('parseLlmResponse', () => {
    it('parses valid pipe-delimited response', () => {
      const result = parseLlmResponse('15-1252.00|Software Developers');

      expect(result).toEqual({
        code: '15-1252.00',
        title: 'Software Developers',
      });
    });

    it('parses response with extra whitespace', () => {
      const result = parseLlmResponse('  15-1252.00 | Software Developers  ');

      expect(result).toEqual({
        code: '15-1252.00',
        title: 'Software Developers',
      });
    });

    it('handles markdown code blocks', () => {
      const result = parseLlmResponse('```\n15-1252.00|Software Developers\n```');

      expect(result).toEqual({
        code: '15-1252.00',
        title: 'Software Developers',
      });
    });

    it('handles markdown code blocks with language specifier', () => {
      const result = parseLlmResponse('```text\n15-1252.00|Software Developers\n```');

      expect(result).toEqual({
        code: '15-1252.00',
        title: 'Software Developers',
      });
    });

    it('takes only first line if LLM adds extra explanation', () => {
      const result = parseLlmResponse(
        '15-1252.00|Software Developers\nThis is because...'
      );

      expect(result).toEqual({
        code: '15-1252.00',
        title: 'Software Developers',
      });
    });

    it('returns null for invalid SOC code format (missing decimal)', () => {
      expect(parseLlmResponse('15-1252|Software Developers')).toBeNull();
    });

    it('returns null for invalid SOC code format (wrong structure)', () => {
      expect(parseLlmResponse('151252.00|Software Developers')).toBeNull();
    });

    it('returns null for missing pipe delimiter', () => {
      expect(parseLlmResponse('15-1252.00 Software Developers')).toBeNull();
    });

    it('returns null for empty title', () => {
      expect(parseLlmResponse('15-1252.00|')).toBeNull();
    });

    it('returns null for empty response', () => {
      expect(parseLlmResponse('')).toBeNull();
    });

    it('parses various valid SOC codes', () => {
      const testCases = [
        {
          input: '11-3021.00|Computer and Information Systems Managers',
          code: '11-3021.00',
          title: 'Computer and Information Systems Managers',
        },
        {
          input: '13-1111.00|Management Analysts',
          code: '13-1111.00',
          title: 'Management Analysts',
        },
        {
          input: '15-1212.00|Information Security Analysts',
          code: '15-1212.00',
          title: 'Information Security Analysts',
        },
        {
          input: '17-2031.00|Bioengineers and Biomedical Engineers',
          code: '17-2031.00',
          title: 'Bioengineers and Biomedical Engineers',
        },
      ];

      for (const { input, code, title } of testCases) {
        expect(parseLlmResponse(input)).toEqual({ code, title });
      }
    });
  });
});
