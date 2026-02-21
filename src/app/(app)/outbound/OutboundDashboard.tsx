'use client';

import { useState, useTransition, useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { createCampaign, updateCampaign, deleteCampaign, addEntry, updateEntry, deleteEntry } from '@/actions/outbound';
import type { OutboundCampaignWithEntries, OutboundCampaignStatus } from '@/lib/types/database';

interface OutboundDashboardProps {
  campaigns: OutboundCampaignWithEntries[];
}

const STATUS_STYLES: Record<OutboundCampaignStatus, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-surface-tertiary', text: 'text-text-primary', label: 'Active' },
  paused: { bg: 'bg-surface-tertiary', text: 'text-text-secondary', label: 'Paused' },
  completed: { bg: 'bg-surface-tertiary', text: 'text-text-secondary', label: 'Completed' },
};

export function OutboundDashboard({ campaigns: initialCampaigns }: OutboundDashboardProps) {
  const [view, setView] = useState<'overview' | 'detail' | 'compare'>('overview');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const campaigns = initialCampaigns;
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId) ?? null;

  // Aggregate totals across all campaigns
  const globalTotals = useMemo(() => {
    return campaigns.reduce(
      (acc, c) => ({
        sends: acc.sends + c.totals.sends,
        responses: acc.responses + c.totals.responses,
        calls_booked: acc.calls_booked + c.totals.calls_booked,
        closes: acc.closes + c.totals.closes,
      }),
      { sends: 0, responses: 0, calls_booked: 0, closes: 0 }
    );
  }, [campaigns]);

  const responseRate = globalTotals.sends > 0 ? ((globalTotals.responses / globalTotals.sends) * 100).toFixed(1) : '0';
  const closeRate = globalTotals.calls_booked > 0 ? ((globalTotals.closes / globalTotals.calls_booked) * 100).toFixed(1) : '0';

  function openCampaign(id: string) {
    setSelectedCampaignId(id);
    setView('detail');
  }

  // ━━━ OVERVIEW ━━━
  if (view === 'overview') {
    return (
      <div className="space-y-5">
        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <MetricPill label="Sends" value={globalTotals.sends} />
          <MetricPill label="Responses" value={globalTotals.responses} />
          <MetricPill label="Response %" value={`${responseRate}%`} accent={Number(responseRate) > 10} />
          <MetricPill label="Calls Booked" value={globalTotals.calls_booked} />
          <MetricPill label="Close %" value={`${closeRate}%`} accent={Number(closeRate) > 20} />
        </div>

        {/* View toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView('overview')}
              className="text-xs px-2.5 py-1 rounded-lg font-medium bg-surface-tertiary text-text-primary"
            >
              Campaigns
            </button>
            <button
              onClick={() => setView('compare')}
              className="text-xs px-2.5 py-1 rounded-lg font-medium text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-colors cursor-pointer"
            >
              Compare
            </button>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-text-primary text-background hover:bg-text-primary/90 transition-colors cursor-pointer font-medium"
          >
            + New Campaign
          </button>
        </div>

        {/* New campaign form */}
        {showNewForm && (
          <NewCampaignForm
            onClose={() => setShowNewForm(false)}
            isPending={isPending}
            startTransition={startTransition}
          />
        )}

        {/* Campaign cards */}
        {campaigns.length === 0 && !showNewForm ? (
          <div className="card-elevated rounded-2xl p-8 text-center">
            <p className="text-sm text-text-tertiary mb-3">No campaigns yet</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="text-xs px-4 py-2 rounded-lg bg-text-primary text-background hover:bg-text-primary/90 transition-colors cursor-pointer font-medium"
            >
              Create your first campaign
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {campaigns.map(campaign => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onOpen={() => openCampaign(campaign.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ━━━ COMPARE ━━━
  if (view === 'compare') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('overview')}
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
          >
            ← Back
          </button>
          <h2 className="text-section-heading text-text-primary">Compare Campaigns</h2>
        </div>

        <div className="card-elevated rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-text-tertiary font-medium">Campaign</th>
                  <th className="text-right px-3 py-3 text-text-tertiary font-medium">Sends</th>
                  <th className="text-right px-3 py-3 text-text-tertiary font-medium">Responses</th>
                  <th className="text-right px-3 py-3 text-text-tertiary font-medium">Response %</th>
                  <th className="text-right px-3 py-3 text-text-tertiary font-medium">Calls</th>
                  <th className="text-right px-3 py-3 text-text-tertiary font-medium">Close %</th>
                  <th className="text-right px-3 py-3 text-text-tertiary font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...campaigns]
                  .sort((a, b) => {
                    const rateA = a.totals.sends > 0 ? a.totals.responses / a.totals.sends : 0;
                    const rateB = b.totals.sends > 0 ? b.totals.responses / b.totals.sends : 0;
                    return rateB - rateA;
                  })
                  .map(c => {
                    const rr = c.totals.sends > 0 ? ((c.totals.responses / c.totals.sends) * 100).toFixed(1) : '0';
                    const cr = c.totals.calls_booked > 0 ? ((c.totals.closes / c.totals.calls_booked) * 100).toFixed(1) : '0';
                    const style = STATUS_STYLES[c.status];
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-border hover: cursor-pointer transition-colors"
                        onClick={() => openCampaign(c.id)}
                      >
                        <td className="px-4 py-3 font-medium text-text-primary">{c.name}</td>
                        <td className="text-right px-3 py-3 font-mono text-text-secondary">{c.totals.sends}</td>
                        <td className="text-right px-3 py-3 font-mono text-text-secondary">{c.totals.responses}</td>
                        <td className={cn('text-right px-3 py-3 font-mono font-medium', Number(rr) > 10 ? 'text-text-primary' : 'text-text-secondary')}>{rr}%</td>
                        <td className="text-right px-3 py-3 font-mono text-text-secondary">{c.totals.calls_booked}</td>
                        <td className={cn('text-right px-3 py-3 font-mono font-medium', Number(cr) > 20 ? 'text-text-primary' : 'text-text-secondary')}>{cr}%</td>
                        <td className="text-right px-3 py-3">
                          <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium', style.bg, style.text)}>{style.label}</span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ━━━ DETAIL ━━━
  if (view === 'detail' && selectedCampaign) {
    return (
      <CampaignDetail
        campaign={selectedCampaign}
        onBack={() => { setView('overview'); setSelectedCampaignId(null); }}
        isPending={isPending}
        startTransition={startTransition}
      />
    );
  }

  return null;
}

// ━━━ Metric Pill ━━━
function MetricPill({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="card-elevated rounded-2xl p-3 text-center">
      <p className="text-lg font-bold font-mono leading-none text-text-primary">
        {value}
      </p>
      <p className="text-xs text-text-tertiary mt-1">{label}</p>
    </div>
  );
}

// ━━━ Campaign Card ━━━
function CampaignCard({ campaign, onOpen }: { campaign: OutboundCampaignWithEntries; onOpen: () => void }) {
  const style = STATUS_STYLES[campaign.status];
  const rr = campaign.totals.sends > 0 ? ((campaign.totals.responses / campaign.totals.sends) * 100).toFixed(1) : '0';

  return (
    <button
      onClick={onOpen}
      className="card-elevated rounded-2xl p-6 text-left hover:bg-surface-tertiary transition-colors cursor-pointer w-full"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-section-heading text-text-primary truncate">{campaign.name}</h3>
          {campaign.target_audience && (
            <p className="text-xs text-text-tertiary mt-0.5 truncate">{campaign.target_audience}</p>
          )}
        </div>
        <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0', style.bg, style.text)}>
          {style.label}
        </span>
      </div>

      {/* Mini funnel */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-sm font-bold font-mono text-text-primary">{campaign.totals.sends}</p>
          <p className="text-xs text-text-tertiary">Sends</p>
        </div>
        <div>
          <p className="text-sm font-bold font-mono text-text-primary">{campaign.totals.responses}</p>
          <p className="text-xs text-text-tertiary">Replies</p>
        </div>
        <div>
          <p className="text-sm font-bold font-mono text-text-primary">{campaign.totals.calls_booked}</p>
          <p className="text-xs text-text-tertiary">Calls</p>
        </div>
        <div>
          <p className="text-sm font-bold font-mono text-text-primary">{campaign.totals.closes}</p>
          <p className="text-xs text-text-tertiary">Closes</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-text-tertiary">
        <span>{rr}% response rate</span>
        <span>{campaign.entries.length} entries</span>
      </div>
    </button>
  );
}

// ━━━ New Campaign Form ━━━
function NewCampaignForm({
  onClose,
  isPending,
  startTransition,
}: {
  onClose: () => void;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      await createCampaign({
        name: name.trim(),
        description: description.trim() || undefined,
        target_audience: targetAudience.trim() || undefined,
        message_template: messageTemplate.trim() || undefined,
      });
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card-elevated rounded-2xl p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-section-heading text-text-primary">New Campaign</h3>
        <button type="button" onClick={onClose} className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer">
          Cancel
        </button>
      </div>

      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Campaign name"
        className="w-full text-sm bg-surface-tertiary border border-border rounded-lg px-3 py-2 text-text-primary placeholder:text-text-tertiary/50 outline-none focus:border-text-primary/20 transition-colors"
        autoFocus
      />
      <input
        value={targetAudience}
        onChange={e => setTargetAudience(e.target.value)}
        placeholder="Target audience (e.g. SaaS founders, agency owners)"
        className="w-full text-xs bg-surface-tertiary border border-border rounded-lg px-3 py-2 text-text-primary placeholder:text-text-tertiary/50 outline-none focus:border-text-primary/20 transition-colors"
      />
      <textarea
        value={messageTemplate}
        onChange={e => setMessageTemplate(e.target.value)}
        placeholder="Paste your outreach message template here..."
        rows={3}
        className="w-full text-xs bg-surface-tertiary border border-border rounded-lg px-3 py-2 text-text-secondary placeholder:text-text-tertiary/50 outline-none focus:border-text-primary/20 transition-colors resize-none"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description / notes (optional)"
        rows={2}
        className="w-full text-xs bg-surface-tertiary border border-border rounded-lg px-3 py-2 text-text-secondary placeholder:text-text-tertiary/50 outline-none focus:border-text-primary/20 transition-colors resize-none"
      />

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!name.trim() || isPending}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
            name.trim()
              ? 'bg-text-primary text-background hover:bg-text-primary/90'
              : 'bg-surface-tertiary text-text-tertiary cursor-not-allowed'
          )}
        >
          {isPending ? 'Creating...' : 'Create Campaign'}
        </button>
      </div>
    </form>
  );
}

// ━━━ Campaign Detail ━━━
function CampaignDetail({
  campaign,
  onBack,
  isPending,
  startTransition,
}: {
  campaign: OutboundCampaignWithEntries;
  onBack: () => void;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);

  const style = STATUS_STYLES[campaign.status];
  const rr = campaign.totals.sends > 0 ? ((campaign.totals.responses / campaign.totals.sends) * 100).toFixed(1) : '0';
  const callRate = campaign.totals.responses > 0 ? ((campaign.totals.calls_booked / campaign.totals.responses) * 100).toFixed(1) : '0';
  const cr = campaign.totals.calls_booked > 0 ? ((campaign.totals.closes / campaign.totals.calls_booked) * 100).toFixed(1) : '0';

  function handleStatusChange(status: OutboundCampaignStatus) {
    startTransition(async () => {
      await updateCampaign(campaign.id, { status });
      setEditingStatus(false);
    });
  }

  function handleDelete() {
    if (!confirm('Delete this campaign and all its entries?')) return;
    startTransition(async () => {
      await deleteCampaign(campaign.id);
      onBack();
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <button onClick={onBack} className="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer mb-1">
            ← Campaigns
          </button>
          <h2 className="text-section-heading text-text-primary">{campaign.name}</h2>
          {campaign.target_audience && (
            <p className="text-xs text-text-tertiary mt-0.5">{campaign.target_audience}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {editingStatus ? (
            <div className="flex items-center gap-1">
              {(['active', 'paused', 'completed'] as OutboundCampaignStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={cn(
                    'text-xs px-2 py-1 rounded-md font-medium cursor-pointer transition-colors',
                    STATUS_STYLES[s].bg, STATUS_STYLES[s].text,
                    campaign.status === s && 'ring-1 ring-current'
                  )}
                >
                  {STATUS_STYLES[s].label}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setEditingStatus(true)}
              className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium cursor-pointer', style.bg, style.text)}
            >
              {style.label}
            </button>
          )}
          <button
            onClick={handleDelete}
            className="text-xs text-red-400/60 hover:text-red-400 transition-colors cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Message template (collapsible) */}
      {campaign.message_template && (
        <div className="card-elevated rounded-2xl">
          <button
            onClick={() => setShowTemplate(!showTemplate)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
          >
            <span className="font-medium">Message Template</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className={cn('transition-transform', showTemplate && 'rotate-180')}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {showTemplate && (
            <div className="px-4 pb-3">
              <pre className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed font-sans">{campaign.message_template}</pre>
            </div>
          )}
        </div>
      )}

      {/* Conversion funnel */}
      <div className="card-elevated rounded-2xl p-6">
        <h3 className="text-xs font-medium text-text-tertiary mb-3">Conversion Funnel</h3>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <FunnelStep label="Sends" value={campaign.totals.sends} />
          <FunnelArrow pct={rr} />
          <FunnelStep label="Responses" value={campaign.totals.responses} />
          <FunnelArrow pct={callRate} />
          <FunnelStep label="Calls" value={campaign.totals.calls_booked} />
          <FunnelArrow pct={cr} />
          <FunnelStep label="Closes" value={campaign.totals.closes} />
        </div>
      </div>

      {/* Add entry */}
      <div className="flex items-center justify-between">
        <h3 className="text-section-heading text-text-primary">Daily Log</h3>
        <button
          onClick={() => setShowAddEntry(true)}
          className="text-xs px-3 py-1.5 rounded-lg bg-text-primary text-background hover:bg-text-primary/90 transition-colors cursor-pointer font-medium"
        >
          + Log Activity
        </button>
      </div>

      {showAddEntry && (
        <AddEntryForm
          campaignId={campaign.id}
          onClose={() => setShowAddEntry(false)}
          isPending={isPending}
          startTransition={startTransition}
        />
      )}

      {/* Entry list */}
      {campaign.entries.length === 0 ? (
        <div className="card-elevated rounded-2xl p-6 text-center">
          <p className="text-xs text-text-tertiary">No entries yet. Log your first batch of sends.</p>
        </div>
      ) : (
        <div className="card-elevated rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 text-text-tertiary font-medium">Date</th>
                  <th className="text-right px-3 py-2.5 text-text-tertiary font-medium">Sends</th>
                  <th className="text-right px-3 py-2.5 text-text-tertiary font-medium">Replies</th>
                  <th className="text-right px-3 py-2.5 text-text-tertiary font-medium">Calls</th>
                  <th className="text-right px-3 py-2.5 text-text-tertiary font-medium">Closes</th>
                  <th className="text-left px-3 py-2.5 text-text-tertiary font-medium">Notes</th>
                  <th className="px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {campaign.entries.map(entry => (
                  <EntryRow key={entry.id} entry={entry} isPending={isPending} startTransition={startTransition} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━ Funnel Step ━━━
function FunnelStep({ label, value }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-lg sm:text-xl font-bold font-mono text-text-primary">{value}</p>
      <p className="text-xs text-text-tertiary mt-0.5">{label}</p>
    </div>
  );
}

function FunnelArrow({ pct }: { pct: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0 px-0.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-tertiary">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
      <span className="text-xs text-text-tertiary font-mono">{pct}%</span>
    </div>
  );
}

// ━━━ Add Entry Form ━━━
function AddEntryForm({
  campaignId,
  onClose,
  isPending,
  startTransition,
}: {
  campaignId: string;
  onClose: () => void;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [sends, setSends] = useState('');
  const [responses, setResponses] = useState('');
  const [callsBooked, setCallsBooked] = useState('');
  const [closes, setCloses] = useState('');
  const [notes, setNotes] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await addEntry({
        campaign_id: campaignId,
        date,
        sends: Number(sends) || 0,
        responses: Number(responses) || 0,
        calls_booked: Number(callsBooked) || 0,
        closes: Number(closes) || 0,
        notes: notes.trim() || undefined,
      });
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card-elevated rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-text-primary">Log Activity</h4>
        <button type="button" onClick={onClose} className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer">Cancel</button>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <div>
          <label className="text-xs text-text-tertiary block mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full text-xs bg-surface-tertiary border border-border rounded-lg px-2 py-1.5 text-text-primary outline-none focus:border-text-primary/20 transition-colors" />
        </div>
        <div>
          <label className="text-xs text-text-tertiary block mb-1">Sends</label>
          <input type="number" value={sends} onChange={e => setSends(e.target.value)} placeholder="0" min="0"
            className="w-full text-xs bg-surface-tertiary border border-border rounded-lg px-2 py-1.5 text-text-primary outline-none focus:border-text-primary/20 transition-colors text-center" />
        </div>
        <div>
          <label className="text-xs text-text-tertiary block mb-1">Replies</label>
          <input type="number" value={responses} onChange={e => setResponses(e.target.value)} placeholder="0" min="0"
            className="w-full text-xs bg-surface-tertiary border border-border rounded-lg px-2 py-1.5 text-text-primary outline-none focus:border-text-primary/20 transition-colors text-center" />
        </div>
        <div>
          <label className="text-xs text-text-tertiary block mb-1">Calls</label>
          <input type="number" value={callsBooked} onChange={e => setCallsBooked(e.target.value)} placeholder="0" min="0"
            className="w-full text-xs bg-surface-tertiary border border-border rounded-lg px-2 py-1.5 text-text-primary outline-none focus:border-text-primary/20 transition-colors text-center" />
        </div>
        <div>
          <label className="text-xs text-text-tertiary block mb-1">Closes</label>
          <input type="number" value={closes} onChange={e => setCloses(e.target.value)} placeholder="0" min="0"
            className="w-full text-xs bg-surface-tertiary border border-border rounded-lg px-2 py-1.5 text-text-primary outline-none focus:border-text-primary/20 transition-colors text-center" />
        </div>
      </div>

      <input
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full text-xs bg-surface-tertiary border border-border rounded-lg px-3 py-2 text-text-secondary placeholder:text-text-tertiary/50 outline-none focus:border-text-primary/20 transition-colors"
      />

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-1.5 rounded-lg text-xs font-medium bg-text-primary text-background hover:bg-text-primary/90 transition-all cursor-pointer"
        >
          {isPending ? 'Saving...' : 'Save Entry'}
        </button>
      </div>
    </form>
  );
}

// ━━━ Entry Row (inline editable) ━━━
function EntryRow({
  entry,
  isPending,
  startTransition,
}: {
  entry: OutboundCampaignWithEntries['entries'][0];
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [sends, setSends] = useState(String(entry.sends));
  const [responses, setResponses] = useState(String(entry.responses));
  const [callsBooked, setCallsBooked] = useState(String(entry.calls_booked));
  const [closes, setCloses] = useState(String(entry.closes));
  const [notes, setNotes] = useState(entry.notes || '');

  const dateStr = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const hasChanges =
    Number(sends) !== entry.sends ||
    Number(responses) !== entry.responses ||
    Number(callsBooked) !== entry.calls_booked ||
    Number(closes) !== entry.closes ||
    (notes.trim() || null) !== (entry.notes || null);

  function handleSave() {
    if (!hasChanges) { setEditing(false); return; }
    startTransition(async () => {
      await updateEntry(entry.id, {
        sends: Number(sends) || 0,
        responses: Number(responses) || 0,
        calls_booked: Number(callsBooked) || 0,
        closes: Number(closes) || 0,
        notes: notes.trim() || null,
      });
      setEditing(false);
    });
  }

  function handleCancel() {
    setSends(String(entry.sends));
    setResponses(String(entry.responses));
    setCallsBooked(String(entry.calls_booked));
    setCloses(String(entry.closes));
    setNotes(entry.notes || '');
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  }

  function handleDelete() {
    if (!confirm('Delete this entry?')) return;
    startTransition(async () => {
      await deleteEntry(entry.id);
    });
  }

  if (editing) {
    return (
      <tr className="border-b border-border bg-surface-tertiary">
        <td className="px-4 py-2 text-text-secondary">{dateStr}</td>
        <td className="px-2 py-1.5">
          <input type="number" value={sends} onChange={e => setSends(e.target.value)} onKeyDown={handleKeyDown} min="0"
            className="w-full text-xs bg-surface-tertiary border border-border rounded px-1.5 py-1 text-text-primary outline-none focus:border-text-primary/20 text-right font-mono" autoFocus />
        </td>
        <td className="px-2 py-1.5">
          <input type="number" value={responses} onChange={e => setResponses(e.target.value)} onKeyDown={handleKeyDown} min="0"
            className="w-full text-xs bg-surface-tertiary border border-border rounded px-1.5 py-1 text-text-primary outline-none focus:border-text-primary/20 text-right font-mono" />
        </td>
        <td className="px-2 py-1.5">
          <input type="number" value={callsBooked} onChange={e => setCallsBooked(e.target.value)} onKeyDown={handleKeyDown} min="0"
            className="w-full text-xs bg-surface-tertiary border border-border rounded px-1.5 py-1 text-text-primary outline-none focus:border-text-primary/20 text-right font-mono" />
        </td>
        <td className="px-2 py-1.5">
          <input type="number" value={closes} onChange={e => setCloses(e.target.value)} onKeyDown={handleKeyDown} min="0"
            className="w-full text-xs bg-surface-tertiary border border-border rounded px-1.5 py-1 text-text-primary outline-none focus:border-text-primary/20 text-right font-mono" />
        </td>
        <td className="px-2 py-1.5">
          <input value={notes} onChange={e => setNotes(e.target.value)} onKeyDown={handleKeyDown} placeholder="Notes"
            className="w-full text-xs bg-surface-tertiary border border-border rounded px-1.5 py-1 text-text-primary outline-none focus:border-text-primary/20" />
        </td>
        <td className="px-2 py-1.5">
          <div className="flex items-center gap-1">
            <button onClick={handleSave} disabled={isPending}
              className="text-xs text-text-primary hover:text-text-secondary font-medium cursor-pointer">
              {isPending ? '...' : '✓'}
            </button>
            <button onClick={handleCancel}
              className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer">
              ✕
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border hover: transition-colors group">
      <td className="px-4 py-2.5 text-text-secondary">{dateStr}</td>
      <td className="text-right px-3 py-2.5 font-mono text-text-primary cursor-pointer" onClick={() => setEditing(true)}>{entry.sends}</td>
      <td className="text-right px-3 py-2.5 font-mono text-text-primary cursor-pointer" onClick={() => setEditing(true)}>{entry.responses}</td>
      <td className="text-right px-3 py-2.5 font-mono text-text-primary cursor-pointer" onClick={() => setEditing(true)}>{entry.calls_booked}</td>
      <td className="text-right px-3 py-2.5 font-mono text-text-primary cursor-pointer" onClick={() => setEditing(true)}>{entry.closes}</td>
      <td className="px-3 py-2.5 text-text-tertiary max-w-[200px] truncate cursor-pointer" onClick={() => setEditing(true)}>{entry.notes || '—'}</td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="text-xs text-text-tertiary/60 hover:text-text-secondary cursor-pointer">
            ✎
          </button>
          <button onClick={handleDelete} disabled={isPending} className="text-xs text-text-tertiary/40 hover:text-red-400 cursor-pointer">
            ×
          </button>
        </div>
      </td>
    </tr>
  );
}
