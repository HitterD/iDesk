import api from '../../../lib/api';
import type { RequestStatus } from '../types';

export type DashboardFilters = {
  from?: string;
  to?: string;
};

export async function fetchKpi(filters?: DashboardFilters) {
  const query = new URLSearchParams(filters as any);
  const { data } = await api.get(`/hardware-requests/dashboard/kpi?${query}`);
  return data.data;
}

export async function fetchStatusDistribution(filters?: DashboardFilters) {
  const query = new URLSearchParams(filters as any);
  const { data } = await api.get(`/hardware-requests/dashboard/status-distribution?${query}`);
  return data.data;
}

export async function fetchAgingBuckets() {
  const { data } = await api.get('/hardware-requests/dashboard/aging');
  return data.data;
}

export async function fetchTopCategories(filters?: DashboardFilters) {
  const query = new URLSearchParams(filters as any);
  const { data } = await api.get(`/hardware-requests/dashboard/top-categories?${query}`);
  return data.data;
}

export async function fetchWeeklySchedule() {
  const { data } = await api.get('/hardware-requests/dashboard/weekly-schedule');
  return data.data;
}

export async function fetchTechnicianWorkload() {
  const { data } = await api.get('/hardware-requests/dashboard/technician-workload');
  return data.data;
}
