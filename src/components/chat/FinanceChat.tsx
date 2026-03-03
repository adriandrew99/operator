'use client';

import { useState, useRef, useEffect, useCallback, startTransition } from 'react';
import { cn } from '@/lib/utils/cn';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  'What\'s my current financial health?',
  'Am I at risk from client concentration?',
  'How much can I pay myself this month?',
  'What\'s my profit margin?',
];

export function FinanceChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && !isClosing && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open, isClosing]);

  // Click-outside to close
  useEffect(() => {
    if (!open || isClosing) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        handleClose();
      }
    }
    // Small delay so the opening click doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, isClosing]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open]);

  function handleClose() {
    setIsClosing(true);
    setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
    }, 200);
  }

  function handleOpen() {
    setOpen(true);
    setIsClosing(false);
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setError(null);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text.trim() };
    const assistantId = (Date.now() + 1).toString();

    startTransition(() => {
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsStreaming(true);
    });

    try {
      abortRef.current = new AbortController();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      // Add empty assistant message
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE format
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullContent += parsed.text;
                setMessages(prev =>
                  prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m)
                );
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              // Skip parse errors for non-JSON lines
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      // Remove the empty assistant message if streaming failed
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming, messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleStopStreaming = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  return (
    <>
      {/* Backdrop overlay — click to close (mobile + desktop) */}
      {open && (
        <div
          className={cn(
            'fixed inset-0 z-40 md:hidden transition-opacity duration-200',
            isClosing ? 'opacity-0' : 'opacity-100'
          )}
          style={{ background: 'var(--overlay-bg)' }}
          onClick={handleClose}
        />
      )}

      {/* Toggle button */}
      <button
        ref={buttonRef}
        onClick={() => open ? handleClose() : handleOpen()}
        className={cn(
          'fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50',
          'w-12 h-12 rounded-full flex items-center justify-center',
          'transition-all duration-300 shadow-lg',
          'active:scale-90',
          open
            ? 'bg-surface-tertiary text-text-secondary hover:text-text-primary rotate-90'
            : 'bg-accent text-white hover:bg-accent-bright hover:scale-105 hover:shadow-xl'
        )}
        title={open ? 'Close chat' : 'Ask about your finances'}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          ref={panelRef}
          className={cn(
            'fixed z-50',
            isClosing ? 'animate-chat-close' : 'animate-chat-open',
            // Mobile: full screen overlay
            'inset-0 md:inset-auto',
            // Desktop: bottom-right floating panel
            'md:bottom-20 md:right-6 md:w-[420px] md:h-[560px] md:max-h-[70vh]',
            'flex flex-col',
            'md:rounded-2xl overflow-hidden',
            'card-elevated'
          )}
          style={{ boxShadow: 'var(--card-shadow-lg)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-text-primary">Finance AI</h3>
                <p className="text-[10px] text-text-tertiary">
                  {isStreaming ? (
                    <span className="text-accent animate-pulse">Thinking...</span>
                  ) : (
                    'Ask about your finances'
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => { setMessages([]); setError(null); }}
                  className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-colors cursor-pointer"
                  title="Clear conversation"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                </button>
              )}
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-none">
            {messages.length === 0 && !isStreaming && (
              <div className="space-y-4 pt-4 animate-fade-in">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-text-secondary mb-1">Ask me anything about your finances</p>
                  <p className="text-[11px] text-text-tertiary">I have access to your real data</p>
                </div>

                <div className="space-y-1.5 pt-2">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-all duration-150 border border-border hover:border-border-light active:scale-[0.98] cursor-pointer"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={msg.id}
                className={cn(
                  'flex animate-fade-in',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-accent text-white rounded-br-md'
                    : 'bg-surface-tertiary text-text-primary rounded-bl-md'
                )}>
                  {msg.role === 'assistant' ? (
                    <div className="prose-chat whitespace-pre-wrap">
                      {msg.content || (
                        <span className="inline-flex gap-1 py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDuration: '0.6s' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDuration: '0.6s', animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDuration: '0.6s', animationDelay: '300ms' }} />
                        </span>
                      )}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {error && (
              <div className="flex justify-start animate-fade-in">
                <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-xs text-danger bg-danger/10 rounded-bl-md">
                  {error}
                  <button
                    onClick={() => setError(null)}
                    className="ml-2 underline underline-offset-2 hover:text-danger/80 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-4 pb-4 pt-2 border-t border-border safe-area-inset-bottom">
            {isStreaming && (
              <button
                onClick={handleStopStreaming}
                className="w-full mb-2 py-1.5 rounded-lg text-xs text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-colors cursor-pointer"
              >
                ■ Stop generating
              </button>
            )}
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your finances..."
                  rows={1}
                  className={cn(
                    'w-full bg-surface-tertiary rounded-xl px-4 py-2.5 text-sm text-text-primary',
                    'placeholder:text-text-tertiary resize-none outline-none',
                    'border border-transparent focus:border-accent/30',
                    'transition-colors max-h-24'
                  )}
                  style={{ minHeight: '40px' }}
                  disabled={isStreaming}
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className={cn(
                  'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200',
                  input.trim() && !isStreaming
                    ? 'bg-accent text-white hover:bg-accent-bright active:scale-90 cursor-pointer'
                    : 'bg-surface-tertiary text-text-tertiary cursor-not-allowed'
                )}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
