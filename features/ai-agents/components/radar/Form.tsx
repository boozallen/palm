import { useMemo, useState, forwardRef } from 'react';
import {
  Button,
  Group,
  Select,
  Textarea,
  MultiSelect,
  Title,
  ThemeIcon,
  Stack,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { IconCheck } from '@tabler/icons-react';

import useGetAvailableModels from '@/features/shared/api/get-available-models';
import {
  ResearchFormValues,
  researchFormSchema,
  RESEARCH_CATEGORIES,
} from '@/features/ai-agents/types/radar/researchAgent';

const LOCAL_STORAGE_KEY = 'researchForm';

type FormProps = Readonly<{
  isLoading: boolean;
  onSubmit: (values: ResearchFormValues) => void;
  handleDownload?: () => void;
}>;

export const transformDateRange = (dateRange: string) => {
  if (dateRange === 'last-30-days') {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    return {
      dateEnd: today.toISOString().split('T')[0],
      dateStart: thirtyDaysAgo.toISOString().split('T')[0],
    };
  } else {
    const [year, month] = dateRange.split('-').map(Number);

    // Set start date to first day of selected month
    const dateStart = `${year}-${month.toString().padStart(2, '0')}-01`;

    // Set end date to first day of the next month
    const lastDay = new Date(year, month, 1).getDate();
    const dateEnd = `${year}-${(month + 1)
      .toString()
      .padStart(2, '0')}-${lastDay}`;

    return { dateStart, dateEnd };
  }
};

export const transformCategories = (selectedCategories: string[]) => {
  if (selectedCategories.includes('all')) {
    // When 'all' is selected, include all category values except 'all' itself
    return RESEARCH_CATEGORIES.filter((cat) => cat.value !== 'all').map(
      (cat) => cat.value
    );
  }
  return selectedCategories;
};

export const transformInstitutions = (institutionsString: string) => {
  return institutionsString
    ? institutionsString
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
};

export const transformFormValues = (formValues: ResearchFormValues) => {
  const { dateStart, dateEnd } = transformDateRange(formValues.dateRange);
  const categories = transformCategories(formValues.categories);
  const institutions = transformInstitutions(formValues.institutions);

  return {
    dateStart,
    dateEnd,
    categories,
    institutions,
    model: formValues.model,
  };
};

const SelectItem = forwardRef<
  HTMLDivElement,
  { label: string; selected: boolean }
>(function SelectItemWithRef(props, ref) {
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
});

SelectItem.displayName = 'CategorySelectItem';

type DisplayValueProps = {
  selectedCategories: string[];
  onRemove?: any;
  [key: string]: any;
};

function CategoriesDisplayValue({
  selectedCategories,
  onRemove: _Remove,
  ...others
}: DisplayValueProps) {
  const isAllCategories =
    selectedCategories.includes('all') || selectedCategories.length === 0;

  const displayText = isAllCategories
    ? 'All Categories'
    : `${selectedCategories.length} ${
        selectedCategories.length === 1 ? 'Category' : 'Categories'
      } Selected`;

  return (
    <Title
      {...others}
      order={6}
      sx={(theme) => ({
        cursor: 'default',
        color: theme.colors.gray[6],
        backgroundColor: theme.colors.dark[7],
        border: theme.colors.dark[7],
        borderRadius: theme.radius.sm,
        margin: 'inherit',
        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
        display: 'none',
        ':last-of-type': {
          display: 'block',
        },
      })}
    >
      {displayText}
    </Title>
  );
}

export default function Form({ isLoading, onSubmit }: FormProps) {
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const { data: modelData } = useGetAvailableModels();

  const form = useForm<ResearchFormValues>({
    initialValues: (() => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      }
      return {
        model: '',
        dateRange: '',
        categories: ['all'],
        institutions: '',
      };
    })(),
    validate: zodResolver(researchFormSchema),
  });

  const dateRangeOptions = useMemo(() => {
    return [
      { value: 'last-30-days', label: 'Last 30 Days' },
      ...Array.from({ length: 24 }).map((_, index) => {
        const date = new Date();
        date.setMonth(date.getMonth() - index);
        const monthName = date.toLocaleString('default', { month: 'long' });
        const year = date.getFullYear();
        return {
          value: `${date.getFullYear()}-${date.getMonth() + 1}`,
          label: `${monthName} ${year}`,
        };
      }),
    ];
  }, []);

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

  const handleCategoryChange = (values: string[]) => {
    // If 'all' is clicked and wasn't already the only selection
    if (
      values.includes('all') &&
      !(
        form.values.categories.length === 1 &&
        form.values.categories[0] === 'all'
      )
    ) {
      form.setFieldValue('categories', ['all']);
      return;
    }

    // If a regular category is clicked while 'all' was selected
    if (values.length > 1 && values.includes('all')) {
      const filteredValues = values.filter((v) => v !== 'all');
      form.setFieldValue('categories', filteredValues);
      return;
    }

    // If no categories are selected, default to 'all'
    if (values.length === 0) {
      form.setFieldValue('categories', ['all']);
      return;
    }

    // Normal case - just set the values
    form.setFieldValue('categories', values);
  };

  const handleSubmit = (values: ResearchFormValues) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(values));

    onSubmit(values);
    setHasSubmitted(true);
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} data-testid='research-form'>
      <Stack spacing='sm'>
        <Group grow align='start' noWrap>
          <Select
            label='Model'
            placeholder='Select large language model'
            data={modelOptions}
            {...form.getInputProps('model')}
          />
          <Select
            label='Time Period'
            placeholder='Select time period'
            data={dateRangeOptions}
            {...form.getInputProps('dateRange')}
          />
          <MultiSelect
            label='Research Category'
            data={RESEARCH_CATEGORIES}
            placeholder='Select categories'
            value={form.values.categories}
            onChange={handleCategoryChange}
            itemComponent={SelectItem}
            valueComponent={(props) => (
              <CategoriesDisplayValue
                {...props}
                selectedCategories={form.values.categories}
              />
            )}
            searchable
            clearable={false}
            disableSelectedItemFiltering
          />
        </Group>

        <Textarea
          label='Institutions'
          description='Filter by institutions (comma-separated list)'
          placeholder='ex: Stanford, Beijing Institute of Technology, University of Washington'
          minRows={3}
          maxRows={5}
          autosize
          {...form.getInputProps('institutions')}
        />

        <Group position='left' mt='xs'>
          <Button type='submit' loading={isLoading}>
            Search & Analyze
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
