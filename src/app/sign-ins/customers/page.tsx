'use client';

import { LoginTrayView } from '@/components/crm/LoginTrayView';

export default function CustomerSignInsPage() {
  return (
    <LoginTrayView
      partyType="CUSTOMER"
      title="Customer sign-ins"
      subtitle="Customer sign-in outcomes by product — create a case when outreach is needed"
      showServiceColumn
    />
  );
}
