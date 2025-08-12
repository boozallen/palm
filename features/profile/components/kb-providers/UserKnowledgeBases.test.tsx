import { render, screen } from '@testing-library/react';

import UserKnowledgeBases from './UserKnowledgeBases';

jest.mock('./tables/UserKbProvidersTable', () => {
  return function MockUserKbProvidersTable() {
    return <div>User KB Providers Table</div>;
  };
});

jest.mock('./tables/AdvancedKbSettingsTable', () => {
  return function MockAdvancedKbSettingsTable() {
    return <div>Advanced KB Settings Table</div>;
  };
});

jest.mock('@/features/shared/components/Loading', () => {
  return function MockLoading() {
    return <div>Loading...</div>;
  };
});

describe('UserKnowledgeBases', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    render(<UserKnowledgeBases />);

    const title = screen.getByText('My Knowledge Bases');
    expect(title).toBeInTheDocument();
  });

  it('renders AdvancedKbSettingsTable', () => {
    render(<UserKnowledgeBases />);

    expect(screen.getByText('Advanced KB Settings Table')).toBeInTheDocument();
  });
});
