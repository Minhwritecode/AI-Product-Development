# API Conventions

## Base

`/api/v1`

## Response shape

```json
{
  "data": {},
  "meta": {"requestId": "req_123"},
  "error": null
}
```

Error:

```json
{
  "data": null,
  "meta": {"requestId": "req_123"},
  "error": {"code": "VALIDATION_ERROR", "message": "...", "fields": {}}
}
```

## HTTP semantics

- `GET` read, `POST` command/create, `PATCH` editable draft, `PUT` replace versioned resource.
- State transitions use named commands (`/send`, `/approve`, `/confirm`) for auditability.
- `401` unauthenticated, `403` unauthorized, `404` not found/in-scope, `409` state/idempotency conflict, `422` validation.

## Idempotency

Client gửi `Idempotency-Key` cho goods receipt confirm, shipment confirm và future POS import. Server lưu result theo actor/endpoint/key trong retention window.

## Pagination/filter

`?page=1&page_size=25&sort=-created_at&status=...`; backend phải enforce maximum page size.

## Dates and numbers

- ISO-8601 UTC trong API.
- Decimal quantities và money không serialize bằng binary float nếu có thể gây sai số.
- Unit luôn gửi cùng quantity.
- Guest QR endpoints must return only session-scoped data; signed token failures use a generic not-found/expired response without leaking table/session details.
- Guest status responses include `as_of`, status text key and recovery action metadata; never rely on color alone.
