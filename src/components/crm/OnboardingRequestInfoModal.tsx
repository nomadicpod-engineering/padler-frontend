'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

const DOC_TYPES_BY_PRODUCT: Record<string, string[]> = {
  classycar: ['GOVERNMENT_ID', 'UTILITY_BILL', 'INCORPORATION', 'CAC_STATUS_REPORT', 'INSURANCE'],
  capslocker: ['CAC', 'LOGO', 'UTILITY_BILL'],
  drift: ['CAC', 'UTILITY_BILL', 'GOVERNMENT_ID', 'LOGO'],
  'trip-jotter': ['CAC', 'UTILITY_BILL', 'GOVERNMENT_ID'],
  npod: ['NIN_SLIP', 'DRIVER_LICENSE']
};

const PROFILE_FIELDS_CUSTOMER = ['FIRST_NAME', 'LAST_NAME', 'PHONE_NUMBER'] as const;
const PROFILE_FIELDS_ORG = [
  'BUSINESS_NAME',
  'PHONE_NUMBER',
  'DIRECTOR_FIRST_NAME',
  'DIRECTOR_LAST_NAME',
  'DIRECTOR_EMAIL',
  'DIRECTOR_NIN',
  'DIRECTOR_BVN'
] as const;

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

function profileCatalogFor(productKey: string, identityProfileKind?: string): string[] {
  const kind = (identityProfileKind ?? '').trim().toUpperCase();
  if (kind === 'CUSTOMER') return [...PROFILE_FIELDS_CUSTOMER];
  if (kind === 'ORGANIZATION') return [...PROFILE_FIELDS_ORG];
  if (productKey === 'npod' || productKey === 'trip-jotter') return [...PROFILE_FIELDS_CUSTOMER];
  return [...PROFILE_FIELDS_ORG];
}

export type OnboardingRequestInfoMode = 'REQUEST_INFO' | 'CREATE_UPLOAD_LINK';

export type OnboardingRequestInfoPayload = {
  reason: string;
  requestedDocumentTypes: string[];
  requestedProfileFields: string[];
};

type OnboardingRequestInfoModalProps = {
  open: boolean;
  mode: OnboardingRequestInfoMode;
  productKey: string;
  identityProfileKind?: string;
  defaultDocumentTypes?: string[];
  defaultProfileFields?: string[];
  busy?: boolean;
  onClose: () => void;
  onSubmit: (payload: OnboardingRequestInfoPayload) => void;
};

export function OnboardingRequestInfoModal({
  open,
  mode,
  productKey,
  identityProfileKind,
  defaultDocumentTypes,
  defaultProfileFields,
  busy = false,
  onClose,
  onSubmit
}: OnboardingRequestInfoModalProps) {
  const catalog = useMemo(() => {
    const base = DOC_TYPES_BY_PRODUCT[productKey] ?? [
      'GOVERNMENT_ID',
      'UTILITY_BILL',
      'CAC',
      'NIN_SLIP'
    ];
    const extras = (defaultDocumentTypes ?? []).filter(
      (t) => !base.some((b) => b.toUpperCase() === t.toUpperCase())
    );
    return [...base, ...extras];
  }, [productKey, defaultDocumentTypes]);

  const profileCatalog = useMemo(
    () => profileCatalogFor(productKey, identityProfileKind),
    [productKey, identityProfileKind]
  );

  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [customType, setCustomType] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setError(null);
    setCustomType('');
    const initialDocs =
      defaultDocumentTypes && defaultDocumentTypes.length > 0
        ? defaultDocumentTypes.map((t) => t.toUpperCase())
        : [];
    setSelected(initialDocs);
    const initialFields =
      defaultProfileFields && defaultProfileFields.length > 0
        ? defaultProfileFields.map((t) => t.toUpperCase())
        : [];
    setSelectedFields(initialFields);
  }, [open, defaultDocumentTypes, defaultProfileFields, productKey]);

  if (!open) return null;

  const title =
    mode === 'REQUEST_INFO' ? 'Request information & documents' : 'Create customer upload link';
  const reasonRequired = mode === 'REQUEST_INFO';

  const toggleType = (type: string) => {
    const key = type.toUpperCase();
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  const toggleField = (field: string) => {
    const key = field.toUpperCase();
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  const addCustom = () => {
    const key = customType.trim().toUpperCase().replace(/\s+/g, '_');
    if (!key) return;
    setSelected((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setCustomType('');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (reasonRequired && !trimmed) {
      setError('Describe what the customer needs to provide.');
      return;
    }
    if (selected.length === 0 && selectedFields.length === 0) {
      setError('Select at least one document type or profile field.');
      return;
    }
    setError(null);
    onSubmit({
      reason: trimmed,
      requestedDocumentTypes: selected,
      requestedProfileFields: selectedFields
    });
  };

  return (
    <div className="padler-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="padler-drawer padler-drawer--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-request-info-title"
        onClick={(ev) => ev.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <header className="padler-drawer__header">
          <h2 id="onboarding-request-info-title">{title}</h2>
          <button type="button" className="padler-btn" onClick={onClose} disabled={busy}>
            Close
          </button>
        </header>
        <form onSubmit={submit} className="padler-drawer-body" style={{ display: 'grid', gap: 16 }}>
          <p className="padler-muted-copy" style={{ margin: 0 }}>
            {mode === 'REQUEST_INFO'
              ? 'Marks the KYB journey as needing information (where supported) and emails a customer link to correct selected details and/or upload documents.'
              : 'Mints a customer link for selected details and/or documents without changing KYB status.'}
          </p>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>{reasonRequired ? 'Message to customer (required)' : 'Note (optional)'}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="e.g. First name spelling does not match the ID. Please correct it."
              disabled={busy}
              required={reasonRequired}
            />
          </label>

          <fieldset style={{ border: '1px solid var(--padler-border, #ddd)', borderRadius: 8, padding: 12 }}>
            <legend>
              {identityProfileKind?.toUpperCase() === 'CUSTOMER' ||
              productKey === 'npod' ||
              productKey === 'trip-jotter'
                ? 'Profile details to correct'
                : 'Business & director details to correct'}
            </legend>
            <div style={{ display: 'grid', gap: 8 }}>
              {profileCatalog.map((field) => {
                const key = field.toUpperCase();
                return (
                  <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(key)}
                      onChange={() => toggleField(key)}
                      disabled={busy}
                    />
                    <span>
                      {PROFILE_FIELD_LABELS[key] ?? key} <code>{key}</code>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset style={{ border: '1px solid var(--padler-border, #ddd)', borderRadius: 8, padding: 12 }}>
            <legend>Documents needed</legend>
            <div style={{ display: 'grid', gap: 8 }}>
              {catalog.map((type) => {
                const key = type.toUpperCase();
                return (
                  <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selected.includes(key)}
                      onChange={() => toggleType(key)}
                      disabled={busy}
                    />
                    <code>{key}</code>
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Custom type e.g. TCC"
                disabled={busy}
                style={{ flex: 1 }}
              />
              <button type="button" className="padler-btn" onClick={addCustom} disabled={busy}>
                Add
              </button>
            </div>
          </fieldset>

          {error ? (
            <div className="padler-inline-alert" role="alert">
              {error}
            </div>
          ) : null}

          <div className="padler-btn-row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="padler-btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="padler-btn padler-btn--primary" disabled={busy}>
              {busy ? 'Submitting…' : mode === 'REQUEST_INFO' ? 'Send request' : 'Create link'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
