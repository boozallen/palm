import React from 'react';
import { render, screen } from '@testing-library/react';

import AddAwsProviderConfigForm from './AddAwsProviderConfigForm';

// Minimal mock for Mantine's useForm instance
function createMockForm(initialValues = {}) {
  let values = {
    config: {
      accessKeyId: '',
      secretAccessKey: '',
      sessionToken: '',
      region: '',
      s3Uri: '',
      ...initialValues,
    } as Record<string, string>,
  };
  return {
    values,
    getInputProps: (path: string) => {
      // Only support 'config.xxx' paths
      const key = path.replace(/^config\./, '');
      return {
        value: values.config[key] || '',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          values.config[key] = e.target.value;
        },
        name: path,
      };
    },
  };
}

describe('AddAwsProviderConfigForm', () => {
  it('renders all AWS credential fields with correct labels, placeholders, and descriptions', () => {
    const form = createMockForm();
    render(<AddAwsProviderConfigForm form={form as any} />);

    expect(screen.getByLabelText(/Access Key ID/i)).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText(/Access Key ID/i)).toHaveAttribute('placeholder', 'Enter access key ID');
    expect(screen.getByText('Leave blank to inherit AWS_ACCESS_KEY_ID environment variable')).toBeInTheDocument();

    expect(screen.getByLabelText(/Secret Access Key/i)).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText(/Secret Access Key/i)).toHaveAttribute('placeholder', 'Enter secret access key');
    expect(screen.getByText('Leave blank to inherit AWS_SECRET_ACCESS_KEY environment variable')).toBeInTheDocument();

    expect(screen.getByLabelText(/Session Token/i)).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText(/Session Token/i)).toHaveAttribute('placeholder', 'Enter session token');
    expect(screen.getByText('Leave blank to inherit AWS_SESSION_TOKEN environment variable')).toBeInTheDocument();

    expect(screen.getByLabelText(/Region/i)).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText(/Region/i)).toHaveAttribute('placeholder', 'Enter region');
    expect(screen.getByText('Leave blank to inherit AWS_REGION environment variable')).toBeInTheDocument();

    expect(screen.getByLabelText(/S3 URI/i)).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText(/S3 URI/i)).toHaveAttribute('placeholder', 'Enter S3 URI');
  });
});
