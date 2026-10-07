import { useState } from 'react';
import {
  Stack,
  Title,
  Text,
  Select,
  Group,
  ThemeIcon,
  Button,
  Accordion,
  NumberInput,
  Grid,
} from '@mantine/core';
import { IconChartLine, IconFileSpreadsheet, IconBuildingBank, IconPercentage } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import UploadRateCardForm from '@/features/ai-agents/components/rcast/UploadRateCardForm';
import RateCardTable from './RateCardTable';
import { useGetRateCards } from '@/features/ai-agents/api/rcast/get-rate-cards';
import useExportRateCard from '@/features/ai-agents/api/rcast/export-rate-card';
import { downloadExportedFile } from '@/features/ai-agents/utils/rcast/downloadFile';
import { REGION_MAPPINGS } from '@/features/ai-agents/data/rcast/regionMappings';

type AgentProps = Readonly<{
  id: string;
}>;

export default function Agent({ id }: AgentProps) {
  const [selectedRateCardId, setSelectedRateCardId] = useState<string | null>(null);
  const [selectedGeographic, setSelectedGeographic] = useState<string>('US Baseline');
  const [wrapRate, setWrapRate] = useState(2.04);
  const { data: rateCards } = useGetRateCards(id);
  const exportMutation = useExportRateCard();

  const handleExport = async () => {
    if (!selectedRateCardId) {
      return;
    }

    try {
      const result = await exportMutation.mutateAsync({
        aiAgentId: id,
        rateCardId: selectedRateCardId,
      });
      downloadExportedFile(result.data, result.filename, result.mimeType);
    } catch (error) {
      notifications.show({
        title: 'Export Failed',
        message: error instanceof Error ? error.message : 'Failed to export rate card',
        color: 'red',
      });
    }
  };

  return (
    <Stack spacing='xl'>
      <div>
        <Title order={1} mb='sm'>Rate Card Analysis</Title>
        <Text size='lg' color='dimmed'>
          Manage rate cards with automated SOC code mapping and BLS/DOL wage data analysis.
        </Text>
      </div>

      <Accordion variant='contained'>
        <Accordion.Item value='upload'>
          <Accordion.Control icon={<IconFileSpreadsheet size={16} />}>
            Upload Rate Card
          </Accordion.Control>
          <Accordion.Panel>
            <UploadRateCardForm aiAgentId={id} />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {rateCards && rateCards.length > 0 && (
        <Stack bg='dark.6' p='lg' spacing='md'>
          <Group align='center' spacing='xs' mb='md'>
            <ThemeIcon size='sm'>
              <IconChartLine style={{ pointerEvents: 'none' }} />
            </ThemeIcon>
            <Title order={2}>Analyze Rate Card</Title>
          </Group>

          <Grid>
            <Grid.Col span={4}>
              <Select
                label='Rate Card'
                placeholder='Select a rate card'
                data={
                  rateCards?.map((rc) => ({
                    value: rc.id,
                    label: `${rc.filename} • (Uploaded ${new Date(rc.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })})`,
                  })) || []
                }
                value={selectedRateCardId}
                onChange={setSelectedRateCardId}
                size='sm'
                clearable
              />
            </Grid.Col>

            <Grid.Col span={4}>
              <Select
                label='Geographic Region'
                value={selectedGeographic}
                onChange={(value) => setSelectedGeographic(value || 'US Baseline')}
                data={Object.keys(REGION_MAPPINGS)}
                icon={<IconBuildingBank />}
                searchable
                maxDropdownHeight={300}
                withinPortal
                size='sm'
              />
            </Grid.Col>

            <Grid.Col span={2}>
              <NumberInput
                label='Wrap Rate'
                value={wrapRate}
                onChange={(value) => { if (typeof value === 'number' && value > 0) { setWrapRate(value); } }}
                placeholder='e.g., 2.05'
                step={0.01}
                precision={2}
                min={0}
                max={100}
                icon={<IconPercentage />}
                size='sm'
              />
            </Grid.Col>

            <Grid.Col span={2}>
              <Button
                mt='lg'
                leftIcon={<IconFileSpreadsheet />}
                variant='outline'
                onClick={handleExport}
                loading={exportMutation.isPending}
                disabled={!selectedRateCardId}
                size='sm'
              >
                Export
              </Button>
            </Grid.Col>
          </Grid>

          <RateCardTable
            aiAgentId={id}
            selectedRateCardId={selectedRateCardId}
            onRateCardSelect={setSelectedRateCardId}
            geographicRegion={selectedGeographic}
            wrapRate={wrapRate}
          />
        </Stack>
      )}
    </Stack>
  );
}
