import { render, screen } from '@testing-library/react';
import AddAdminModal from './AddAdminModal';

jest.mock('@/features/settings/components/admins/forms/AddAdminForm', () => {
  return function AddAdminForm() {
    return <form>AddAdminForm</form>;
  };
});

describe('AddAdminModal', () => {

  it('renders modal and form if modalOpened is true', () => {
    render(<AddAdminModal modalOpened={true} closeModalHandler={jest.fn()} />);

    expect(screen.getByText('Add Admin')).toBeInTheDocument();
    expect(screen.getByText('AddAdminForm')).toBeInTheDocument();
  });

  it('does not render modal and form if modalOpened is false', () => {
    render(<AddAdminModal modalOpened={false} closeModalHandler={jest.fn()} />);

    expect(screen.queryByText('Add Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('AddAdminForm')).not.toBeInTheDocument();
  });

});
