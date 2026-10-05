import { countHazards, listRecentHazards } from '../../hazards/infra/hazard.repo';
import { listStructures } from '../../structures/infra/structure.repo';
import { countAlerts, countCriticalAlerts, listRecentAlerts } from '../../alerts/infra/alert.repo';

export interface DashboardSummary {
  totalStructures: number;
  totalHazards: number;
  totalAlerts: number;
  highRiskAlerts: number;
  criticalAlerts: number;
  deliveryCoverage: number;
}

export interface DashboardSnapshot {
  generatedAt: string;
  summary: DashboardSummary;
  structures: Awaited<ReturnType<typeof listStructures>>;
  hazards: Awaited<ReturnType<typeof listRecentHazards>>;
  alerts: Awaited<ReturnType<typeof listRecentAlerts>>;
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [structures, hazardCount, hazards, alerts, alertCount, criticalCount] = await Promise.all([
    listStructures(),
    countHazards(),
    listRecentHazards(12),
    listRecentAlerts(10),
    countAlerts(),
    countCriticalAlerts(),
  ]);

  const deliveryCoverage = alerts.reduce((sum, alert) => sum + Number(alert.totalSubscribers ?? 0), 0);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalStructures: structures.length,
      totalHazards: hazardCount,
      totalAlerts: alertCount,
      highRiskAlerts: alertCount,
      criticalAlerts: criticalCount,
      deliveryCoverage,
    },
    structures,
    hazards,
    alerts,
  };
}