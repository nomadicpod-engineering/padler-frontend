import { toolsGet, type ToolsUsage } from './tools-shared';

export type { ToolsUsage, ToolsUsageStep } from './tools-shared';

export type NpodTravellerSearchResult = {
  userId: string;
  email?: string | null;
  travellerCode?: string | null;
  displayName?: string | null;
};

export async function fetchNpodHub(): Promise<Record<string, unknown>> {
  return toolsGet('/api/v1/admin/npod/hub', 'Unable to load NPod hub');
}

export async function fetchNpodStuckOps(): Promise<Record<string, unknown>> {
  return toolsGet('/api/v1/admin/npod/stuck', 'Unable to load NPod stuck ops');
}

export async function searchNpodTravellers(q: string): Promise<NpodTravellerSearchResult[]> {
  const params = new URLSearchParams({ q: q.trim() });
  return toolsGet(`/api/v1/admin/npod/travellers?${params}`, 'Unable to search travellers');
}

export async function fetchNpodTravellerUsage(userId: string): Promise<ToolsUsage> {
  return toolsGet(
    `/api/v1/admin/npod/travellers/${encodeURIComponent(userId.trim())}/usage`,
    'Unable to load traveller usage'
  );
}
