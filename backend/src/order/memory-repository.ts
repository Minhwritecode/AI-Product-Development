import { randomUUID } from 'node:crypto';
import { assert, assertBranchScope, assertPermission } from '../platform/errors.js';
import type { Order, OrderRepository } from './types.js';

export function createMemoryOrderRepository(): OrderRepository {
  const orders = new Map<string, Order>();
  const replay = new Map<string, Order>();
  const menu = new Map([['menu_demo_chicken', { itemName: 'Gà nướng thảo mộc', unitPrice: 189000, currency: 'VND', stationCode: 'KITCHEN' as const, status: 'PUBLISHED' }], ['menu_demo_coffee', { itemName: 'Cà phê sữa', unitPrice: 49000, currency: 'VND', stationCode: 'BAR' as const, status: 'PUBLISHED' }]]);

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
    async send(actor, orderId, key) { assertPermission(actor, 'queue:write'); const prior = replay.get(key);

 if (prior) return prior; const order = orders.get(orderId); assert(order, 'NOT_FOUND', 'Order not found', 404); assertBranchScope(actor, order.branchId); assert(order.status === 'DRAFT', 'CONFLICT', 'Only draft orders can be sent', 409); order.status = 'SENT'; replay.set(key, order);

 return order; }
  };
}
