'use client';

import { ListSearch } from '@/components/ui/page';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hint?: string;
};

/** Shared search field for list pages across all Tools products. */
export function ToolsListSearch({ value, onChange, placeholder, hint }: Props) {
  return (
    <ListSearch value={value} onChange={onChange} placeholder={placeholder} hint={hint} />
  );
}
