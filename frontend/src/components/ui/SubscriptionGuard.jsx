'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { AlertTriangle } from 'lucide-react';

const planLimits = {
  trial: { maxStaff: 5, maxPatients: 500 },
  basic: { maxStaff: 10, maxPatients: 1000 },
  pro: { maxStaff: 25, maxPatients: 5000 },
  enterprise: { maxStaff: 100, maxPatients: 999999 },
};

export function useSubscription() {
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    apiClient.get('/hospitals/my_hospital/')
      .then(res => setSubscription(res.data))
      .catch(() => {});
  }, []);

  return subscription;
}

export function checkLimit(subscription, type, currentCount) {
  if (!subscription) return { allowed: true };
  
  const plan = subscription.subscription_plan || 'trial';
  const limits = planLimits[plan];
  
  if (type === 'staff' && currentCount >= limits.maxStaff) {
    return { allowed: false, message: `Staff limit reached (${limits.maxStaff}). Upgrade your plan.` };
  }
  if (type === 'patients' && currentCount >= limits.maxPatients) {
    return { allowed: false, message: `Patient limit reached (${limits.maxPatients}). Upgrade your plan.` };
  }
  
  return { allowed: true };
}

export default function SubscriptionGuard({ children }) {
  const subscription = useSubscription();
  
  if (!subscription) return null;
  
  if (subscription.days_left <= 0 && subscription.subscription_plan === 'trial') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Trial Expired</h2>
          <p className="text-gray-500 mb-4">Your 14-day free trial has ended. Upgrade to continue using MediCore.</p>
          <Button>Upgrade Now</Button>
        </Card>
      </div>
    );
  }
  
  return children;
}
