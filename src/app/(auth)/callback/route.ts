import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** Allow only relative paths to prevent open redirect. */
function safeRedirectPath(next: string): string {
  const path = next.startsWith('/') ? next : `/${next}`;
  if (path.startsWith('//') || path.includes('\\')) return '/today';
  try {
    const parsed = new URL(path, 'http://localhost');
    if (parsed.origin !== 'http://localhost') return '/today';
    return parsed.pathname || '/today';
  } catch {
    return '/today';
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/today';
  const destination = safeRedirectPath(next);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
