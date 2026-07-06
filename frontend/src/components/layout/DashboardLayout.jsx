'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import RoleGuard from '@/components/auth/RoleGuard';
import TrialBanner from '@/components/ui/TrialBanner';

export default function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <RoleGuard>
      <div className="min-h-screen bg-gray-50">
        <TrialBanner />
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div className={`transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
          <Header />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </RoleGuard>
  );
}
