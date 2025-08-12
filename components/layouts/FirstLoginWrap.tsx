import { useRouter } from 'next/router';
import { useContext, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import { UserSessionContext } from '@/components/layouts/AuthWrap';

type FirstLoginWrapProps = {
  children: React.ReactNode;
};

export default function FirstLoginWrap({ children }: Readonly<FirstLoginWrapProps>) {
  const router = useRouter();

  const [cookies, setCookie] = useCookies(['first-login']);

  const session = useContext(UserSessionContext);
  const { lastLoginAt } = session.user;

  const isFirstLogin = lastLoginAt === null && !cookies['first-login'];

  useEffect(() => {
    if (isFirstLogin) {
      setCookie('first-login', 'true', { path: '/' });
      router.push('/profile?first_login=true');
    }
  }, [isFirstLogin, cookies['first-login'], setCookie, router]);

  return <>{children}</>;
}
