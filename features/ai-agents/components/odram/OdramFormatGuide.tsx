import { Text, Alert } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

export default function OdramFormatGuide() {
  return (
    <Alert icon={<IconInfoCircle size={16} />} color='blue' variant='light' p='xs' styles={{ wrapper: { alignItems: 'center' } }}>
      <Text size='xs'>
        The ODRAM responses spreadsheet should have a <strong>Forms</strong> sheet with one header row
        and one data row per ODRAM submission (Jira export format). The Prompt Matrix spreadsheet should
        have a <strong>Prompts</strong> sheet with question names, risk definitions, and handbook guidance.
        PDF and docx ODRAM files are still accepted but will require an extra LLM call to extract team responses.
      </Text>
    </Alert>
  );
}
