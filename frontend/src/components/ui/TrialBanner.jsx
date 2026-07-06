'use client';

import { useState, useEffect } from 'react';
import { useHospitalSettings } from '@/hooks/useSettings';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import apiClient from '@/lib/api-client';

export default function TrialBanner() {
  const [trialInfo, setTrialInfo] = useState(null);

  useEffect(() => {
    apiClient.get('/hospitals/my_hospital/')
      .then(res => setTrialInfo(res.data))
      .catch(() => {});
  }, []);

  if (!trialInfo || trialInfo.subscription_plan !== 'trial') return null;

  const daysLeft = trialInfo.days_left || 0;
  const isUrgent = daysLeft <= 3;

  return (
    <div className={`px-4 py-2 text-center text-sm font-medium ${
      isUrgent ? 'bg-red-50 text-red-700 border-b border-red-200' : 'bg-orange-50 text-orange-700 border-b border-orange-200'
    }`}>
      <div className="flex items-center justify-center gap-2">
        {isUrgent ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
        <span>
          {daysLeft > 0 
            ? `🕐 Trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. `
            : '⚠️ Trial expired. '}
        </span>
        <button className="underline font-bold hover:no-underline">
          Upgrade Now
        </button>
      </div>
    </div>
  );
}
