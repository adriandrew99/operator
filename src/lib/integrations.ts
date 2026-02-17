/**
 * Integration scaffolds for Nexus.
 * 
 * Each integration follows this pattern:
 * 1. OAuth flow or API key entry (stored in profiles table or separate integrations table)
 * 2. Webhook receiver or polling function
 * 3. Data mapper to convert external items into Nexus tasks
 * 
 * None of these integrations are live yet — they are scaffolded
 * so you can plug in credentials and go.
 */

export type IntegrationId = 'slack' | 'clickup' | 'gmail' | 'plaid' | 'whoop';

export interface Integration {
  id: IntegrationId;
  name: string;
  description: string;
  icon: string;
  status: 'available' | 'coming_soon';
  setupUrl?: string;
}

export const INTEGRATIONS: Integration[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Import action items from Slack messages. Star or react to messages to create tasks.',
    icon: '💬',
    status: 'available',
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    description: 'Sync tasks from ClickUp spaces. Two-way sync keeps everything in one place.',
    icon: '✅',
    status: 'available',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Turn starred emails into tasks. Auto-import action items from your inbox.',
    icon: '📧',
    status: 'coming_soon',
  },
  {
    id: 'plaid',
    name: 'Plaid (Banking)',
    description: 'Connect bank accounts to auto-import transactions and track revenue in real-time.',
    icon: '🏦',
    status: 'coming_soon',
  },
  {
    id: 'whoop',
    name: 'Whoop',
    description: 'Import sleep and recovery data to power the "Low Sleep Detected" energy suggestion.',
    icon: '⌚',
    status: 'coming_soon',
  },
];

/**
 * Slack Integration Scaffold
 * 
 * Setup:
 * 1. Create a Slack App at api.slack.com/apps
 * 2. Add OAuth scopes: channels:history, reactions:read, stars:read
 * 3. Set redirect URL to /api/integrations/slack/callback
 * 4. Store the bot token in the integrations table
 * 
 * Polling approach (simpler than webhooks for personal use):
 * - Cron job checks starred messages every 15 min
 * - Maps starred messages to tasks with category 'admin'
 */
export function getSlackOAuthUrl(clientId: string, redirectUri: string): string {
  const scopes = ['channels:history', 'reactions:read', 'stars:read', 'users:read'].join(',');
  return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

export interface SlackMessage {
  ts: string;
  text: string;
  user: string;
  channel: string;
}

export function slackMessageToTask(message: SlackMessage) {
  return {
    title: message.text.slice(0, 100),
    description: `Imported from Slack: ${message.text}`,
    category: 'admin' as const,
    energy: 'admin' as const,
    weight: 'low' as const,
  };
}

/**
 * ClickUp Integration Scaffold
 * 
 * Setup:
 * 1. Get API token from ClickUp Settings > Apps
 * 2. Store token in integrations table
 * 3. Select space/folder to sync
 * 
 * Sync approach:
 * - Poll ClickUp tasks API every 15 min
 * - Map ClickUp task status to Nexus task status
 * - Two-way: completing in Nexus updates ClickUp
 */
export function getClickUpHeaders(apiToken: string) {
  return {
    Authorization: apiToken,
    'Content-Type': 'application/json',
  };
}

export interface ClickUpTask {
  id: string;
  name: string;
  description: string;
  status: { status: string };
  priority: { id: string } | null;
  due_date: string | null;
  time_estimate: number | null;
}

export function clickUpTaskToOperatorTask(task: ClickUpTask) {
  const priorityToWeight = (p: string | undefined) => {
    if (p === '1') return 'high' as const;
    if (p === '2') return 'medium' as const;
    return 'low' as const;
  };

  return {
    title: task.name,
    description: task.description || undefined,
    category: 'strategy' as const,
    energy: 'creative' as const,
    weight: priorityToWeight(task.priority?.id),
    deadline: task.due_date ? new Date(Number(task.due_date)).toISOString().split('T')[0] : undefined,
    estimated_minutes: task.time_estimate ? Math.round(task.time_estimate / 60000) : undefined,
  };
}

/**
 * Plaid Integration Scaffold (Banking)
 * 
 * Setup:
 * 1. Sign up at plaid.com, get client_id and secret
 * 2. Use Plaid Link to connect bank account
 * 3. Store access_token in integrations table (encrypted)
 * 
 * Data flow:
 * - Nightly sync pulls transactions
 * - Revenue transactions auto-update financial snapshot
 * - Expenses auto-categorize into expense tracker
 * 
 * Note: For UK banks, TrueLayer is an alternative to Plaid
 */
export interface PlaidTransaction {
  transaction_id: string;
  amount: number;
  name: string;
  date: string;
  category: string[];
  merchant_name: string | null;
}

export function plaidTransactionToExpense(tx: PlaidTransaction) {
  const categoryMap: Record<string, string> = {
    'Software': 'software',
    'Travel': 'travel',
    'Food and Drink': 'other',
    'Transfer': 'other',
    'Payment': 'other',
  };

  return {
    description: tx.merchant_name || tx.name,
    amount: Math.abs(tx.amount),
    category: categoryMap[tx.category?.[0]] || 'other',
    date: tx.date,
    is_recurring: false,
  };
}
