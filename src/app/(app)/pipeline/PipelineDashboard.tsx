'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { formatCurrency } from '@/lib/utils/currency';
import { LEAD_STAGES, STAGE_PROBABILITY_DEFAULTS } from '@/lib/constants';
import { createLead, updateLead, deleteLead, convertLeadToClient } from '@/actions/pipeline';
import type { PipelineLead, LeadStage } from '@/lib/types/database';

interface PipelineDashboardProps {
  leads: PipelineLead[];
}

const _STAGE_COLORS: Record<string, string> = {
  lead: 'text-text-secondary',
  conversation: 'text-text-secondary',
  proposal_sent: 'text-text-secondary',
  closed: 'text-text-primary',
  lost: 'text-text-tertiary',
};

type LeadFormData = {
  name: string;
  company?: string;
  estimated_value?: number;
  stage?: string;
  probability?: number;
  next_action?: string;
  next_action_date?: string;
  source?: string;
  notes?: string;
};

export function PipelineDashboard({ leads: initialLeads }: PipelineDashboardProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<PipelineLead | null>(null);
  const [convertingLead, setConvertingLead] = useState<PipelineLead | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync server data into local state when it changes (e.g., after revalidation)
  const [prevInitial, setPrevInitial] = useState(initialLeads);
  if (initialLeads !== prevInitial) {
    setPrevInitial(initialLeads);
    setLeads(initialLeads);
  }

  const stages: LeadStage[] = ['lead', 'conversation', 'proposal_sent', 'closed', 'lost'];

  const nextAction = leads
    .filter((l) => l.next_action && l.next_action_date && l.stage !== 'lost' && l.stage !== 'closed')
    .sort((a, b) => (a.next_action_date || '').localeCompare(b.next_action_date || ''))[0];

  const pipelineValue = leads
    .filter((l) => l.stage !== 'lost' && l.stage !== 'closed')
    .reduce((sum, l) => sum + (l.estimated_value || 0), 0);

  const closedValue = leads
    .filter((l) => l.stage === 'closed')
    .reduce((sum, l) => sum + (l.estimated_value || 0), 0);

  function handleCreate(data: LeadFormData) {
    // Optimistic add
    const tempId = crypto.randomUUID();
    const optimisticLead: PipelineLead = {
      id: tempId,
      user_id: '',
      name: data.name,
      company: data.company || null,
      estimated_value: data.estimated_value || null,
      stage: (data.stage || 'lead') as LeadStage,
      probability: data.probability || null,
      next_action: data.next_action || null,
      next_action_date: data.next_action_date || null,
      notes: data.notes || null,
      source: data.source || null,
      lost_reason: null,
      closed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setLeads(prev => [optimisticLead, ...prev]);
    setShowModal(false);
    setIsSubmitting(true);
    createLead(data)
      .catch(e => {
        console.error('Failed to create lead:', e);
        // Revert optimistic add
        setLeads(prev => prev.filter(l => l.id !== tempId));
      })
      .finally(() => setIsSubmitting(false));
  }

  function handleEdit(lead: PipelineLead) {
    setEditingLead(lead);
  }

  function handleUpdate(data: LeadFormData) {
    if (!editingLead) return;
    const id = editingLead.id;
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...data, stage: (data.stage || l.stage) as LeadStage } : l));
    setEditingLead(null);
    // Fire-and-forget
    updateLead(id, data).catch(e => {
      console.error('Failed to update lead:', e);
      // Revert optimistic update
      setLeads(prev => prev.map(l => l.id === id ? { ...initialLeads.find(il => il.id === id) || l } : l));
    });
  }

  function handleMoveStage(lead: PipelineLead, newStage: string) {
    // Intercept close → offer to convert to client
    if (newStage === 'closed') {
      setConvertingLead(lead);
      return;
    }
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, stage: newStage as LeadStage } : l));
    // Fire-and-forget
    updateLead(lead.id, { stage: newStage }).catch(e => {
      console.error('Failed to move lead:', e);
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, stage: lead.stage } : l));
    });
  }

  function handleConvertToClient(clientData: {
    name: string;
    retainer_amount?: number;
    contract_start?: string;
    contract_end?: string;
    payment_day?: number;
  }) {
    if (!convertingLead) return;
    const leadId = convertingLead.id;
    // Optimistic: move to closed
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: 'closed' as LeadStage, closed_at: new Date().toISOString() } : l));
    setConvertingLead(null);
    convertLeadToClient(leadId, clientData).catch(e => {
      console.error('Failed to convert lead:', e);
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: convertingLead.stage } : l));
    });
  }

  function handleCloseWithoutClient() {
    if (!convertingLead) return;
    const leadId = convertingLead.id;
    // Just close — no client creation
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: 'closed' as LeadStage } : l));
    setConvertingLead(null);
    updateLead(leadId, { stage: 'closed' }).catch(e => {
      console.error('Failed to close lead:', e);
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: convertingLead.stage } : l));
    });
  }

  function handleDelete(lead: PipelineLead) {
    // Optimistic update
    setLeads(prev => prev.filter(l => l.id !== lead.id));
    // Fire-and-forget
    deleteLead(lead.id).catch(e => {
      console.error('Failed to delete lead:', e);
      setLeads(prev => [...prev, lead]);
    });
  }

  const activeLeads = leads.filter((l) => l.stage !== 'lost' && l.stage !== 'closed');
  const weightedValue = activeLeads.reduce((sum, l) => sum + (l.estimated_value || 0) * ((l.probability ?? STAGE_PROBABILITY_DEFAULTS[l.stage] ?? 0) / 100), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Pipeline</h1>
          <p className="text-sm text-text-tertiary mt-0.5">Track leads from first contact to close</p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)}>+ Add Lead</Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card-elevated rounded-lg p-5 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Pipeline Value</p>
          <p className="text-2xl font-bold text-text-primary tabular-nums">{formatCurrency(pipelineValue)}</p>
        </div>
        <div className="card-elevated rounded-lg p-5 space-y-1.5 bg-gradient-to-br from-accent-green/[0.04] to-transparent">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Closed Value</p>
          <p className="text-2xl font-bold text-text-primary tabular-nums">{formatCurrency(closedValue)}</p>
        </div>
        <div className="card-elevated rounded-lg p-5 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Weighted</p>
          <p className="text-2xl font-bold text-text-primary tabular-nums">{formatCurrency(weightedValue)}</p>
        </div>
        <div className="card-elevated rounded-lg p-5 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Active Leads</p>
          <p className="text-2xl font-bold text-text-primary tabular-nums">{activeLeads.length}</p>
          <p className="text-xs text-text-tertiary">{leads.length} total</p>
        </div>
      </div>

      {/* Next Action Banner */}
      {nextAction && (
        <div className="card-elevated rounded-lg p-4 flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-text-tertiary mb-0.5">Next Action</p>
            <p className="text-sm font-medium text-text-primary">{nextAction.next_action}</p>
            <p className="text-xs text-text-tertiary mt-0.5">{nextAction.name} {nextAction.company ? `@ ${nextAction.company}` : ''} · {nextAction.next_action_date}</p>
          </div>
        </div>
      )}

      {/* Stage Sections */}
      <div className="card-elevated rounded-lg overflow-hidden">
        {stages.map((stage, stageIdx) => {
          const stageLeads = leads.filter((l) => l.stage === stage);
          const stageLabel = LEAD_STAGES.find((s) => s.value === stage)?.label || stage;
          const stageValue = stageLeads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
          const stageDot = stage === 'closed' ? 'bg-accent-green' : stage === 'lost' ? 'bg-text-tertiary' : 'bg-accent';

          return (
            <div key={stage} className={cn(stageIdx > 0 && 'border-t border-border')}>
              {/* Stage header */}
              <div className="flex items-center justify-between px-5 py-3 bg-surface-tertiary/50">
                <div className="flex items-center gap-2.5">
                  <div className={cn('w-2 h-2 rounded-full', stageDot)} />
                  <span className="text-sm font-semibold text-text-primary">{stageLabel}</span>
                  <span className="text-xs text-text-tertiary bg-surface-tertiary rounded-full px-2 py-0.5">{stageLeads.length}</span>
                </div>
                {stageValue > 0 && (
                  <span className="text-xs font-medium text-text-secondary tabular-nums">{formatCurrency(stageValue)}</span>
                )}
              </div>

              {/* Lead rows */}
              {stageLeads.length === 0 ? (
                <div className="px-5 py-4">
                  <p className="text-xs text-text-tertiary">No leads in this stage</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onEdit={() => handleEdit(lead)}
                      onMoveStage={(newStage) => handleMoveStage(lead, newStage)}
                      onDelete={() => handleDelete(lead)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      <LeadFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        isPending={isSubmitting}
        onSubmit={handleCreate}
      />

      {/* Edit Modal */}
      {editingLead && (
        <LeadFormModal
          open={true}
          onClose={() => setEditingLead(null)}
          isPending={false}
          onSubmit={handleUpdate}
          lead={editingLead}
        />
      )}

      {/* Convert to Client Modal */}
      {convertingLead && (
        <ConvertToClientModal
          open={true}
          lead={convertingLead}
          onClose={() => setConvertingLead(null)}
          onConvert={handleConvertToClient}
          onCloseOnly={handleCloseWithoutClient}
        />
      )}
    </div>
  );
}

function LeadCard({
  lead,
  onEdit,
  onMoveStage,
  onDelete,
}: {
  lead: PipelineLead;
  onEdit: () => void;
  onMoveStage: (stage: string) => void;
  onDelete: () => void;
}) {
  const stages: LeadStage[] = ['lead', 'conversation', 'proposal_sent', 'closed', 'lost'];
  const currentIndex = stages.indexOf(lead.stage);

  const prob = lead.probability ?? STAGE_PROBABILITY_DEFAULTS[lead.stage] ?? 0;

  return (
    <div className="px-5 py-3.5 group hover:bg-surface-tertiary/30 transition-colors">
      <div className="flex items-center gap-4">
        {/* Lead info */}
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onEdit}>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-text-primary truncate">{lead.name}</p>
            {lead.company && (
              <span className="text-xs text-text-tertiary truncate hidden sm:inline">@ {lead.company}</span>
            )}
          </div>
          {lead.next_action && (
            <p className="text-xs text-text-tertiary mt-0.5 truncate">
              Next: {lead.next_action}
              {lead.next_action_date && <span> · {lead.next_action_date}</span>}
            </p>
          )}
        </div>

        {/* Metadata chips */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {lead.source && (
            <span className="text-xs text-text-tertiary bg-surface-tertiary rounded-full px-2 py-0.5 hidden sm:inline">{lead.source}</span>
          )}
          {lead.estimated_value != null && lead.estimated_value > 0 && (
            <span className="text-sm font-semibold text-text-primary tabular-nums">{formatCurrency(lead.estimated_value)}</span>
          )}
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full tabular-nums',
            prob >= 60 ? 'bg-accent-green/10 text-accent-green' : prob >= 30 ? 'bg-surface-tertiary text-text-secondary' : 'bg-surface-tertiary text-text-tertiary'
          )}>
            {prob}%
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {lead.stage !== 'closed' && lead.stage !== 'lost' && currentIndex < stages.length - 2 && (
            <button
              onClick={() => onMoveStage(stages[currentIndex + 1])}
              className="text-xs text-accent hover:text-accent/80 transition-colors px-2 py-1 rounded-md hover:bg-accent/10 cursor-pointer font-medium"
            >
              Advance
            </button>
          )}
          {lead.stage !== 'lost' && lead.stage !== 'closed' && (
            <button
              onClick={() => onMoveStage('lost')}
              className="text-xs text-text-tertiary hover:text-text-secondary transition-colors px-1.5 py-1 cursor-pointer"
            >
              Lost
            </button>
          )}
          <button onClick={onEdit} className="text-xs text-text-tertiary hover:text-text-primary transition-colors px-1.5 py-1 cursor-pointer">
            Edit
          </button>
          <button onClick={onDelete} className="text-xs text-text-tertiary hover:text-danger transition-colors px-1.5 py-1 cursor-pointer">
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadFormModal({
  open,
  onClose,
  isPending,
  onSubmit,
  lead,
}: {
  open: boolean;
  onClose: () => void;
  isPending: boolean;
  onSubmit: (data: LeadFormData) => void;
  lead?: PipelineLead;
}) {
  const isEditing = !!lead;
  const [name, setName] = useState(lead?.name || '');
  const [company, setCompany] = useState(lead?.company || '');
  const [value, setValue] = useState(lead?.estimated_value != null ? String(lead.estimated_value) : '');
  const [stage, setStage] = useState<string>(lead?.stage || 'lead');
  const [probability, setProbability] = useState(
    lead?.probability != null ? String(lead.probability) : String(STAGE_PROBABILITY_DEFAULTS[lead?.stage || 'lead'] || 20)
  );
  const [nextAction, setNextAction] = useState(lead?.next_action || '');
  const [nextActionDate, setNextActionDate] = useState(lead?.next_action_date || '');
  const [source, setSource] = useState(lead?.source || '');
  const [notes, setNotes] = useState(lead?.notes || '');

  function handleStageChange(newStage: string) {
    setStage(newStage);
    // Only auto-set probability if user hasn't manually changed it from the stage default
    const currentDefault = STAGE_PROBABILITY_DEFAULTS[stage] || 0;
    if (Number(probability) === currentDefault || !probability) {
      setProbability(String(STAGE_PROBABILITY_DEFAULTS[newStage] || 0));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      company: company || undefined,
      estimated_value: value ? Number(value) : undefined,
      stage,
      probability: probability ? Number(probability) : undefined,
      next_action: nextAction || undefined,
      next_action_date: nextActionDate || undefined,
      source: source || undefined,
      notes: notes || undefined,
    });
    if (!isEditing) {
      setName('');
      setCompany('');
      setValue('');
      setStage('lead');
      setProbability(String(STAGE_PROBABILITY_DEFAULTS['lead'] || 20));
      setNextAction('');
      setNextActionDate('');
      setSource('');
      setNotes('');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Edit Lead' : 'Add Lead'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Est. Value (£/mo)" type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
          <Select
            label="Stage"
            value={stage}
            onChange={(e) => handleStageChange(e.target.value)}
            options={LEAD_STAGES.map((s) => ({ value: s.value, label: s.label }))}
          />
          <Input label="Probability (%)" type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} placeholder="0" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Next Action" value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Follow up..." />
          <Input label="Next Action Date" type="date" value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} />
        </div>
        <Input label="Source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Referral, LinkedIn, etc." />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isPending || !name}>
            {isPending ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Lead')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ConvertToClientModal({
  open,
  lead,
  onClose,
  onConvert,
  onCloseOnly,
}: {
  open: boolean;
  lead: PipelineLead;
  onClose: () => void;
  onConvert: (data: { name: string; retainer_amount?: number; contract_start?: string; contract_end?: string; payment_day?: number }) => void;
  onCloseOnly: () => void;
}) {
  const [name, setName] = useState(lead.name + (lead.company ? ` (${lead.company})` : ''));
  const [retainer, setRetainer] = useState(lead.estimated_value != null ? String(lead.estimated_value) : '');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [paymentDay, setPaymentDay] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConvert({
      name,
      retainer_amount: retainer ? Number(retainer) : undefined,
      contract_start: contractStart || undefined,
      contract_end: contractEnd || undefined,
      payment_day: paymentDay ? Number(paymentDay) : undefined,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Convert to Client">
      <div className="space-y-4">
        <div className="card-elevated rounded-lg p-4">
          <p className="text-xs text-text-tertiary font-medium  mb-1">Won Deal</p>
          <p className="text-sm font-semibold text-text-primary">{lead.name}</p>
          {lead.company && <p className="text-xs text-text-secondary">{lead.company}</p>}
          {lead.estimated_value != null && lead.estimated_value > 0 && (
            <p className="text-sm text-text-primary mt-1">{formatCurrency(lead.estimated_value)}/mo</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Client Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Monthly Retainer (£)" type="number" step="0.01" value={retainer} onChange={(e) => setRetainer(e.target.value)} placeholder="0" />
            <Input label="Payment Day" type="number" min="1" max="31" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} placeholder="1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} />
            <Input label="End Date (optional)" type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} />
          </div>
          <p className="text-xs text-text-tertiary">
            If start date is in the future, this client will only appear in projections from that month onward.
          </p>
          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={onCloseOnly} className="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer">
              Close without adding client
            </button>
            <div className="flex gap-2">
              <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={!name}>Add Client</Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
