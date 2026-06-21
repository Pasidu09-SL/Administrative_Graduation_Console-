import { redirect } from 'next/navigation';
import StudentEntryClient from './student-entry-client';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

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

  // Check if student has an active session to redirect to profile directly
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('student_session')?.value;
  if (sessionToken) {
    const payload = verifyToken(sessionToken);
    if (payload) {
      redirect('/student');
    }
  }

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
