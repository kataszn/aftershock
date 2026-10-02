import type { DashboardSnapshot, ReplayResponse } from './types';

// In dev, VITE_API_BASE_URL is empty and requests go through the Vite proxy
// (same-origin). In production it points at the deployed API origin.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

function url(path: string): string {
  return `${API_BASE_URL}${path}`;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(url(path));
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function fetchDashboard(): Promise<DashboardSnapshot> {
  return getJson<DashboardSnapshot>('/api/dashboard');
}

export async function triggerReplay(key: string): Promise<ReplayResponse> {
  const res = await fetch(url(`/api/replay/${key}`), { method: 'POST' });
  return res.json() as Promise<ReplayResponse>;
}
