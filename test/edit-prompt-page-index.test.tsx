import { render } from '@testing-library/react';
import EditPrompt from '@/pages/library/[slug]/[promptId]/edit';
import { UserRole } from '@/features/shared/types/user';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';
import { useGetPrompt } from '@/features/library/api/get-prompt';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/shared/api/get-feature-flag');
jest.mock('@/features/library/api/get-prompt');

jest.mock('@/features/library/components/forms/EditPromptForm', () => {
  return function MockedEditPromptForm() {
    return <div>EditPromptForm</div>;
  };
});

describe('EditPromptPage', () => {
  let mockUser: {
    id: string;
    role: UserRole;
  };

  let mockPrompt: {
    prompt: {
      id: string;
      creatorId: string;
    }
  };

  const mockPush = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();

    mockUser = {
      id: 'e8cded24-6199-49fe-98cc-d0b793edfce5',
      role: UserRole.Admin,
    };

    mockPrompt = {
      prompt: {
        id: '1cee92db-8d19-4d2d-8fb3-652e41aa7223',
        creatorId: 'e8cded24-6199-49fe-98cc-d0b793edfce5',
      },
    };

    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: mockUser,
      },
    });

    (useRouter as jest.Mock).mockReturnValue({
      query: {
        promptId: '1cee92db-8d19-4d2d-8fb3-652e41aa7223',
      },
      push: mockPush,
    });

    (useGetFeatureFlag as jest.Mock).mockReturnValue({
      data: true,
      isPending: false,
    });

    (useGetPrompt as jest.Mock).mockReturnValue({
      data: mockPrompt,
      isPending: false,
      error: null,
    });

  });
  it('renders without crashing', () => {
    const { getByText } = render(<EditPrompt />);

    expect(getByText('Edit Your Prompt')).toBeInTheDocument();
    expect(getByText(/Fill out the form below/)).toBeInTheDocument();
    expect(getByText('EditPromptForm')).toBeInTheDocument();
  });

  it('allows admin to visit page', () => {
    mockUser.role = UserRole.Admin;

    render(<EditPrompt />);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('allows prompt creator to visit page', () => {
    mockUser.role = UserRole.User;
    mockPrompt.prompt.creatorId = 'e8cded24-6199-49fe-98cc-d0b793edfce5';

    render(<EditPrompt />);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects to library if user is not admin && is not prompt creator', () => {
    mockUser.role = UserRole.User;
    mockPrompt.prompt.creatorId = 'another-user-id';

    render(<EditPrompt />);

    expect(mockPush).toHaveBeenCalledWith('/library');
  });

  it('shows error message if prompt is not found', () => {
    (useGetPrompt as jest.Mock).mockReturnValue({
      data: null,
      isPending: false,
      error: 'error',
    });

    const { getByText } = render(<EditPrompt />);

    expect(getByText(/Error loading prompt/)).toBeInTheDocument();
  });

  it('shows loading text if prompt is pending', () => {
    (useGetPrompt as jest.Mock).mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    const { getByText } = render(<EditPrompt />);

    expect(getByText('Loading...')).toBeInTheDocument();
  });
});
