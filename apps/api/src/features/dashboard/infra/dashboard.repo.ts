import { listRecentHazards } from '../../hazards/infra/hazard.repo';
import { listStructures } from '../../structures/infra/structure.repo';
import { listRecentAlerts } from '../../alerts/infra/alert.repo';

export interface DashboardSummary {
  totalStructures: number;
  totalHazards: number;
  totalAlerts: number;
  highRiskAlerts: number;
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
  const [structures, hazards, alerts] = await Promise.all([
    listStructures(),
    listRecentHazards(12),
    listRecentAlerts(10),
  ]);

  const highRiskAlerts = alerts.filter((alert) => Number(alert.riskScore) >= 1.0).length;
  const deliveryCoverage = alerts.reduce((sum, alert) => sum + Number(alert.totalSubscribers ?? 0), 0);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalStructures: structures.length,
      totalHazards: hazards.length,
      totalAlerts: alerts.length,
      highRiskAlerts,
      deliveryCoverage,
    },
    structures,
    hazards,
    alerts,
  };
}