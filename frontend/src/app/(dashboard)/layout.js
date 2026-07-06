import AuthProvider from '@/providers/AuthProvider';

export const metadata = {
  title: 'Dashboard - HMS SaaS',
  description: 'Hospital Management Dashboard',
};

export default function DashboardLayout({ children }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
