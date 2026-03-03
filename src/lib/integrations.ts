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

export type IntegrationId = 'slack' | 'clickup' | 'gmail' | 'gocardless' | 'whoop';

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
    id: 'gocardless',
    name: 'GoCardless (Open Banking)',
    description: 'Connect Tide, Starling & other UK banks via Open Banking. Auto-import transactions and detect recurring payments.',
    icon: '🏦',
    status: 'available',
    setupUrl: '/finance?tab=banking',
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
 * GoCardless Open Banking Integration (Live)
 *
 * Implementation: src/lib/gocardless.ts + src/actions/banking.ts
 *
 * Setup:
 * 1. Sign up at https://bankaccountdata.gocardless.com
 * 2. Add GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY to env vars
 * 3. Users connect banks via Finance > Banking tab
 *
 * Data flow:
 * - User authenticates with bank via GoCardless consent page
 * - Cron job syncs transactions every 6 hours (/api/banking/sync)
 * - Auto-categorisation reuses CATEGORY_KEYWORDS from bank-import.ts
 * - Recurring payment detection groups similar transactions
 * - Bank access expires after 90 days, user re-consents via UI
 */
