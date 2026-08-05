'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type OnboardingDocumentPreviewProps = {
  url: string;
  label?: string;
  present?: boolean;
};

function pathWithoutQuery(url: string): string {
  return url.split('?')[0].toLowerCase();
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(pathWithoutQuery(url));
}

function isPdfUrl(url: string): boolean {
  const path = pathWithoutQuery(url);
  if (path.endsWith('.pdf')) return true;
  if (/\/(?:image|raw|auto)\/upload\//.test(path) && path.includes('.pdf')) return true;
  return false;
}

/**
 * Cloudinary can render PDF page 1 as a JPG via transformation.
 * Browsers often leave bare PDF iframes blank (X-Frame / PDF plugin quirks).
 */
function cloudinaryPdfPageImageUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('res.cloudinary.com')) {
      return null;
    }
    const path = parsed.pathname;
    if (!/\.pdf$/i.test(pathWithoutQuery(path))) {
      return null;
    }
    if (/\/upload\/(?:[^/]+,)*pg_\d+/.test(path) || /\/upload\/f_jpg/.test(path)) {
      return url;
    }
    if (path.includes('/image/upload/')) {
      parsed.pathname = path.replace('/image/upload/', '/image/upload/f_jpg,pg_1,w_960,q_auto/');
      return parsed.toString();
    }
    if (path.includes('/raw/upload/')) {
      parsed.pathname = path.replace('/raw/upload/', '/image/upload/f_jpg,pg_1,w_960,q_auto/');
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function OnboardingDocumentPreview({
  url,
  label,
  present
}: OnboardingDocumentPreviewProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const hasUrl = Boolean(url?.trim());
  const isPresent = present ?? hasUrl;

  const kind = useMemo(() => {
    if (!hasUrl) return 'empty' as const;
    if (isImageUrl(url)) return 'image' as const;
    if (isPdfUrl(url)) return 'pdf' as const;
    return 'other' as const;
  }, [hasUrl, url]);

  const pdfThumbUrl = useMemo(
    () => (kind === 'pdf' ? cloudinaryPdfPageImageUrl(url) : null),
    [kind, url]
  );

  useEffect(() => {
    setThumbFailed(false);
  }, [url]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  const title = label?.trim() || 'Document';
  const showPdfThumb = kind === 'pdf' && pdfThumbUrl && !thumbFailed;

  return (
    <>
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-slate-900">{title}</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              {kind === 'pdf' ? 'PDF' : kind === 'image' ? 'Image' : kind === 'other' ? 'File' : 'No file'}
            </p>
          </div>
          <Badge tone={isPresent ? 'success' : 'warning'}>{isPresent ? 'Present' : 'Missing'}</Badge>
        </div>

        <div
          className={cn(
            'relative grid aspect-[4/3] place-items-center overflow-hidden bg-slate-50',
            !hasUrl && 'bg-slate-100'
          )}
        >
          {kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={title}
              className="max-h-full max-w-full object-contain p-3"
            />
          ) : showPdfThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pdfThumbUrl}
              alt={`${title} preview`}
              className="max-h-full max-w-full object-contain p-3"
              onError={() => setThumbFailed(true)}
            />
          ) : kind === 'pdf' ? (
            <object
              data={url}
              type="application/pdf"
              title={title}
              className="h-full w-full"
            >
              <div className="grid h-full place-items-center p-4 text-center">
                <div>
                  <p className="text-sm text-slate-500">PDF preview unavailable in this browser.</p>
                  <a
                    href={url}
                    className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open PDF
                  </a>
                </div>
              </div>
            </object>
          ) : kind === 'other' ? (
            <div className="p-4 text-center">
              <p className="text-sm text-slate-500">Preview not available for this file type.</p>
              <a
                href={url}
                className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Open in new tab
              </a>
            </div>
          ) : (
            <p className="px-4 text-center text-sm text-slate-500">No file URL on this document.</p>
          )}
        </div>

        <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 px-3 py-2.5">
          <Button
            type="button"
            size="sm"
            disabled={!hasUrl || kind === 'other' || kind === 'empty'}
            onClick={() => setFullscreen(true)}
          >
            Full screen
          </Button>
          {hasUrl ? (
            <Button asChild size="sm">
              <a href={url} target="_blank" rel="noreferrer">
                Open link
              </a>
            </Button>
          ) : null}
        </div>
      </article>

      {fullscreen && hasUrl ? (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-slate-950/90 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} full screen`}
        >
          <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
            <strong className="truncate text-sm font-semibold">{title}</strong>
            <div className="flex shrink-0 gap-2">
              <Button asChild size="sm" variant="secondary">
                <a href={url} target="_blank" rel="noreferrer">
                  Open link
                </a>
              </Button>
              <Button type="button" size="sm" variant="primary" onClick={() => setFullscreen(false)}>
                Close
              </Button>
            </div>
          </header>
          <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-4">
            {kind === 'image' || showPdfThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={showPdfThumb ? pdfThumbUrl! : url}
                alt={title}
                className="max-h-full max-w-full object-contain"
                onError={() => setThumbFailed(true)}
              />
            ) : (
              <object
                data={url}
                type={kind === 'pdf' ? 'application/pdf' : undefined}
                title={title}
                className="h-full min-h-[70vh] w-full max-w-5xl rounded-xl bg-white"
              >
                <div className="grid h-full place-items-center">
                  <a href={url} className="text-sm font-medium text-blue-700 hover:underline" target="_blank" rel="noreferrer">
                    Open document
                  </a>
                </div>
              </object>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
