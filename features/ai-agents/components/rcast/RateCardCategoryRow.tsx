import React from 'react';
import { Text, Tooltip, Loader, Group, Select } from '@mantine/core';
import { IconInfoCircle, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { BlsWageData, DolWageData, SalaryComWageData } from '@/features/ai-agents/shared/wage-data';
import {
  getPercentileForExperienceLevel,
  createBlsExtractor,
  createDolExtractor,
  createSalaryComExtractor,
  getJuniorWages,
  getWageForPercentile,
  WageDataExtractor,
  calculateAdjustedRate,
  formatFeeTooltip,
} from '@/features/ai-agents/utils/rcast/wageCalculations';
import { PercentileKey, PERCENTILE_LABELS } from '@/features/ai-agents/types/rcast/experienceLevel';
import { CategoryGroup } from './RateCardTable';

const LEVEL_OPTIONS: { value: PercentileKey; label: string }[] = [
  { value: PercentileKey.JUNIOR, label: 'Junior' },
  { value: PercentileKey.PCT_50, label: 'Journeyman' },
  { value: PercentileKey.PCT_75, label: 'Senior' },
  { value: PercentileKey.PCT_90, label: 'SME' },
];

enum WageDisplayType {
  JUNIOR = 'junior',
  SINGLE = 'single',
}

type JuniorWageDisplay = { type: WageDisplayType.JUNIOR; pct10: number | null; pct25: number | null };
type SingleWageDisplay = { type: WageDisplayType.SINGLE; value: number | null; label: string };
type WageDisplay = JuniorWageDisplay | SingleWageDisplay;

function getWageDisplay(extractor: WageDataExtractor, percentile: PercentileKey, rpp: number): WageDisplay {
  if (percentile === PercentileKey.JUNIOR) {
    const { pct10, pct25 } = getJuniorWages(extractor);
    return {
      type: WageDisplayType.JUNIOR,
      pct10: pct10 != null ? pct10 * rpp : null,
      pct25: pct25 != null ? pct25 * rpp : null,
    };
  }
  const raw = getWageForPercentile(extractor, percentile);
  return {
    type: WageDisplayType.SINGLE,
    value: raw != null ? raw * rpp : null,
    label: PERCENTILE_LABELS[percentile],
  };
}

function getBlsWageDisplay(data: BlsWageData, percentile: PercentileKey, rpp: number): WageDisplay {
  return getWageDisplay(createBlsExtractor(data), percentile, rpp);
}
function getDolWageDisplay(data: DolWageData, percentile: PercentileKey, rpp: number): WageDisplay {
  return getWageDisplay(createDolExtractor(data), percentile, rpp);
}
function getSalaryComWageDisplay(data: SalaryComWageData, percentile: PercentileKey, rpp: number): WageDisplay {
  return getWageDisplay(createSalaryComExtractor(data), percentile, rpp);
}

const JUNIOR_LABELS = { PCT_10: '10th pctl', PCT_25: '25th pctl' } as const;
const PERCENTILE_SUFFIX = 'pctl';

function localityNote(multiplier: number): string {
  return multiplier !== 1.0 ? ` × ${multiplier.toFixed(4)} (regional cost adjustment)` : '';
}

function blsTooltip(pct: 'pct10' | 'pct25' | 'pct50' | 'pct75' | 'pct90', value: number, data: BlsWageData, multiplier: number): string {
  const note = localityNote(multiplier);
  const annualMap: Record<typeof pct, number | null | undefined> = {
    pct10: data.percentile10Annual, pct25: data.percentile25Annual,
    pct50: null, pct75: data.percentile75Annual, pct90: data.percentile90Annual,
  };
  const annual = annualMap[pct];
  if (pct === 'pct50') { return `50th pctl: direct hourly data${note} = $${value.toFixed(2)}/hour`; }
  return `${pct.replace('pct', '')}th pctl: $${annual?.toLocaleString() || 'N/A'}/year ÷ 1,920 hours${note} = $${value.toFixed(2)}/hour`;
}

function dolTooltip(pct: 'pct10' | 'pct25' | 'pct50' | 'pct75' | 'pct90', value: number, multiplier: number): string {
  const note = localityNote(multiplier);
  const label = pct.replace('pct', '') + 'th';
  return `${label} pctl: direct hourly data${note} = $${value.toFixed(2)}/hour`;
}

function salaryComTooltip(pct: 'pct10' | 'pct25' | 'pct50' | 'pct75' | 'pct90', value: number, data: SalaryComWageData, multiplier: number): string {
  const base = `Matched: "${data.benchmarkJobTitle}" (${data.matchRating})\n`;
  const keyMap: Record<typeof pct, keyof SalaryComWageData> = {
    pct10: 'salary10', pct25: 'salary25', pct50: 'salary50', pct75: 'salary75', pct90: 'salary90',
  };
  const note = localityNote(multiplier);
  const annual = data[keyMap[pct]] as number;
  const label = pct.replace('pct', '') + 'th';
  return base + `${label} pctl: $${annual?.toLocaleString() || 'N/A'}/year ÷ 1,920 hours${note} = $${value.toFixed(2)}/hour`;
}

function renderWageDisplay(
  display: WageDisplay,
  source: 'bls' | 'dol' | 'salarycom',
  rpp: number,
  sourceData?: BlsWageData | DolWageData | SalaryComWageData,
): React.ReactNode {
  if (display.type === WageDisplayType.JUNIOR) {
    const items: React.ReactNode[] = [];

    const renderJuniorValue = (key: 'pct10' | 'pct25', val: number | null, labelKey: 'PCT_10' | 'PCT_25') => {
      if (val == null) { return null; }
      let tip = '';
      if (source === 'bls' && sourceData) { tip = blsTooltip(key, val, sourceData as BlsWageData, rpp); }
      else if (source === 'dol') { tip = dolTooltip(key, val, rpp); }
      else if (source === 'salarycom' && sourceData) { tip = salaryComTooltip(key, val, sourceData as SalaryComWageData, rpp); }

      return (
        <div key={key}>
          <Tooltip label={tip} multiline>
            <Group spacing={4} align='center'>
              <Text size='sm' style={{ cursor: 'help' }}>${val.toFixed(2)}</Text>
              <IconInfoCircle size={12} style={{ color: 'var(--mantine-color-gray-5)' }} />
            </Group>
          </Tooltip>
          <Text size='xs' c='dimmed' mt={4}>{JUNIOR_LABELS[labelKey]}</Text>
        </div>
      );
    };

    const pct10Item = renderJuniorValue('pct10', display.pct10, 'PCT_10');
    const pct25Item = renderJuniorValue('pct25', display.pct25, 'PCT_25');
    if (pct10Item) { items.push(pct10Item); }
    if (pct25Item) { items.push(pct25Item); }
    return items.length > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{items}</div> : null;
  }

  if (display.value != null) {
    const pctKeyMap: Record<string, 'pct10' | 'pct25' | 'pct50' | 'pct75' | 'pct90'> = {
      '50th': 'pct50', '75th': 'pct75', '90th': 'pct90',
    };
    const pctKey = pctKeyMap[display.label] ?? 'pct50';
    let tip = '';
    if (source === 'bls' && sourceData) { tip = blsTooltip(pctKey, display.value, sourceData as BlsWageData, rpp); }
    else if (source === 'dol') { tip = dolTooltip(pctKey, display.value, rpp); }
    else if (source === 'salarycom' && sourceData) { tip = salaryComTooltip(pctKey, display.value, sourceData as SalaryComWageData, rpp); }

    return (
      <div>
        <Tooltip label={tip} multiline>
          <Group spacing={4} align='center'>
            <Text size='sm' style={{ cursor: 'help' }}>${display.value.toFixed(2)}</Text>
            <IconInfoCircle size={12} style={{ color: 'var(--mantine-color-gray-5)' }} />
          </Group>
        </Tooltip>
        <Text size='xs' c='dimmed' mt={4}>{display.label} {PERCENTILE_SUFFIX}</Text>
      </div>
    );
  }

  return null;
}

function getWageValue(display: WageDisplay): number | null {
  return display.type === WageDisplayType.JUNIOR ? (display.pct25 ?? display.pct10) : display.value;
}

type RateComparison = 'above' | 'below' | 'mixed' | null;

function getRateComparison(rate: number, bls: WageDisplay | null, dol: WageDisplay | null): RateComparison {
  const results: ('above' | 'below')[] = [];
  const blsVal = bls ? getWageValue(bls) : null;
  const dolVal = dol ? getWageValue(dol) : null;
  if (blsVal !== null) { results.push(rate > blsVal ? 'above' : 'below'); }
  if (dolVal !== null) { results.push(rate > dolVal ? 'above' : 'below'); }
  if (!results.length) { return null; }
  if (results.every((r) => r === 'above')) { return 'above'; }
  if (results.every((r) => r === 'below')) { return 'below'; }
  return 'mixed';
}

function RateIndicator({ comparison }: { comparison: RateComparison }) {
  if (!comparison) { return <span style={{ display: 'inline-block', width: 12, flexShrink: 0 }} />; }
  if (comparison === 'above') {
    return (
      <Tooltip label='Company rate is above both government benchmarks' withArrow>
        <IconArrowUp size={12} style={{ color: '#fa5252', flexShrink: 0 }} />
      </Tooltip>
    );
  }
  if (comparison === 'below') {
    return (
      <Tooltip label='Company rate is below both government benchmarks' withArrow>
        <IconArrowDown size={12} style={{ color: '#339af0', flexShrink: 0 }} />
      </Tooltip>
    );
  }
  return (
    <Tooltip label='Company rate falls between BLS and DOL benchmarks' withArrow>
      <Group spacing={1} style={{ flexShrink: 0 }}>
        <IconArrowUp size={12} style={{ color: '#fa5252' }} />
        <IconArrowDown size={12} style={{ color: '#339af0' }} />
      </Group>
    </Tooltip>
  );
}

type RateCardCategoryRowProps = Readonly<{
  group: CategoryGroup;
  selectedLevel: PercentileKey;
  salaryComData: SalaryComWageData | null;
  salaryComError: string | null;
  salaryComLoading: boolean;
  salaryComEnabled: boolean;
  wrapRate: number;
  localityMultiplier: number;
  onLevelChange: (baseName: string, level: PercentileKey) => void;
}>;

export default function RateCardCategoryRow({
  group,
  selectedLevel,
  salaryComData,
  salaryComError,
  salaryComLoading,
  salaryComEnabled,
  wrapRate,
  localityMultiplier,
  onLevelChange,
}: RateCardCategoryRowProps) {
  const variant = group.variants.find((v) => getPercentileForExperienceLevel(v.experienceLevel) === selectedLevel) ?? null;
  const percentile = selectedLevel;

  const blsSalaryData = variant?.blsSalaryData ?? group.variants[0]?.blsSalaryData ?? null;
  const dolSalaryData = variant?.dolSalaryData ?? group.variants[0]?.dolSalaryData ?? null;

  const blsDisplay = blsSalaryData ? getBlsWageDisplay(blsSalaryData, percentile, localityMultiplier) : null;
  const dolDisplay = dolSalaryData ? getDolWageDisplay(dolSalaryData, percentile, localityMultiplier) : null;
  const salaryComDisplay = salaryComData ? getSalaryComWageDisplay(salaryComData, percentile, localityMultiplier) : null;

  const adjustedRate = variant?.billRate != null ? calculateAdjustedRate(variant.billRate, wrapRate, localityMultiplier) : null;
  const rateComparison = adjustedRate !== null ? getRateComparison(adjustedRate, blsDisplay, dolDisplay) : null;

  const blsRendered = blsDisplay ? renderWageDisplay(blsDisplay, 'bls', localityMultiplier, blsSalaryData ?? undefined) : null;
  const dolRendered = dolDisplay ? renderWageDisplay(dolDisplay, 'dol', localityMultiplier, dolSalaryData ?? undefined) : null;
  const salaryComRendered = salaryComDisplay ? renderWageDisplay(salaryComDisplay, 'salarycom', localityMultiplier, salaryComData ?? undefined) : null;

  const renderSalaryComCell = () => {
    if (!salaryComEnabled) { return <Text size='sm' c='dimmed' ta='center'>-</Text>; }
    if (salaryComLoading) { return <Loader size='xs' />; }
    if (salaryComError) {
      return (
        <Tooltip label='Salary.com API not available'>
          <Text size='sm' c='dimmed' ta='center'>-</Text>
        </Tooltip>
      );
    }
    if (salaryComRendered !== null) { return <div>{salaryComRendered}</div>; }
    return <Text size='sm' c='dimmed' ta='center'>-</Text>;
  };

  return (
    <tr>
      <td>{group.baseName}</td>
      <td>
        <Select
          value={selectedLevel}
          onChange={(val) => val && onLevelChange(group.baseName, val as PercentileKey)}
          data={LEVEL_OPTIONS}
          withinPortal
          dropdownPosition='bottom'
          style={{ minWidth: 160 }}
        />
      </td>
      <td style={{ textAlign: 'center' }}>
        {adjustedRate !== null ? (
          <Group spacing={4} align='center' position='center'>
            <RateIndicator comparison={rateComparison} />
            <Tooltip label={formatFeeTooltip(variant!.billRate!, wrapRate, localityMultiplier)} multiline>
              <Group spacing={4} align='center'>
                <Text size='sm' style={{ cursor: 'help' }}>${adjustedRate.toFixed(2)}</Text>
                <IconInfoCircle size={12} style={{ color: 'var(--mantine-color-gray-5)' }} />
              </Group>
            </Tooltip>
          </Group>
        ) : (
          <Group spacing={4} align='center' position='center'>
            <RateIndicator comparison={null} />
            <Tooltip label='No rate available for this level in the uploaded data' withArrow>
              <Group spacing={4} align='center'>
                <Text size='sm' c='dimmed' style={{ cursor: 'help' }}>$0.00</Text>
                <IconInfoCircle size={12} style={{ color: 'var(--mantine-color-gray-5)' }} />
              </Group>
            </Tooltip>
          </Group>
        )}
      </td>
      <td>{(variant ?? group.variants[0])?.mappedSocCode || '-'}</td>
      <td><Text size='sm'>{(variant ?? group.variants[0])?.mappedSocTitle || '-'}</Text></td>
      <td>{blsRendered ?? <Text size='sm' c='dimmed'>-</Text>}</td>
      <td>{dolRendered ?? <Text size='sm' c='dimmed'>-</Text>}</td>
    </tr>
  );
}
