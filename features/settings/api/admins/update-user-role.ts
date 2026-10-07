import { UserRole } from '@/features/shared/types/user';
import { trpc } from '@/libs';

export default function useUpdateUserRole() {
  const utils = trpc.useContext();

  return trpc.settings.updateUserRole.useMutation({
    onSuccess: (data) => {
      utils.settings.getSystemAdmins.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        if (data.role === UserRole.User) {
          const newData = {
            admins: oldData.admins.filter((admin) => admin.id !== data.id),
          };

          return newData;
        } else if (data.role === UserRole.Admin) {
          const newData = {
            admins: [
              ...oldData.admins,
              {
                id: data.id,
                name: data.name,
                email: data.email,
              },
            ],
          };

          return newData;
        }

        return oldData;
      });
    },
  });
}
