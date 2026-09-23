# Contributing to Luminex

## Before opening a change

- Đọc PRD và feature spec liên quan.
- Đọc [PRD](docs/02-prd.md) nếu thay đổi workflow hoặc business rule.
- Gắn issue/branch với requirement ID hoặc user story ID.
- Một branch chỉ có một scope chính.
- Không commit `.env`, API key hoặc dữ liệu nhà hàng thật.
- Mutation tồn kho phải có transaction, idempotency và audit.

## Pull request checklist

- [ ] Scope không vượt PRD/ADR hiện tại.
- [ ] Acceptance criteria có test hoặc lý do rõ ràng.
- [ ] `npm run typecheck` và test pass khi dependency đã cài.
- [ ] Docs/API/schema được cập nhật nếu behavior thay đổi.
- [ ] Có note migration/rollback nếu thay đổi data model.
- [ ] UI change đã đối chiếu [UI/UX alignment review](docs/12-uiux-alignment-review.md).
- [ ] Mọi branch push đều đi qua CI; không push trực tiếp feature vào `main`.
