'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import {
  createOnboardingUploadLink,
  performOnboardingAction
} from '@/lib/api';
import type { OnboardingJourney, OnboardingStep } from '@/lib/types';
import {
  OnboardingRequestInfoModal,
  type OnboardingRequestInfoMode
} from '@/components/crm/OnboardingRequestInfoModal';
import { OnboardingDocumentPreview } from '@/components/crm/OnboardingDocumentPreview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatDateTime } from '@/lib/utils';
import { productDisplayLabel } from '@/lib/product-labels';


function lifecycleTone(status?: string): 'success' | 'danger' | 'warning' | 'neutral' | 'info' {
  const s = (status ?? '').toUpperCase();
  if (s === 'COMPLETE' || s === 'DONE' || s === 'APPROVED' || s === 'SUCCESS') return 'success';
  if (s === 'REJECTED' || s === 'FAILED' || s === 'ERROR') return 'danger';
  if (s === 'NEEDS_DOCS' || s === 'PENDING_REVIEW' || s === 'IN_PROGRESS') return 'warning';
  return 'neutral';
}

function boolTone(value: boolean | null | undefined, falseTone: 'danger' | 'warning' = 'danger') {
  if (value === true) return 'success' as const;
  if (value === false) return falseTone;
  return 'neutral' as const;
}

function productLabel(productKey?: string | null): string {
  return productDisplayLabel(productKey);
}

const PROFILE_FIELD_LABELS: Record<string, string> = {
  FIRST_NAME: 'First name',
  LAST_NAME: 'Last name',
  PHONE_NUMBER: 'Phone number',
  BUSINESS_NAME: 'Business name',
  DIRECTOR_FIRST_NAME: 'Director first name',
  DIRECTOR_LAST_NAME: 'Director last name',
  DIRECTOR_EMAIL: 'Director email',
  DIRECTOR_NIN: 'Director NIN',
  DIRECTOR_BVN: 'Director BVN'
};

function profileFieldLabel(key: string): string {
  return PROFILE_FIELD_LABELS[key.trim().toUpperCase()] ?? key;
}

