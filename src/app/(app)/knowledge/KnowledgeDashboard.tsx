'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils/cn';
import { KNOWLEDGE_TYPES } from '@/lib/constants';
import { createKnowledgeEntry, updateKnowledgeEntry, deleteKnowledgeEntry } from '@/actions/knowledge';
import type { KnowledgeEntry, KnowledgeEntryType } from '@/lib/types/database';

interface KnowledgeDashboardProps {
  entries: KnowledgeEntry[];
}

const TAB_TYPES: { value: KnowledgeEntryType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'reading', label: 'Reading' },
  { value: 'idea', label: 'Ideas' },
  { value: 'lesson', label: 'Lessons' },
  { value: 'quote', label: 'Quotes' },
  { value: 'mental_model', label: 'Models' },
  { value: 'content_hook', label: 'Content Hooks' },
];

export function KnowledgeDashboard({ entries }: KnowledgeDashboardProps) {
  const [activeTab, setActiveTab] = useState<KnowledgeEntryType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Stats
  const stats = useMemo(() => {
    const readings = entries.filter(e => e.type === 'reading');
    const completed = readings.filter(e => e.reading_status === 'completed').length;
    const applied = entries.filter(e => e.applied).length;
    const withTakeaways = entries.filter(e => e.takeaway_1 || e.takeaway_2 || e.takeaway_3).length;
    return { total: entries.length, readings: readings.length, completed, applied, withTakeaways };
  }, [entries]);

  const filtered = useMemo(() => {
    let result = activeTab === 'all' ? entries : entries.filter((e) => e.type === activeTab);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.content?.toLowerCase().includes(q) ||
        e.takeaway_1?.toLowerCase().includes(q) ||
        e.takeaway_2?.toLowerCase().includes(q) ||
        e.takeaway_3?.toLowerCase().includes(q) ||
        e.source?.toLowerCase().includes(q) ||
        e.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [entries, activeTab, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-text-primary">Knowledge Vault</h1>
          <p className="text-sm text-text-tertiary mt-0.5">Readings, ideas, lessons and mental models</p>
        </div>
        <Button size="sm" onClick={() => { setEditingEntry(null); setShowModal(true); }}>+ Add Entry</Button>
      </div>

      {/* Stats */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Entries', value: stats.total, color: 'text-text-primary' },
            { label: 'Readings', value: stats.readings, color: 'text-text-secondary' },
            { label: 'Completed', value: stats.completed, color: stats.completed > 0 ? 'text-accent' : 'text-text-tertiary' },
            { label: 'Applied', value: stats.applied, color: stats.applied > 0 ? 'text-accent-green' : 'text-text-tertiary' },
            { label: 'Takeaways', value: stats.withTakeaways, color: 'text-text-tertiary' },
          ].map(s => (
            <div key={s.label} className="card-elevated rounded-lg px-3 py-3.5 text-center">
              <p className={cn('text-xl font-bold tabular-nums', s.color)}>{s.value}</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Tabs container */}
      <div className="card-elevated rounded-lg">
        {/* Search */}
        <div className="relative px-4 pt-4">
          <svg className="absolute left-7 top-1/2 mt-0.5 -translate-y-1/2 text-text-tertiary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search entries, takeaways, tags..."
            className="w-full text-sm bg-surface-tertiary border border-border rounded-xl pl-9 pr-3 py-2.5 text-text-primary placeholder:text-text-tertiary/60 outline-none focus:border-accent/30 transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-7 top-1/2 mt-0.5 -translate-y-1/2 text-text-tertiary hover:text-text-secondary cursor-pointer">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          )}
        </div>

        {/* Type Tabs — pill style */}
        <div className="flex gap-1 overflow-x-auto px-4 py-3">
          {TAB_TYPES.map((tab) => {
            const count = tab.value === 'all' ? entries.length : entries.filter((e) => e.type === tab.value).length;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'px-3 py-1.5 text-xs whitespace-nowrap transition-colors rounded-full cursor-pointer font-medium',
                  activeTab === tab.value
                    ? 'bg-surface-tertiary text-text-primary shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary/50'
                )}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Entries */}
        {filtered.length === 0 ? (
          <div className="px-4 pb-6 pt-2">
            <div className="text-center py-10">
              <svg className="mx-auto mb-3 text-text-tertiary" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-sm text-text-tertiary">
                {searchQuery ? `No entries matching "${searchQuery}"` : 'No entries yet. Start building your knowledge vault.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onEdit={() => { setEditingEntry(entry); setShowModal(true); }}
                onToggleApplied={() => {
                  updateKnowledgeEntry(entry.id, { applied: !entry.applied }).catch(e => console.error(e));
                }}
                onDelete={() => {
                  deleteKnowledgeEntry(entry.id).catch(e => console.error(e));
                }}
              />
            ))}
          </div>
        )}
      </div>

      <EntryFormModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingEntry(null); }}
        isPending={isPending}
        entry={editingEntry}
        defaultType={activeTab === 'all' ? 'reading' : activeTab}
        onSubmit={(data) => {
          setIsPending(true);
          setShowModal(false);
          if (editingEntry) {
            updateKnowledgeEntry(editingEntry.id, data).catch(e => console.error(e)).finally(() => { setIsPending(false); setEditingEntry(null); });
          } else {
            createKnowledgeEntry(data).catch(e => console.error(e)).finally(() => setIsPending(false));
          }
        }}
      />
    </div>
  );
}

