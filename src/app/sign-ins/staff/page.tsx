'use client';

import { LoginTrayView } from '@/components/crm/LoginTrayView';

export default function StaffSignInsPage() {
  return (
    <LoginTrayView
      partyType="STAFF"
      title="Staff sign-ins"
      subtitle="Invite, verify, and sign-in outcomes for Padler staff — follow up on failures"
      showServiceColumn={false}
    />
  );
}
