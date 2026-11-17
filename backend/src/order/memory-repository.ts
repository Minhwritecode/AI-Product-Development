import { randomUUID } from 'node:crypto';
import { assert, assertBranchScope, assertPermission } from '../platform/errors.js';
import type { Order, OrderRepository } from './types.js';
import { issueTableToken, verifyTableToken } from './table-token.js';

export function createMemoryOrderRepository(): OrderRepository {
  const orders = new Map<string, Order>();
  const replay = new Map<string, Order>();
  const menu = new Map([['item_chicken', { itemName: 'Gà nướng thảo mộc', unitPrice: 185000, currency: 'VND', stationCode: 'KITCHEN' as const, status: 'PUBLISHED' }], ['item_coffee', { itemName: 'Cà phê sữa', unitPrice: 55000, currency: 'VND', stationCode: 'BAR' as const, status: 'PUBLISHED' }]]);
  const requests = new Map<string, { id: string; branchId: string; serviceSessionId: string; status: 'SUBMITTED' | 'ACKNOWLEDGED' | 'REJECTED' | 'COMPLETED'; lines: import('./types.js').OrderLineInput[]; orderId?: string; createdAt: string }>();
  const table = { id: 'table_02', branchId: 'branch_central', label: 'T02', version: 1, serviceSessionId: 'service_demo' };
  const secret = 'luminex-local-development-secret';

  return {
    async createDraft(actor, input, key) {
      assertPermission(actor, 'queue:write'); assertBranchScope(actor, input.branchId); const prior = replay.get(key);

 if (prior) return prior;
      assert(input.lines.length > 0, 'VALIDATION_ERROR', 'At least one order line is required');

      const lines = input.lines.map((line) => {
        const item = menu.get(line.menuItemId);
        assert(item?.status === 'PUBLISHED', 'ITEM_UNAVAILABLE', 'Menu item is unavailable', 409);
        assert(line.quantity > 0, 'VALIDATION_ERROR', 'Quantity must be positive');

        return { ...line, itemName: item.itemName, unitPrice: item.unitPrice, currency: item.currency, stationCode: item.stationCode };
      });

      const order: Order = { id: `order_${randomUUID()}`, branchId: input.branchId, serviceSessionId: input.serviceSessionId, status: 'DRAFT', roundNumber: 1, coursePolicy: input.coursePolicy, lines };
      orders.set(order.id, order); replay.set(key, order);

 return order;
    },
    async updateDraft(actor, orderId, input, key) {
      assertPermission(actor, 'queue:write'); const prior = replay.get(key);

      if (prior) return prior;
      const order = orders.get(orderId); assert(order, 'NOT_FOUND', 'Order not found', 404); assertBranchScope(actor, order.branchId); assert(order.status === 'DRAFT', 'CONFLICT', 'Only draft orders can be changed', 409);
      assert(input.lines.length > 0, 'VALIDATION_ERROR', 'At least one order line is required');
      order.coursePolicy = input.coursePolicy;
      order.lines = input.lines.map((line) => {
        const item = menu.get(line.menuItemId); assert(item?.status === 'PUBLISHED', 'ITEM_UNAVAILABLE', 'Menu item is unavailable', 409); assert(Number.isInteger(line.quantity) && line.quantity > 0, 'VALIDATION_ERROR', 'Quantity must be a positive integer');

        return { ...line, modifierOptionIds: [...new Set(line.modifierOptionIds ?? [])], itemName: item.itemName, unitPrice: item.unitPrice, currency: item.currency, stationCode: item.stationCode };
      });
      replay.set(key, order);

      return order;
    },
    async send(actor, orderId, key) { assertPermission(actor, 'queue:write'); const prior = replay.get(key);

 if (prior) return prior; const order = orders.get(orderId); assert(order, 'NOT_FOUND', 'Order not found', 404); assertBranchScope(actor, order.branchId); assert(order.status === 'DRAFT', 'CONFLICT', 'Only draft orders can be sent', 409); order.status = 'SENT'; replay.set(key, order);

 return order; }
    ,
    async issueTableToken(actor, tableId) {
      assertPermission(actor, 'queue:write'); assertBranchScope(actor, table.branchId); assert(tableId === table.id, 'NOT_FOUND', 'Table not found', 404);
      const expiresAt = new Date(Date.now() + 8 * 60 * 60_000);

      return { token: issueTableToken({ tableId, branchId: table.branchId, version: table.version, expiresAt: expiresAt.getTime() }, secret), expiresAt: expiresAt.toISOString() };
    },
    async guestMenu(token) {
      const payload = verifyTableToken(token, secret);
      assert(payload.tableId === table.id && payload.branchId === table.branchId && payload.version === table.version, 'UNAUTHENTICATED', 'Table QR is invalid', 401);

      return { branchId: table.branchId, tableId: table.id, tableLabel: table.label, serviceSessionId: table.serviceSessionId, items: [...menu.entries()].map(([id, item]) => ({ id, name: item.itemName, description: '', price: item.unitPrice, currency: item.currency, allergenCodes: [], stationCode: item.stationCode })) };
    },
    async submitGuestRequest(token, lines) {
      const guest = await this.guestMenu(token); assert(lines.length > 0, 'VALIDATION_ERROR', 'At least one request line is required');
      const request = { id: `request_${randomUUID()}`, branchId: guest.branchId, serviceSessionId: guest.serviceSessionId, status: 'SUBMITTED' as const, lines, createdAt: new Date().toISOString() };
      requests.set(request.id, request);

 return request;
    },
    async listRequests(actor, branchId) { assertPermission(actor, 'queue:read'); assertBranchScope(actor, branchId);

 return [...requests.values()].filter((request) => request.branchId === branchId); },
    async commandRequest(actor, requestId, command, key, auditRequestId) {
      assertPermission(actor, 'queue:write');
      const request = requests.get(requestId);
      assert(request, 'NOT_FOUND', 'FOH request not found', 404);
      assertBranchScope(actor, request.branchId);
      assert(request.status === 'SUBMITTED' || command === 'complete' && request.status === 'ACKNOWLEDGED', 'CONFLICT', 'Request cannot transition', 409);

      if (command === 'acknowledge') {
        const order = await this.createDraft(actor, { branchId: request.branchId, serviceSessionId: request.serviceSessionId, coursePolicy: 'AS_READY', lines: request.lines }, `foh-ack:${key}`, auditRequestId);
        request.orderId = order.id;
      }

      request.status = command === 'acknowledge' ? 'ACKNOWLEDGED' : command === 'reject' ? 'REJECTED' : 'COMPLETED';

      return request;
    }
  };
}
