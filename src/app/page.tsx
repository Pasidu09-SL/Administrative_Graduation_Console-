import { redirect } from 'next/navigation';
import StudentEntryClient from './student-entry-client';

interface PageProps {
  searchParams: Promise<{
    token?: string;
    email?: string;
    error?: string;
  }>;
}

export default async function EntryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = params.token;
  const email = params.email;
  const error = params.error;

  // Server-side redirect if not accessed via magic link
  if (!token && !error) {
    redirect('/admin');
  }

  return (
    <StudentEntryClient
      initialToken={token || ''}
      initialEmail={email || ''}
      initialError={error || ''}
    />
  );
}
