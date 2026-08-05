import { redirect } from 'next/navigation';

/** Legacy stub — audit pipeline ops live under /ops/audit (C4). */
export default function AuditLogRedirectPage() {
  redirect('/ops/audit');
}
