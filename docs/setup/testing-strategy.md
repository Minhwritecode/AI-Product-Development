# Testing Strategy

## Pyramid

1. Unit: conversion, formula, state transition, permission policy.
2. Integration: API + PostgreSQL transaction + audit/ledger.
3. Contract: frontend/backend schemas, POS import contract.
4. E2E: core workflow từ ingredient tới dashboard.

## Critical test scenarios

- Goods receipt retry không double-add stock.
- Shipment retry không double-decrement stock.
- Shipment vượt stock bị từ chối.
- Branch A không đọc/sửa dữ liệu Branch B.
- Wastage value snapshot không đổi khi standard price đổi.
- Missing `sold_qty_theory` không bị biến thành zero.
- AI malformed/low confidence không thể save trực tiếp.
- Unauthorized user không gọi được transition command.
- Audit event có actor/action/entity/request ID.

## Test data

Fixture tối thiểu: 1 owner, 1 purchasing manager, 1 warehouse admin, 2 branch managers ở 2 branch, 3 ingredients với conversion khác nhau, 1 supplier, 2 menu items/recipe versions, 1 PO, 1 receipt và 1 request.

## Quality gates

- Unit/integration tests pass.
- Typecheck/lint pass.
- Migration chạy được từ database rỗng.
- Acceptance criteria trong `04-user-stories-acceptance.md` có test reference.
- Không có secret hoặc dữ liệu nhà hàng thật.
