import { NextResponse } from 'next/server';
import { handleBankCallback } from '@/actions/banking';

export const dynamic = 'force-dynamic';

/**
 * GET /api/banking/callback?ref=<requisition_id>
 *
 * GoCardless redirects here after the user completes bank authentication.
 * Activates the connection, fetches account IDs, and triggers initial sync.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const ref = searchParams.get('ref');

  if (!ref) {
    return NextResponse.redirect(`${origin}/finance?banking_error=missing_ref`);
  }

  try {
    await handleBankCallback(ref);
    return NextResponse.redirect(`${origin}/finance?tab=banking&connected=true`);
  } catch (error) {
    console.error('Bank callback error:', error);
    return NextResponse.redirect(`${origin}/finance?tab=banking&banking_error=callback_failed`);
  }
}
