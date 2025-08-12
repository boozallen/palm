import { render, screen } from '@testing-library/react';

import CloudRequirementsBanner from './CloudRequirementsBanner';

describe('CloudRequirementsBanner', () => {
  it('should render the banner for S3 service', () => {
    render(<CloudRequirementsBanner service='s3' />);
    
    expect(screen.getByTestId('cloud-requirements-banner')).toBeInTheDocument();
    expect(screen.getByTestId('cloud-requirements-content-s3')).toBeInTheDocument();
  });

  it('should render the banner for Bedrock service', () => {
    render(<CloudRequirementsBanner service='bedrock' />);

    expect(screen.getByTestId('cloud-requirements-banner')).toBeInTheDocument();
    expect(screen.getByTestId('cloud-requirements-content-bedrock')).toBeInTheDocument();
  });
});
