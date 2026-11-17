import type { Actor } from '../platform/types.js';

export type OrderLineInput = { menuItemId: string; quantity: number; modifierOptionIds?: string[]; allergenNote?: string; guestNote?: string };

export type Order = { id: string; branchId: string; serviceSessionId: string; status: 'DRAFT' | 'SENT' | 'CANCELLED'; roundNumber: number; coursePolicy: 'AS_READY' | 'SERVE_TOGETHER'; lines: Array<OrderLineInput & { itemName: string; unitPrice: number; currency: string; stationCode: 'KITCHEN' | 'BAR' }> };

export type GuestMenu = { branchId: string; tableId: string; tableLabel: string; serviceSessionId: string; items: Array<{ id: string; name: string; description: string; price: number; currency: string; allergenCodes: string[]; stationCode: 'KITCHEN' | 'BAR' }> };

export type FohRequest = { id: string; branchId: string; serviceSessionId: string; status: 'SUBMITTED' | 'ACKNOWLEDGED' | 'REJECTED' | 'COMPLETED'; lines: OrderLineInput[]; orderId?: string; createdAt: string };

export type OrderRepository = {
  createDraft(actor: Actor, input: { branchId: string; serviceSessionId: string; coursePolicy: Order['coursePolicy']; lines: OrderLineInput[] }, key: string, requestId: string): Promise<Order>;
  updateDraft(actor: Actor, orderId: string, input: { coursePolicy: Order['coursePolicy']; lines: OrderLineInput[] }, key: string, requestId: string): Promise<Order>;
  send(actor: Actor, orderId: string, key: string, requestId: string): Promise<Order>;
  issueTableToken(actor: Actor, tableId: string, requestId: string): Promise<{ token: string; expiresAt: string }>;
  guestMenu(token: string): Promise<GuestMenu>;
  submitGuestRequest(token: string, lines: OrderLineInput[], key: string): Promise<FohRequest>;
  listRequests(actor: Actor, branchId: string): Promise<FohRequest[]>;
  commandRequest(actor: Actor, requestId: string, command: 'acknowledge' | 'reject' | 'complete', key: string, auditRequestId: string): Promise<FohRequest>;
};
