'use client';

import { Button } from '@/components/ui/button';

type Props = {
  page: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  sortLabel?: string;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function TripJotterListPager({
  page,
  totalPages,
  totalElements,
  pageSize,
  sortLabel,
  loading,
  onPrev,
  onNext
}: Props) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
      <div className="text-sm text-slate-500">
        {totalElements.toLocaleString()} total
        {totalPages > 0 ? ` · Page ${page + 1} of ${totalPages}` : ''}
        <span className="ml-2">({pageSize} per page)</span>
        {sortLabel ? <span className="ml-2">· Sorted {sortLabel}</span> : null}
      </div>
      <div className="flex gap-2">
        <Button type="button" disabled={loading || page <= 0} onClick={onPrev}>
          Previous
        </Button>
        <Button
          type="button"
          disabled={loading || totalPages <= 0 || page >= totalPages - 1}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