function stepState(step: OnboardingStep, currentStep?: string) {
  const status = (step.status ?? '').toUpperCase();
  const key = step.key ?? step.label ?? '';
  if (['COMPLETE', 'DONE', 'APPROVED', 'SUCCESS'].includes(status)) return 'done' as const;
  if (['REJECTED', 'FAILED', 'ERROR'].includes(status)) return 'error' as const;
  if (
    currentStep &&
    (key === currentStep || step.label === currentStep || status === 'IN_PROGRESS' || status === 'CURRENT')
  ) {
    return 'current' as const;
  }
  if (['NEEDS_DOCS', 'PENDING_REVIEW', 'PENDING'].includes(status)) return 'current' as const;
  return 'todo' as const;
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function Section({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

type OnboardingJourneyDetailProps = {
  journey: OnboardingJourney;
  onUpdated?: (next: OnboardingJourney) => void;
  /** @deprecated Prefer variant="compact" */
  compact?: boolean;
  variant?: 'panel' | 'drawer' | 'compact';
  onFooterActionsChange?: (actions: ReactNode | null) => void;
};

export function OnboardingJourneyDetail({
  journey,
  onUpdated,
  compact = false,
  variant,
  onFooterActionsChange
}: OnboardingJourneyDetailProps) {
  const layout = variant ?? (compact ? 'compact' : 'panel');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [requestModal, setRequestModal] = useState<OnboardingRequestInfoMode | null>(null);

  const productKey = journey.productKey ?? '';
  const customerUserId = journey.customerUserId ?? '';
  const allowed = new Set((journey.actionsAllowed ?? []).map((a) => a.toUpperCase()));
  const isOrg = journey.identityProfileKind?.toUpperCase() === 'ORGANIZATION';

  const runAction = async (
    action: string,
    body?: {
      reason?: string;
      requestedDocumentTypes?: string[];
      requestedProfileFields?: string[];
    }
  ) => {
    if (!productKey || !customerUserId) return;
    setBusy(true);
    setError(null);
    try {
      const next =
        action === 'CREATE_UPLOAD_LINK'
          ? await createOnboardingUploadLink(productKey, customerUserId, body)
          : await performOnboardingAction(productKey, customerUserId, action, body);
      onUpdated?.(next);
      setRequestModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const onApprove = () => void runAction('APPROVE');
  const onReject = () => {
    const reason = window.prompt('Rejection reason (required):')?.trim();
    if (!reason) return;
    void runAction('REJECT', { reason });
  };
  const onAllowResubmit = () => void runAction('ALLOW_RESUBMIT');
  const onRetryIdentity = () => void runAction('RETRY_IDENTITY_VERIFY');

  const copyUploadUrl = async () => {
    const url = journey.customerUploadUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Unable to copy link');
    }
  };

  const mailtoHref = useMemo(() => {
    const url = journey.customerUploadUrl;
    if (!url) return null;
    const to = journey.email?.trim() ? encodeURIComponent(journey.email.trim()) : '';
    const subject = encodeURIComponent(`Document upload — ${productLabel(journey.productKey)}`);
    const body = encodeURIComponent(
      `Please upload the requested documents using this link:\n\n${url}\n`
    );
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [journey.customerUploadUrl, journey.email, journey.productKey]);

  const contactMailto = journey.email?.trim()
    ? `mailto:${encodeURIComponent(journey.email.trim())}`
    : null;
  const telHref = journey.phoneNumber?.trim()
    ? `tel:${journey.phoneNumber.trim().replace(/\s+/g, '')}`
    : null;

  const actionButtons = (
    <div className="flex flex-wrap gap-2">
      {allowed.has('APPROVE') ? (
        <Button type="button" variant="primary" disabled={busy} onClick={onApprove}>
          Approve
        </Button>
      ) : null}
      {allowed.has('REJECT') ? (
        <Button type="button" disabled={busy} onClick={onReject}>
          Reject
        </Button>
      ) : null}
      {allowed.has('REQUEST_INFO') ? (
        <Button type="button" disabled={busy} onClick={() => setRequestModal('REQUEST_INFO')}>
          Request info
        </Button>
      ) : null}
      {allowed.has('ALLOW_RESUBMIT') ? (
        <Button type="button" disabled={busy} onClick={onAllowResubmit}>
          Allow resubmit
        </Button>
      ) : null}
      {allowed.has('CREATE_UPLOAD_LINK') ? (
        <Button type="button" disabled={busy} onClick={() => setRequestModal('CREATE_UPLOAD_LINK')}>
          Create upload link
        </Button>
      ) : null}
      {allowed.has('RETRY_IDENTITY_VERIFY') ? (
        <Button type="button" disabled={busy} onClick={onRetryIdentity}>
          Retry NIN &amp; BVN verify
        </Button>
      ) : null}
    </div>
  );

  const hasActions = (journey.actionsAllowed ?? []).length > 0;

  useEffect(() => {
    if (!onFooterActionsChange) return;
    if (layout === 'drawer' && hasActions) {
      onFooterActionsChange(actionButtons);
    } else {
      onFooterActionsChange(null);
    }
    return () => onFooterActionsChange(null);
    // actionButtons identity changes every render; intentional to refresh footer labels/busy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, hasActions, busy, journey.actionsAllowed, copied, requestModal]);

  const steps = journey.steps ?? [];
  const documents = journey.documents ?? [];

  return (
    <div className={cn('space-y-4', layout === 'panel' && 'rounded-2xl border border-slate-200 bg-slate-50/40 p-4')}>
      {layout !== 'drawer' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              {journey.partyLabel || journey.customerUserId || 'Journey'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">{productLabel(journey.productKey)}</p>
          </div>
          <Badge tone={lifecycleTone(journey.lifecycleStatus)}>
            {(journey.lifecycleStatus ?? '—').replaceAll('_', ' ')}
          </Badge>
        </div>
      ) : null}

      {journey.errorMessage ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
          {journey.errorMessage}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      <Section title="Progress" description="Where this verification is in the journey.">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone={lifecycleTone(journey.lifecycleStatus)}>
            {(journey.lifecycleStatus ?? '—').replaceAll('_', ' ')}
          </Badge>
          {journey.currentStep ? (
            <span className="text-sm text-slate-500">
              Current step: <strong className="text-slate-800">{journey.currentStep}</strong>
            </span>
          ) : null}
        </div>
        {steps.length > 0 ? (
          <ol className="space-y-0">
            {steps.map((step, index) => {
              const state = stepState(step, journey.currentStep);
              return (
                <li key={step.key ?? step.label ?? index} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < steps.length - 1 ? (
                    <span
                      className="absolute left-[15px] top-8 h-[calc(100%-20px)] w-px bg-slate-200"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={cn(
                      'relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold',
                      state === 'done' && 'bg-emerald-100 text-emerald-800',
                      state === 'current' && 'bg-blue-100 text-blue-800 ring-4 ring-blue-50',
                      state === 'error' && 'bg-red-100 text-red-800',
                      state === 'todo' && 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {state === 'done' ? '✓' : index + 1}
                  </span>
                  <div className="min-w-0 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-slate-900">{step.label ?? step.key ?? 'Step'}</strong>
                      <Badge tone={lifecycleTone(step.status)}>
                        {(step.status ?? '—').replaceAll('_', ' ')}
                      </Badge>
                    </div>
                    {step.key && step.label !== step.key ? (
                      <p className="mt-1 text-xs text-slate-400">
                        <code>{step.key}</code>
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">No step list returned for this journey.</p>
        )}
      </Section>

      <Section title="Customer & contact">
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailItem label="Product">
            {productLabel(journey.productKey)}
            {journey.sourceSystem ? (
              <span className="text-slate-500"> · {journey.sourceSystem}</span>
            ) : null}
          </DetailItem>
          <DetailItem label="Profile kind">
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              {journey.identityProfileKind ?? '—'}
            </code>
          </DetailItem>
          <DetailItem label="Customer">
            {customerUserId ? (
              <Link
                href={`/customers/${encodeURIComponent(customerUserId)}`}
                className="font-medium text-blue-700 hover:underline"
              >
                {customerUserId}
              </Link>
            ) : (
              '—'
            )}
          </DetailItem>
          {journey.businessName ? (
            <DetailItem label="Business name">{journey.businessName}</DetailItem>
          ) : null}
          {(journey.firstName || journey.lastName) && (
            <DetailItem label={isOrg ? 'Director name' : 'Name'}>
              {[journey.firstName, journey.lastName].filter(Boolean).join(' ') || '—'}
            </DetailItem>
          )}
          {journey.email ? (
            <DetailItem label="Email">
              {contactMailto ? (
                <a href={contactMailto} className="font-medium text-blue-700 hover:underline">
                  {journey.email}
                </a>
              ) : (
                journey.email
              )}
            </DetailItem>
          ) : null}
          {isOrg && journey.directorEmail ? (
            <DetailItem label="Director email">
              <a
                href={`mailto:${encodeURIComponent(journey.directorEmail.trim())}`}
                className="font-medium text-blue-700 hover:underline"
              >
                {journey.directorEmail}
              </a>
            </DetailItem>
          ) : null}
          {journey.phoneNumber ? (
            <DetailItem label="Phone">
              {telHref ? (
                <a href={telHref} className="font-medium text-blue-700 hover:underline">
                  {journey.phoneNumber}
                </a>
              ) : (
                journey.phoneNumber
              )}
            </DetailItem>
          ) : null}
          {journey.travellerCode ? (
            <DetailItem label="Traveller code">
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{journey.travellerCode}</code>
            </DetailItem>
          ) : null}
        </dl>
      </Section>

      <Section title="Identity & account" description="Verification checks and wallet state.">
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailItem label="Wallet">
            <Badge tone={boolTone(journey.walletCreated, 'warning')}>
              {journey.walletCreated === true
                ? 'Created'
                : journey.walletCreated === false
                  ? 'Not created'
                  : 'Unknown'}
            </Badge>
          </DetailItem>
          <DetailItem label="NIN verified">
            <Badge tone={boolTone(journey.ninVerified)}>
              {journey.ninVerified === true
                ? 'Verified'
                : journey.ninVerified === false
                  ? 'Not verified'
                  : 'Unknown'}
            </Badge>
          </DetailItem>
          <DetailItem label="BVN verified">
            <Badge tone={boolTone(journey.bvnVerified)}>
              {journey.bvnVerified === true
                ? 'Verified'
                : journey.bvnVerified === false
                  ? 'Not verified'
                  : 'Unknown'}
            </Badge>
          </DetailItem>
          {isOrg && journey.directorNin ? (
            <DetailItem label="Director NIN">
              <code className="text-xs text-slate-600">{journey.directorNin}</code>
            </DetailItem>
          ) : null}
          {isOrg && journey.directorBvn ? (
            <DetailItem label="Director BVN">
              <code className="text-xs text-slate-600">{journey.directorBvn}</code>
            </DetailItem>
          ) : null}
        </dl>
      </Section>

      {(documents.length > 0 ||
        (journey.requestedDocumentTypes ?? []).length > 0 ||
        (journey.requestedProfileFields ?? []).length > 0 ||
        journey.customerUploadUrl) && (
        <Section title="Documents & requests">
          {documents.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {documents.map((doc) => (
                <OnboardingDocumentPreview
                  key={doc.type ?? doc.label}
                  url={doc.url ?? ''}
                  label={doc.label ?? doc.type ?? 'Document'}
                  present={doc.present}
                />
              ))}
            </div>
          ) : null}

          {(journey.requestedDocumentTypes ?? []).length > 0 ? (
            <div className={cn(documents.length > 0 && 'mt-4')}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                Requested documents
              </p>
              <div className="flex flex-wrap gap-2">
                {(journey.requestedDocumentTypes ?? []).map((t) => (
                  <Badge key={t} tone="info">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {(journey.requestedProfileFields ?? []).length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                Requested profile fields
              </p>
              <ul className="space-y-1 text-sm text-slate-700">
                {(journey.requestedProfileFields ?? []).map((t) => (
                  <li key={t}>
                    {profileFieldLabel(t)}{' '}
                    <code className="text-xs text-slate-400">{t}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {journey.customerUploadUrl ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Customer upload link</p>
              <p className="mt-2 break-all text-xs text-slate-600">{journey.customerUploadUrl}</p>
              {journey.uploadLinkExpiresAt ? (
                <p className="mt-1 text-xs text-slate-500">
                  Expires {formatDateTime(journey.uploadLinkExpiresAt)}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => void copyUploadUrl()}>
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
                {mailtoHref ? (
                  <Button asChild size="sm">
                    <a href={mailtoHref}>Email link</a>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </Section>
      )}

      {(journey.dealerId != null ||
        journey.companyId ||
        journey.completedAt ||
        journey.rejectionReason ||
        journey.productDeepLink) && (
        <Section title="References">
          <dl className="grid gap-4 sm:grid-cols-2">
            {journey.dealerId != null ? (
              <DetailItem label="Dealer id">{journey.dealerId}</DetailItem>
            ) : null}
            {journey.companyId ? (
              <DetailItem label="Company id">
                <code className="text-xs">{journey.companyId}</code>
              </DetailItem>
            ) : null}
            {journey.completedAt ? (
              <DetailItem label="Completed">{formatDateTime(journey.completedAt)}</DetailItem>
            ) : null}
            {journey.rejectionReason ? (
              <DetailItem label="Rejection">{journey.rejectionReason}</DetailItem>
            ) : null}
            {journey.productDeepLink ? (
              <DetailItem label="Product link">
                <a
                  href={journey.productDeepLink}
                  className="font-medium text-blue-700 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in product
                </a>
              </DetailItem>
            ) : null}
          </dl>
        </Section>
      )}

      {layout !== 'drawer' && hasActions ? <div className="pt-1">{actionButtons}</div> : null}

      <OnboardingRequestInfoModal
        open={requestModal != null}
        mode={requestModal ?? 'REQUEST_INFO'}
        productKey={productKey}
        identityProfileKind={journey.identityProfileKind}
        defaultDocumentTypes={journey.requestedDocumentTypes}
        defaultProfileFields={journey.requestedProfileFields}
        busy={busy}
        onClose={() => setRequestModal(null)}
        onSubmit={({ reason, requestedDocumentTypes, requestedProfileFields }) => {
          if (!requestModal) return;
          void runAction(requestModal, {
            reason,
            requestedDocumentTypes,
            requestedProfileFields
          });
        }}
      />
    </div>
  );
}
