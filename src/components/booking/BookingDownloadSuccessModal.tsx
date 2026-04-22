'use client';

import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  title?: string;
  message: string;
  children?: ReactNode;
  onClose: () => void;
  onDownload: () => void | Promise<void>;
  downloadLabel?: string;
  doneLabel?: string;
};

/**
 * Efex-style success dialog: copy, actions (download PDF, done). Rendered in a portal above the drawer.
 */
export function BookingDownloadSuccessModal({
  open,
  title = 'Booking successful',
  message,
  children,
  onClose,
  onDownload,
  downloadLabel = 'Download PDF ticket',
  doneLabel = 'Done'
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onClose();
    },
    [open, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted || typeof document === 'undefined') {
    return null;
  }

  const onOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div
      className="padler-booking-success-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="padler-booking-success-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200000,
        display: 'grid',
        placeItems: 'center',
        padding: 16
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(2px)'
        }}
        aria-hidden
        onClick={onOverlayClick}
      />
      <div
        onClick={(e: MouseEvent) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          maxHeight: 'min(90vh, 560px)',
          overflow: 'auto',
          borderRadius: 10,
          border: '1px solid var(--padler-border, #e2e8f0)',
          background: '#fff',
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.2)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            borderBottom: '1px solid var(--padler-border, #e2e8f0)',
            padding: '14px 16px'
          }}
        >
          <h2 id="padler-booking-success-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            {title}
          </h2>
          <button
            type="button"
            className="padler-icon-btn"
            onClick={onClose}
            aria-label="Close"
            style={{ flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '16px 20px 20px' }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--padler-ink, #0f172a)' }}>{message}</p>
          {children}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className="padler-action"
              disabled={downloading}
              onClick={() => {
                setDownloading(true);
                Promise.resolve(onDownload())
                  .catch(() => {})
                  .finally(() => setDownloading(false));
              }}
            >
              {downloading ? 'Preparing…' : downloadLabel}
            </button>
            <button type="button" className="padler-action padler-action--primary" onClick={onClose}>
              {doneLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
