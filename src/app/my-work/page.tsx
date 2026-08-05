import { redirect } from 'next/navigation';

export default function MyWorkRedirectPage() {
  redirect('/cases/mine');
}
