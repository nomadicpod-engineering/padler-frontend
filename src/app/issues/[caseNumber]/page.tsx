import { redirect } from 'next/navigation';

type Props = { params: Promise<{ caseNumber: string }> };

export default async function IssueDetailRedirectPage({ params }: Props) {
  const { caseNumber } = await params;
  redirect(`/cases/${encodeURIComponent(caseNumber)}`);
}
