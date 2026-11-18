import type { Actor } from '../platform/types.js';

export type StationCode = 'KITCHEN' | 'BAR';

export type TicketStatus =
  | 'NEW'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'PICKED_UP'
  | 'SERVED'
  | 'DELAYED'
  | 'REJECTED'
  | 'CANCELLED';

export type TicketLine = {
  id?: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  modifierOptionIds?: string[];
  allergenNote?: string;
  guestNote?: string;
  stationCode: StationCode;
};

export type StationTicket = {
  id: string;
  orderId: string;
  branchId: string;
  stationCode: StationCode;
  status: TicketStatus;
  tableLabel: string;
  roundNumber: number;
  coursePolicy: 'AS_READY' | 'SERVE_TOGETHER';
  lines: TicketLine[];
  createdAt: string;
  acceptedBy?: string;
  acceptedAt?: string;
  preparedBy?: string;
  preparedAt?: string;
  pickedUpBy?: string;
  pickedUpAt?: string;
  servedBy?: string;
  servedAt?: string;
  delayedAt?: string;
  delayReason?: string;
  rejectedAt?: string;
  rejectReason?: string;
};

export type StationRepository = {
  listTickets(actor: Actor, branchId: string, stationCode?: StationCode, status?: TicketStatus): Promise<StationTicket[]>;
  servingQueue(actor: Actor, branchId: string): Promise<StationTicket[]>;
  accept(actor: Actor, ticketId: string, key: string, requestId: string): Promise<StationTicket>;
  start(actor: Actor, ticketId: string, key: string, requestId: string): Promise<StationTicket>;
  ready(actor: Actor, ticketId: string, key: string, requestId: string): Promise<StationTicket>;
  delay(actor: Actor, ticketId: string, reason: string, key: string, requestId: string): Promise<StationTicket>;
  reject(actor: Actor, ticketId: string, reason: string, key: string, requestId: string): Promise<StationTicket>;
  pickup(actor: Actor, ticketId: string, key: string, requestId: string): Promise<StationTicket>;
  serve(actor: Actor, ticketId: string, key: string, requestId: string): Promise<StationTicket>;
  createTicketDirect?(ticket: StationTicket): void;
};
