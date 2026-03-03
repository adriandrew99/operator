/**
 * GoCardless Bank Account Data API client (formerly Nordigen).
 * Free Open Banking AIS for reading UK bank accounts and transactions.
 *
 * API docs: https://developer.gocardless.com/bank-account-data/overview
 * Base URL: https://bankaccountdata.gocardless.com/api/v2/
 */

const BASE_URL = 'https://bankaccountdata.gocardless.com/api/v2';

// In-memory token cache (server-side only — resets on cold start)
let cachedToken: { access: string; refresh: string; expiresAt: number } | null = null;

export interface GCInstitution {
  id: string;
  name: string;
  bic: string;
  transaction_total_days: string;
  logo: string;
  countries: string[];
}

export interface GCRequisition {
  id: string;
  status: string;
  link: string;
  accounts: string[];
  institution_id: string;
  agreement: string;
  reference: string;
}

export interface GCTransaction {
  transactionId: string;
  bookingDate: string;
  bookingDateTime?: string;
  valueDate?: string;
  transactionAmount: { amount: string; currency: string };
  debtorName?: string;
  creditorName?: string;
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  additionalInformation?: string;
  proprietaryBankTransactionCode?: string;
}

export interface GCBalance {
  balanceType: string;
  balanceAmount: { amount: string; currency: string };
  referenceDate?: string;
}

export interface GCAccountDetails {
  resourceId: string;
  iban?: string;
  currency?: string;
  name?: string;
  product?: string;
  ownerName?: string;
}

// ━━━ Authentication ━━━

export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5-min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300_000) {
    return cachedToken.access;
  }

  // Try refresh if we have a refresh token
  if (cachedToken?.refresh) {
    try {
      const res = await fetch(`${BASE_URL}/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: cachedToken.refresh }),
      });
      if (res.ok) {
        const data = await res.json();
        cachedToken = {
          access: data.access,
          refresh: cachedToken.refresh,
          expiresAt: Date.now() + (data.access_expires * 1000),
        };
        return cachedToken.access;
      }
    } catch {
      // Refresh failed — fall through to full auth
    }
  }

  // Full token exchange
  const secretId = process.env.GOCARDLESS_SECRET_ID;
  const secretKey = process.env.GOCARDLESS_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error('GoCardless credentials not configured. Set GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY in environment variables.');
  }

  const res = await fetch(`${BASE_URL}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GoCardless auth failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  cachedToken = {
    access: data.access,
    refresh: data.refresh,
    expiresAt: Date.now() + (data.access_expires * 1000),
  };

  return cachedToken.access;
}

async function gcFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GoCardless API error ${res.status}: ${body}`);
  }

  return res.json();
}

// ━━━ Institutions ━━━

export async function getInstitutions(country: string = 'GB'): Promise<GCInstitution[]> {
  return gcFetch(`/institutions/?country=${country}`);
}

// ━━━ Requisitions (Bank Connections) ━━━

export async function createRequisition(
  institutionId: string,
  redirectUrl: string,
  reference?: string,
): Promise<GCRequisition> {
  // Create end user agreement first (90-day access)
  const agreement = await gcFetch('/agreements/enduser/', {
    method: 'POST',
    body: JSON.stringify({
      institution_id: institutionId,
      max_historical_days: 90,
      access_valid_for_days: 90,
      access_scope: ['balances', 'details', 'transactions'],
    }),
  });

  // Create requisition with the agreement
  return gcFetch('/requisitions/', {
    method: 'POST',
    body: JSON.stringify({
      redirect: redirectUrl,
      institution_id: institutionId,
      reference: reference || `opOS-${Date.now()}`,
      agreement: agreement.id,
      user_language: 'EN',
    }),
  });
}

export async function getRequisition(requisitionId: string): Promise<GCRequisition> {
  return gcFetch(`/requisitions/${requisitionId}/`);
}

export async function deleteRequisition(requisitionId: string): Promise<void> {
  await getAccessToken(); // ensure token
  const token = cachedToken!.access;
  await fetch(`${BASE_URL}/requisitions/${requisitionId}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ━━━ Account Data ━━━

export async function getAccountDetails(accountId: string): Promise<GCAccountDetails> {
  const data = await gcFetch(`/accounts/${accountId}/details/`);
  return data.account;
}

export async function getBalances(accountId: string): Promise<GCBalance[]> {
  const data = await gcFetch(`/accounts/${accountId}/balances/`);
  return data.balances;
}

export async function getTransactions(
  accountId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<{ booked: GCTransaction[]; pending: GCTransaction[] }> {
  const params = new URLSearchParams();
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  const qs = params.toString() ? `?${params.toString()}` : '';

  const data = await gcFetch(`/accounts/${accountId}/transactions/${qs}`);
  return data.transactions;
}
