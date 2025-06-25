import { render, screen } from '@testing-library/react';
import FirstLoginModal from './FirstLoginModal';

jest.mock('@/features/shared/components/Loading', () => {
  return function MockLoading() {
    return <div>Loading...</div>;
  };
});
jest.mock('@/features/profile/components/forms/JoinUserGroupForm', () => {
  return jest.fn(() => <div>Join User Group Form</div>);
});

describe('FirstLoginModal', () => {
  const closeModalHandler = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });
;
  it('should render the modal with content', () => {
    render(<FirstLoginModal modalOpened={true} closeModalHandler={closeModalHandler} />);

    expect(screen.getByTestId('first-login-modal')).toBeInTheDocument();
    expect(screen.getByText('Welcome to Prompt & Agent Library Marketplace (PALM)')).toBeInTheDocument();

    expect(screen.getByText('Join User Group Form')).toBeInTheDocument();
  });
});
