import type { AuditLogRecord } from '../platform/types.js';
import type { BohWorkspace, DashboardBranchSummary, DashboardDiscrepancy, DashboardFilters, DashboardLowStock, DashboardReport } from './types.js';

const now = () => new Date().toISOString();

export function buildDashboardReport(workspaces: BohWorkspace[], filters: DashboardFilters, audit: AuditLogRecord[] = []): DashboardReport {
  const branchIds = [...new Set(filters.branchIds)];
  const scoped = workspaces.flatMap((workspace) => workspace.stockBalances.filter((balance) => balance.locationKind === 'BRANCH' && (!balance.branchId || branchIds.includes(balance.branchId))));
  const ledgers = workspaces.flatMap((workspace) => workspace.ledger.filter((entry) => scoped.some((balance) => balance.locationId === entry.locationId && balance.ingredientId === entry.ingredientId)));
  const ledgerByKey = new Map<string, number>();
  ledgers.forEach((entry) => ledgerByKey.set(`${entry.locationId}:${entry.ingredientId}`, (ledgerByKey.get(`${entry.locationId}:${entry.ingredientId}`) ?? 0) + entry.quantityDelta));
  const lowStock: DashboardLowStock[] = scoped.flatMap((balance) => balance.quantity <= (balance.reorderPoint ?? 0) ? [{ locationId: balance.locationId, ingredientId: balance.ingredientId, quantity: balance.quantity, reorderPoint: balance.reorderPoint ?? 0, unit: balance.unit, status: balance.quantity <= 0 ? 'OUT' as const : 'LOW' as const }] : []);

  const discrepancies: DashboardDiscrepancy[] = scoped.map((balance) => {
    const ledgerQuantity = ledgerByKey.get(`${balance.locationId}:${balance.ingredientId}`) ?? 0;
    const varianceQuantity = Number((balance.quantity - ledgerQuantity).toFixed(6));

    return { locationId: balance.locationId, ingredientId: balance.ingredientId, projectedQuantity: balance.quantity, ledgerQuantity, varianceQuantity, unit: balance.unit, status: varianceQuantity === 0 ? 'MATCHED' : 'MISMATCH' };
  });

  const allWastage = workspaces.flatMap((workspace) => workspace.wastage);
  const wastageMap = new Map<string, { value: number; sourceCount: number }>();
  allWastage.forEach((record) => {
    const key = filters.groupBy === 'branch' ? record.branchId : record.ingredientId;
    const current = wastageMap.get(key) ?? { value: 0, sourceCount: 0 };
    current.value += record.value;
    current.sourceCount += 1;
    wastageMap.set(key, current);
  });
  const incompleteTheoryCount = workspaces.flatMap((workspace) => workspace.dailyCounts).reduce((count, item) => count + item.lines.filter((line) => line.theoreticalSoldStatus !== 'AVAILABLE').length, 0);

  const sourceDates = workspaces.flatMap((workspace) => [
    ...workspace.stockBalances.map((balance) => balance.updatedAt),
    ...workspace.purchaseOrders.map((order) => order.updatedAt),
    ...workspace.stockRequests.map((request) => request.updatedAt),
    ...workspace.dailyCounts.map((count) => count.createdAt),
    ...workspace.wastage.map((record) => record.createdAt),
    ...workspace.ledger.map((entry) => entry.createdAt)
  ]).reduce<number[]>((dates, value) => {
    const parsed = Date.parse(value);

    if (Number.isFinite(parsed)) dates.push(parsed);

    return dates;
  }, []);

  const sourceUpdatedAt = sourceDates.length ? new Date(Math.max(...sourceDates)).toISOString() : null;

  const freshness = sourceUpdatedAt && Date.now() - Date.parse(sourceUpdatedAt) <= 5 * 60_000 ? 'FRESH' as const : 'STALE' as const;

  const branchSummaries: DashboardBranchSummary[] = branchIds.map((branchId) => {
    const branchBalances = scoped.filter((balance) => balance.branchId === branchId);
    const branchWorkspaces = workspaces.filter((workspace) => workspace.purchaseOrders.some((order) => order.branchId === branchId) || workspace.dailyCounts.some((count) => count.branchId === branchId) || workspace.wastage.some((record) => record.branchId === branchId) || branchBalances.some((balance) => balance.branchId === branchId));
    const branchLowStock = branchBalances.filter((balance) => balance.quantity <= (balance.reorderPoint ?? 0)).length;
    const branchOrders = branchWorkspaces.flatMap((workspace) => workspace.purchaseOrders).filter((order) => order.branchId === branchId);
    const branchRequests = branchWorkspaces.flatMap((workspace) => workspace.stockRequests).filter((request) => request.toLocationId.includes(branchId));
    const branchTheory = branchWorkspaces.flatMap((workspace) => workspace.dailyCounts).filter((count) => count.branchId === branchId).reduce((count, item) => count + item.lines.filter((line) => line.theoreticalSoldStatus !== 'AVAILABLE').length, 0);

    return { branchId, lowStockCount: branchLowStock, openPurchaseOrders: branchOrders.filter((order) => ['DRAFT', 'SENT', 'PARTIALLY_RECEIVED'].includes(order.status)).length, pendingStockRequests: branchRequests.filter((request) => ['REQUESTED', 'APPROVED', 'IN_TRANSIT'].includes(request.status)).length, incompleteTheoryCount: branchTheory, sourceCount: branchBalances.length };
  });

  const asOf = now();

  return {
    asOf,
    sourceUpdatedAt,
    freshness,
    branchIds,
    branchSummaries,
    summary: {
      stockValue: { value: 0, unit: 'NOT_AVAILABLE', sourceCount: 0 },
      lowStockCount: { value: lowStock.length, unit: 'COUNT', sourceCount: lowStock.length },
      openPurchaseOrders: { value: workspaces.flatMap((workspace) => workspace.purchaseOrders).filter((order) => ['DRAFT', 'SENT', 'PARTIALLY_RECEIVED'].includes(order.status)).length, unit: 'COUNT', sourceCount: workspaces.flatMap((workspace) => workspace.purchaseOrders).length },
      pendingStockRequests: { value: workspaces.flatMap((workspace) => workspace.stockRequests).filter((request) => ['REQUESTED', 'APPROVED', 'IN_TRANSIT'].includes(request.status)).length, unit: 'COUNT', sourceCount: workspaces.flatMap((workspace) => workspace.stockRequests).length },
      varianceValue: { value: discrepancies.filter((item) => item.status === 'MISMATCH').reduce((total, item) => total + Math.abs(item.varianceQuantity), 0), unit: 'STOCK_UNITS', sourceCount: discrepancies.length },
      wastageValue: { value: allWastage.reduce((total, item) => total + item.value, 0), unit: 'VND', sourceCount: allWastage.length },
      incompleteTheoryCount: { value: incompleteTheoryCount, unit: 'COUNT', sourceCount: incompleteTheoryCount }
    },
    lowStock,
    discrepancies,
    wastageBreakdown: [...wastageMap.entries()].map(([key, value]) => ({ key, ...value })),
    audit: audit.map((entry) => ({ id: entry.id, branchId: entry.branchId, actorId: entry.actorId, action: entry.action, entityType: entry.entityType, entityId: entry.entityId, requestId: entry.requestId, reason: entry.reason, occurredAt: entry.occurredAt }))
  };
}
