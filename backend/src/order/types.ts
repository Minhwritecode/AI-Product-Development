import type { Actor } from '../platform/types.js';

export type OrderLineInput = { menuItemId: string; quantity: number; modifierOptionIds?: string[]; allergenNote?: string; guestNote?: string };

export type Order = { id: string; branchId: string; serviceSessionId: string; status: 'DRAFT' | 'SENT' | 'CANCELLED'; roundNumber: number; coursePolicy: 'AS_READY' | 'SERVE_TOGETHER'; lines: Array<OrderLineInput & { itemName: string; unitPrice: number; currency: string; stationCode: 'KITCHEN' | 'BAR' }> };

export type OrderRepository = {
  createDraft(actor: Actor, input: { branchId: string; serviceSessionId: string; coursePolicy: Order['coursePolicy']; lines: OrderLineInput[] }, key: string, requestId: string): Promise<Order>;
  send(actor: Actor, orderId: string, key: string, requestId: string): Promise<Order>;
};
