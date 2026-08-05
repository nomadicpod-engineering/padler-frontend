import { redirect } from 'next/navigation';

type Props = { params: Promise<{ executionNumber: string }> };

export default async function CommandExecutionRedirectPage({ params }: Props) {
  const { executionNumber } = await params;
  redirect(`/actions/runs/${encodeURIComponent(executionNumber)}`);
}
