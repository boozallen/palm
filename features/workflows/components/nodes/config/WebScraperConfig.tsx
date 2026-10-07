/**
 * Web Scraper Configuration Form
 */

import { Stack, TextInput, NumberInput } from '@mantine/core';

interface WebScraperConfigProps {
  config: {
    url?: string;
    maxPages?: number;
  };
  onChange: (config: any) => void;
}

export default function WebScraperConfig({ config, onChange }: WebScraperConfigProps) {
  return (
    <Stack spacing='xs'>
      <TextInput
        label='Website URL'
        placeholder='https://example.com'
        value={config.url || ''}
        onChange={(e) => onChange({ ...config, url: e.currentTarget.value })}
        required
      />

      <NumberInput
        label='Max Pages'
        placeholder='5'
        description='Maximum number of pages to crawl'
        value={config.maxPages || 5}
        onChange={(value) => onChange({ ...config, maxPages: value })}
        min={1}
        max={100}
      />
    </Stack>
  );
}
