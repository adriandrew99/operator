'use client';

import { cn } from '@/lib/utils/cn';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  // Close modal + restore scroll on route change to prevent body overflow lock
  // Only fires when pathname actually changes, NOT on initial mount
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      if (open) {
        onClose();
        document.body.style.overflow = '';
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={cn(
          'relative z-10 w-full max-w-lg bg-surface-elevated border border-border overflow-hidden',
          'rounded-t-2xl sm:rounded-2xl animate-slide-up max-h-[90vh] sm:max-h-[85vh] overflow-y-auto shadow-[var(--card-shadow-lg)]',
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
            <h2 className="text-section-heading text-text-primary">{title}</h2>
            <button
              onClick={onClose}
              className="text-text-tertiary hover:text-text-primary transition-all p-2 -mr-1 rounded-lg hover:bg-surface-tertiary"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
