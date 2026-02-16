'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
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
  const [showModal, setShowModal] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const filtered = activeTab === 'all' ? entries : entries.filter((e) => e.type === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text-primary">Knowledge Vault</h1>
        <Button size="sm" onClick={() => setShowModal(true)}>+ Add Entry</Button>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {TAB_TYPES.map((tab) => {
          const count = tab.value === 'all' ? entries.length : entries.filter((e) => e.type === tab.value).length;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-2 text-xs whitespace-nowrap transition-colors duration-200 border-b-2 -mb-px cursor-pointer ${
                activeTab === tab.value
                  ? 'text-accent border-accent'
                  : 'text-text-secondary border-transparent hover:text-text-primary'
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Entries */}
      {filtered.length === 0 ? (
        <div className="card-surface border border-border rounded-2xl p-8 text-center">
          <p className="text-sm text-text-tertiary">No entries yet. Start building your knowledge vault.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
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

      <EntryFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        isPending={isPending}
        defaultType={activeTab === 'all' ? 'reading' : activeTab}
        onSubmit={(data) => {
          setIsPending(true);
          setShowModal(false);
          createKnowledgeEntry(data).catch(e => console.error(e)).finally(() => setIsPending(false));
        }}
      />
    </div>
  );
}

function EntryCard({
  entry,
  onToggleApplied,
  onDelete,
}: {
  entry: KnowledgeEntry;
  onToggleApplied: () => void;
  onDelete: () => void;
}) {
  const typeLabel = KNOWLEDGE_TYPES.find((t) => t.value === entry.type)?.label || entry.type;

  const statusVariant = entry.reading_status === 'completed' ? 'success' as const
    : entry.reading_status === 'reading' ? 'warning' as const
    : 'default' as const;

  return (
    <div className="card-surface border border-border rounded-2xl card-hover p-5 space-y-2">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-text-primary line-clamp-1">{entry.title}</p>
            <Badge variant="default">{typeLabel}</Badge>
            {entry.type === 'reading' && entry.reading_status && (
              <Badge variant={statusVariant}>{entry.reading_status}</Badge>
            )}
            {entry.applied && <Badge variant="accent">Applied</Badge>}
          </div>

          {entry.content && (
            <p className="text-xs text-text-secondary line-clamp-2">{entry.content}</p>
          )}

          {entry.source && (
            <p className="text-xs text-text-tertiary">Source: {entry.source}</p>
          )}

          {entry.hook_platform && (
            <p className="text-xs text-text-tertiary">Platform: {entry.hook_platform}</p>
          )}
        </div>
      </div>

      {/* Takeaways */}
      {(entry.takeaway_1 || entry.takeaway_2 || entry.takeaway_3) && (
        <div className="space-y-1 pt-1">
          <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">Takeaways</p>
          {[entry.takeaway_1, entry.takeaway_2, entry.takeaway_3].filter(Boolean).map((t, i) => (
            <p key={i} className="text-xs text-text-secondary pl-2 border-l border-border">{t}</p>
          ))}
        </div>
      )}

      {entry.tags && entry.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {entry.tags.map((tag) => (
            <span key={tag} className="text-[10px] text-text-tertiary bg-surface-tertiary px-1.5 py-0.5">{tag}</span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {entry.type === 'reading' && (
          <Button size="sm" variant="ghost" onClick={onToggleApplied}>
            {entry.applied ? 'Mark Unapplied' : 'Mark Applied'}
          </Button>
        )}
        <button
          onClick={onDelete}
          className="text-xs text-text-tertiary hover:text-danger transition-colors duration-200 ml-auto cursor-pointer"
          title="Delete entry"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function EntryFormModal({
  open,
  onClose,
  isPending,
  defaultType,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  isPending: boolean;
  defaultType: KnowledgeEntryType;
  onSubmit: (data: { type: string; title: string; content?: string; reading_status?: string; takeaway_1?: string; takeaway_2?: string; takeaway_3?: string; source?: string; hook_platform?: string }) => void;
}) {
  const [type, setType] = useState<string>(defaultType);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [readingStatus, setReadingStatus] = useState('to_read');
  const [takeaway1, setTakeaway1] = useState('');
  const [takeaway2, setTakeaway2] = useState('');
  const [takeaway3, setTakeaway3] = useState('');
  const [source, setSource] = useState('');
  const [hookPlatform, setHookPlatform] = useState('');

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
    setTitle('');
    setContent('');
    setTakeaway1('');
    setTakeaway2('');
    setTakeaway3('');
    setSource('');
    setHookPlatform('');
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Knowledge Entry">
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
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Takeaways</p>
          <Input placeholder="Takeaway 1" value={takeaway1} onChange={(e) => setTakeaway1(e.target.value)} />
          <Input placeholder="Takeaway 2" value={takeaway2} onChange={(e) => setTakeaway2(e.target.value)} />
          <Input placeholder="Takeaway 3" value={takeaway3} onChange={(e) => setTakeaway3(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isPending || !title}>{isPending ? 'Adding...' : 'Add Entry'}</Button>
        </div>
      </form>
    </Modal>
  );
}
