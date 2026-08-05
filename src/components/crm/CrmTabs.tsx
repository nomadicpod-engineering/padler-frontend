'use client';

export type CrmTabItem = {
  id: string;
  label: string;
  count?: number;
};

type CrmTabsProps = {
  tabs: CrmTabItem[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
};

export function CrmTabs({ tabs, active, onChange, ariaLabel = 'Sections' }: CrmTabsProps) {
  return (
    <div className="padler-crm-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`padler-crm-tab${selected ? ' is-active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {tab.count != null ? <span className="padler-crm-tab__count">{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
