// Ensures only numbers are returned from a string -- (ex: parseNumber('$1,000') returns '1000')
export const parseNumber = (value: string) => value.replace(/[^\d.]+/g, '');

// Format numbers so that they are displayed with commas -- (ex: formatCurrencyNumber('1000') returns '1,000')
export const formatCurrencyNumber = (value: string) => {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return '';
  }

  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
  });
};

// Format numbers for display in analytics table
export const formatCurrencyNumberForAnalytics = (num: number) => {
  if (num > 0 && num < 0.01) {
    return '<$0.01';
  }

  return '$' + num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Format token counts with abbreviation (K/M) for analytics display
export const formatTokenCount = (tokens: number): string => {
  if (tokens < 1000) {
    return tokens.toLocaleString('en-US');
  }

  if (tokens < 1000000) {
    return (tokens / 1000).toFixed(1) + 'K';
  }

  return (tokens / 1000000).toFixed(1) + 'M';
};

// Calculate cost from token count and cost per token (stored as $/1M tokens)
export const calculateTokenCost = (tokens: number, costPerToken?: number): number => {
  if (!costPerToken || tokens === 0) {
    return 0;
  }
  return (tokens * costPerToken) / 1_000_000;
};