function EntryCard({
  entry,
  onEdit,
  onToggleApplied,
  onDelete,
}: {
  entry: KnowledgeEntry;
  onEdit: () => void;
  onToggleApplied: () => void;
  onDelete: () => void;
}) {
  const typeLabel = KNOWLEDGE_TYPES.find((t) => t.value === entry.type)?.label || entry.type;

  const statusVariant = entry.reading_status === 'completed' ? 'success' as const
    : entry.reading_status === 'reading' ? 'warning' as const
    : 'default' as const;

  return (
    <div className="px-5 py-4 group hover:bg-surface-tertiary/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-text-primary">{entry.title}</p>
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary bg-surface-tertiary rounded-full px-2 py-0.5 font-medium">{typeLabel}</span>
            {entry.type === 'reading' && entry.reading_status && (
              <Badge variant={statusVariant}>{entry.reading_status}</Badge>
            )}
            {entry.applied && <Badge variant="accent">Applied</Badge>}
          </div>

          {entry.content && (
            <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">{entry.content}</p>
          )}

          <div className="flex items-center gap-3 text-xs text-text-tertiary">
            {entry.source && <span>Source: {entry.source}</span>}
            {entry.hook_platform && <span>Platform: {entry.hook_platform}</span>}
          </div>

          {/* Takeaways */}
          {(entry.takeaway_1 || entry.takeaway_2 || entry.takeaway_3) && (
            <div className="space-y-1 pt-1">
              {[entry.takeaway_1, entry.takeaway_2, entry.takeaway_3].filter(Boolean).map((t, i) => (
                <p key={i} className="text-xs text-text-secondary pl-3 border-l-2 border-accent/20">{t}</p>
              ))}
            </div>
          )}

          {entry.tags && entry.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap pt-0.5">
              {entry.tags.map((tag) => (
                <span key={tag} className="text-xs text-text-tertiary bg-surface-tertiary rounded-full px-2 py-0.5">{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
          {entry.type === 'reading' && (
            <button
              onClick={onToggleApplied}
              className="text-xs text-accent hover:text-accent/80 transition-colors px-2 py-1 rounded-md hover:bg-accent/10 cursor-pointer font-medium"
            >
              {entry.applied ? 'Unapply' : 'Apply'}
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

function EntryFormModal({
  open,
  onClose,
  isPending,
  entry,
  defaultType,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  isPending: boolean;
  entry: KnowledgeEntry | null;
  defaultType: KnowledgeEntryType;
  onSubmit: (data: { type: string; title: string; content?: string; reading_status?: string; takeaway_1?: string; takeaway_2?: string; takeaway_3?: string; source?: string; hook_platform?: string }) => void;
}) {
  const [type, setType] = useState<string>(entry?.type || defaultType);
  const [title, setTitle] = useState(entry?.title || '');
  const [content, setContent] = useState(entry?.content || '');
  const [readingStatus, setReadingStatus] = useState<string>(entry?.reading_status || 'to_read');
  const [takeaway1, setTakeaway1] = useState(entry?.takeaway_1 || '');
  const [takeaway2, setTakeaway2] = useState(entry?.takeaway_2 || '');
  const [takeaway3, setTakeaway3] = useState(entry?.takeaway_3 || '');
  const [source, setSource] = useState(entry?.source || '');
  const [hookPlatform, setHookPlatform] = useState(entry?.hook_platform || '');

  // Reset form when entry changes
  useState(() => {
    setType(entry?.type || defaultType);
    setTitle(entry?.title || '');
    setContent(entry?.content || '');
    setReadingStatus(entry?.reading_status || 'to_read');
    setTakeaway1(entry?.takeaway_1 || '');
    setTakeaway2(entry?.takeaway_2 || '');
    setTakeaway3(entry?.takeaway_3 || '');
    setSource(entry?.source || '');
    setHookPlatform(entry?.hook_platform || '');
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      type,
      title,
      content: content || undefined,
      reading_status: type === 'reading' ? readingStatus : undefined,
      takeaway_1: takeaway1 || undefined,
      takeaway_2: takeaway2 || undefined,
      takeaway_3: takeaway3 || undefined,
      source: source || undefined,
      hook_platform: type === 'content_hook' ? hookPlatform || undefined : undefined,
    });
    if (!entry) {
      setTitle('');
      setContent('');
      setTakeaway1('');
      setTakeaway2('');
      setTakeaway3('');
      setSource('');
      setHookPlatform('');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={entry ? 'Edit Entry' : 'Add Knowledge Entry'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={KNOWLEDGE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        />
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Textarea label="Content" value={content} onChange={(e) => setContent(e.target.value)} rows={3} />

        {type === 'reading' && (
          <Select
            label="Status"
            value={readingStatus}
            onChange={(e) => setReadingStatus(e.target.value)}
            options={[
              { value: 'to_read', label: 'To Read' },
              { value: 'reading', label: 'Reading' },
              { value: 'completed', label: 'Completed' },
            ]}
          />
        )}

        {type === 'content_hook' && (
          <Input label="Platform" value={hookPlatform} onChange={(e) => setHookPlatform(e.target.value)} placeholder="Twitter, LinkedIn, etc." />
        )}

        <Input label="Source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Book, article, person..." />

        <div className="space-y-2">
          <p className="text-xs font-medium text-text-secondary ">Takeaways</p>
          <Input placeholder="Takeaway 1" value={takeaway1} onChange={(e) => setTakeaway1(e.target.value)} />
          <Input placeholder="Takeaway 2" value={takeaway2} onChange={(e) => setTakeaway2(e.target.value)} />
          <Input placeholder="Takeaway 3" value={takeaway3} onChange={(e) => setTakeaway3(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isPending || !title}>{isPending ? 'Saving...' : entry ? 'Update' : 'Add Entry'}</Button>
        </div>
      </form>
    </Modal>
  );
}
