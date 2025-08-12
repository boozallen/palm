import { Dispatch, SetStateAction, useMemo, forwardRef, useState } from 'react';
import { Group, MultiSelect, MultiSelectValueProps, Select, TextInput, Title, ThemeIcon, Button, Popover, Textarea } from '@mantine/core';
import { IconAdjustmentsHorizontal, IconCheck, IconDownload } from '@tabler/icons-react';
import { useForm, zodResolver } from '@mantine/form';

import useGetAvailableModels from '@/features/shared/api/get-available-models';
import { policyComplianceSchema, PolicyCompliance, Policy } from '@/features/ai-agents/types/certa/webPolicyCompliance';
import useGetAvailablePolicies from '@/features/ai-agents/api/certa/get-available-policies';
import { SelectOption } from '@/features/shared/types';
import { useDebouncedValue } from '@mantine/hooks';

type SelectItemProps = {
  label: string;
  selected: boolean;
};

type DisplayValueProps = MultiSelectValueProps & {
  selectedPolicies: string[];
};

const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  function SelectItemWithRef(props, ref) {
    return (
      <Group spacing='sm' {...props} ref={ref}>
        {props.selected && (
          <ThemeIcon size='sm'>
            <IconCheck />
          </ThemeIcon>
        )}
        {props.label}
      </Group>
    );
  }
);

SelectItem.displayName = 'PolicySelectItem';

type FormProps = Readonly<{
  agentId: string;
  isLoading: boolean;
  onSubmit: (values: PolicyCompliance) => void;
  handleDownload: () => void;
  selectedPolicies: Policy[];
  setSelectedPolicies: Dispatch<SetStateAction<Policy[]>>;
}>;

export default function Form({
  agentId,
  isLoading,
  onSubmit,
  handleDownload,
  selectedPolicies,
  setSelectedPolicies,
}: FormProps) {
  const { data: modelData } = useGetAvailableModels();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebouncedValue(searchQuery, 500);

  const { data: policiesData } = useGetAvailablePolicies(agentId, debouncedSearchQuery);

  const policies = useMemo(() => {
    if (!policiesData) {
      return [];
    }
    const backendIds = policiesData.policies.map((policy) => policy.id);

    return [
      ...policiesData.policies,
      ...selectedPolicies.filter((policy) => !backendIds.includes(policy.id)),
    ];
  }, [policiesData, selectedPolicies]);

  const policyOptions: SelectOption[] = policies.map((policy) => ({
    label: policy.title,
    value: policy.id,
  }));

  function DisplayValue({
    selectedPolicies,
    onRemove: _Remove,
    ...others
  }: DisplayValueProps) {
    return (
      <Title
        {...others}
        order={2}
        sx={(theme) => ({
          cursor: 'default',
          color: theme.colors.gray[6],
          backgroundColor: theme.colors.dark[7],
          border: theme.colors.dark[7],
          borderRadius: theme.radius.sm,
          margin: 'inherit',
          padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
          // Only show the last (most recent) element
          display: 'none',
          ':last-of-type': {
            display: 'block',
          },
        })}
      >
        {selectedPolicies.length} Polic{selectedPolicies.length === 1 ? 'y' : 'ies'} Selected
      </Title>
    );
  }

  const policyCompliance = useForm<PolicyCompliance>({
    initialValues: {
      url: '',
      policy: [],
      model: '',
      instructions: '',
    },
    validate: zodResolver(policyComplianceSchema),
  });

  const [hasSubmitted, setHasSubmitted] = useState(false);

  const modelOptions = useMemo(() => {
    if (!modelData) {
      return [];
    }

    return modelData.availableModels.map((model) => ({
      value: model.id,
      label: model.name,
      group: model.providerLabel,
    }));
  }, [modelData]);

  const handleSelectPolicyChange = (values: string[]) => {
    const selectedPolicies = policies.filter(policy => values.includes(policy.id));
    const validValues = selectedPolicies.map(policy => policy.id);

    setSelectedPolicies(selectedPolicies);
    policyCompliance.setFieldValue('policy', validValues);
  };

  return (
    <form
      onSubmit={policyCompliance.onSubmit(() => {
        onSubmit(policyCompliance.values);
        setHasSubmitted(true);
      })}
      data-testid='certa-form'
    >
      <Group align='start' noWrap>
        <MultiSelect
          label='Policy'
          placeholder='Select policy'
          searchable
          data={policyOptions}
          nothingFound='No policies found'
          mb={0}
          {...policyCompliance.getInputProps('policy')}
          onChange={handleSelectPolicyChange}
          valueComponent={(props) => (
            <DisplayValue
              {...props}
              selectedPolicies={policyCompliance.values.policy}
            />
          )}
          itemComponent={SelectItem}
          disableSelectedItemFiltering
          limit={10}
          onSearchChange={setSearchQuery}
          searchValue={searchQuery}
        />
        <TextInput
          label='Subject Webpage'
          placeholder='Enter URL here'
          mb={0}
          {...policyCompliance.getInputProps('url')}
        />
        <Select
          label='Model'
          placeholder='Select large language model'
          data={modelOptions}
          mb={0}
          {...policyCompliance.getInputProps('model')}
        />
        <Group mt='lg' noWrap>
          <Popover width={600}>
            <Popover.Target>
              <Button
                mt='xs'
                variant='default'
                radius='lg'
                data-testid='additional-instructions-button'
              >
                <IconAdjustmentsHorizontal stroke={1.25} />
              </Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Textarea
                label='Additional Instructions'
                placeholder='Enter any additional instructions for the LLM here'
                minRows={3}
                maxRows={5}
                {...policyCompliance.getInputProps('instructions')}
              />
            </Popover.Dropdown>
          </Popover>
          {/* <Group grow> */}
          <Button
            type='submit'
            loading={isLoading}
          >
            Assess Compliance
          </Button>
          <Button
            leftIcon={<IconDownload />}
            c='gray.6'
            variant='default'
            onClick={handleDownload}
            disabled={!hasSubmitted || isLoading}
          >
            Download
          </Button>
        </Group>
      </Group>
    </form>
  );
}
