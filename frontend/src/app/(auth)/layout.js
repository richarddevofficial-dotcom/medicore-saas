import AuthProvider from '@/providers/AuthProvider';

export const metadata = {
  title: 'Authentication - HMS SaaS',
  description: 'Sign in or register your hospital',
};

export default function AuthLayout({ children }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
