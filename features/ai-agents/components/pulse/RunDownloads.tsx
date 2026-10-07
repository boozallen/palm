import { useState, type ReactNode } from 'react';
import { Button, Group, Stack, Text, Title } from '@mantine/core';
import {
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconLayoutDashboard,
  IconPresentation,
} from '@tabler/icons-react';

import usePulseOutput from '@/features/ai-agents/api/pulse/get-pulse-output';
import buildResultsWorkbook from '@/features/ai-agents/utils/pulse/buildResultsWorkbook';
import downloadBlob from '@/features/ai-agents/utils/pulse/downloadBlob';
import showPulseError from '@/features/ai-agents/utils/pulse/showPulseError';
import { LEGACY_OUTPUT_REASON } from '@/features/ai-agents/utils/pulse/outputReasons';
import type { PulseOutputKind, PulseRunView } from '@/features/ai-agents/types/pulse/results';
import type { PulseFieldSummary, PulseResult } from '@/features/ai-agents/types/pulse/surveyAnalysis';

const DEFAULT_STEM = 'pulse';

type DownloadKind = 'xlsx' | PulseOutputKind;

const DOWNLOADS: Array<{ kind: DownloadKind; label: string; icon: ReactNode }> = [
  { kind: 'xlsx', label: 'Results spreadsheet (.xlsx)', icon: <IconFileSpreadsheet size={16} /> },
  { kind: 'dashboard', label: 'Results dashboard (.html)', icon: <IconLayoutDashboard size={16} /> },
  { kind: 'pdf', label: 'Executive summary (.pdf)', icon: <IconFileTypePdf size={16} /> },
  { kind: 'slides', label: 'Slides (.html)', icon: <IconPresentation size={16} /> },
];

const OUTPUT_FILE_SUFFIX: Record<PulseOutputKind, string> = {
  dashboard: 'results-dashboard.html',
  pdf: 'executive-summary.pdf',
  slides: 'slides.html',
};

export function fileStem(surveyFilename: string): string {
  const stem = surveyFilename.replace(/\.[^.]*$/, '').trim();

  return stem.length > 0 ? stem : DEFAULT_STEM;
}

function decodeBase64(content: string) {
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

type PulseOutputPayload = { mimeType: string; encoding: 'utf8' | 'base64'; content: string };

// The PDF travels as base64 over tRPC; the HTML outputs are plain text.
function toOutputBlob({ mimeType, encoding, content }: PulseOutputPayload): Blob {
  if (encoding === 'base64') {
    return new Blob([decodeBase64(content)], { type: mimeType });
  }

  return new Blob([content], { type: `${mimeType};charset=utf-8` });
}

type RunDownloadsProps = Readonly<{
  agentId: string;
  run: PulseRunView;
  fields: PulseFieldSummary[];
  results: PulseResult[];
}>;

export default function RunDownloads({ agentId, run, fields, results }: RunDownloadsProps) {
  const [pending, setPending] = useState<DownloadKind | null>(null);
  const { fetch: fetchOutput } = usePulseOutput();
  const stem = fileStem(run.surveyFilename);

  // The spreadsheet is built from the saved rows, so it is always available.
  const reasonFor = (kind: DownloadKind): string | null => {
    if (kind === 'xlsx') {
      return null;
    }

    return run.outputs[kind];
  };

  // The legacy note above already says it once, for every output at the same time.
  const statedReasons = DOWNLOADS
    .map(({ kind, label }) => ({ kind, label, reason: reasonFor(kind) }))
    .filter((entry) => entry.reason !== null && entry.reason !== LEGACY_OUTPUT_REASON);
  const statedKinds = new Set(statedReasons.map((entry) => entry.kind));

  const handleDownload = async (kind: DownloadKind) => {
    setPending(kind);

    try {
      if (kind === 'xlsx') {
        const workbook = await buildResultsWorkbook({ results, fields, surveyFilename: run.surveyFilename });

        downloadBlob(workbook, `${stem}-pulse-results.xlsx`);
        return;
      }

      const payload = await fetchOutput({ agentId, jobId: run.id, output: kind });

      downloadBlob(toOutputBlob(payload), `${stem}-${OUTPUT_FILE_SUFFIX[kind]}`);
    } catch (error) {
      showPulseError(error, 'Download failed');
    } finally {
      setPending(null);
    }
  };

  return (
    <Stack spacing='xs' data-testid='pulse-downloads'>
      <Title order={4}>Downloads</Title>

      {run.hasLegacyOutputs && (
        <Text data-testid='pulse-downloads-legacy' size='sm' c='gray.4'>
          {LEGACY_OUTPUT_REASON}
        </Text>
      )}

      <Group spacing='sm'>
        {DOWNLOADS.map(({ kind, label, icon }) => {
          const reason = reasonFor(kind);

          return (
            <Button
              key={kind}
              data-testid={`pulse-download-${kind}`}
              variant='outline'
              leftIcon={icon}
              loading={pending === kind}
              disabled={reason !== null || (pending !== null && pending !== kind)}
              aria-describedby={statedKinds.has(kind) ? `pulse-download-${kind}-reason` : undefined}
              onClick={() => handleDownload(kind)}
            >
              {label}
            </Button>
          );
        })}
      </Group>

      {statedReasons.map(({ kind, label, reason }) => (
        <Text
          key={kind}
          id={`pulse-download-${kind}-reason`}
          data-testid={`pulse-download-${kind}-reason`}
          size='sm'
          c='yellow.5'
        >
          {`${label}: ${reason}`}
        </Text>
      ))}
    </Stack>
  );
}
