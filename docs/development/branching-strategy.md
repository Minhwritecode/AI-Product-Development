# Branching, Commit và Merge Strategy

## 1. Mục tiêu

Mỗi nhánh đại diện cho một loại thay đổi có thể review, test và rollback độc lập. Push lên branch không có nghĩa là đã đưa vào production hoặc `main`; `main` chỉ nhận thay đổi qua pull request và CI xanh.

## 2. Quy ước branch

Prefix mặc định: `codex/` cho nhánh tạo mới bởi Codex; các nhánh hiện tại được giữ để tương thích với cấu trúc dự án.

| Nhánh | Phạm vi được phép | Ví dụ commit |
|---|---|---|
| `docs/product-specs` | BRD/PRD, requirements, user stories, feature specs, source synthesis | `docs: tighten FOH queue requirements` |
| `feat/backend` | API, domain rules, migrations, transactions, tests backend | `feat(backend): add idempotent goods receipt` |
| `feat/frontend` | React UI, routes, state, accessibility, browser tests | `feat(frontend): add table request status` |
| `feat/core` | Shared types, contracts, schema, integration boundary | `feat(core): define queue request contracts` |
| `chore/project-setup` | CI, tooling, dependencies, Docker, lint, test setup | `chore: validate every branch push` |
| `fix/small-changes` | Bug nhỏ, docs typo, non-feature correction; không dùng cho scope lớn | `fix: correct stale status copy` |
| `codex/uiux-review` | UI/UX audit, Stitch catalog/reference notes, design tokens | `docs: align Stitch screens with MVP` |
| `codex/brd-foh-boh` | BRD business requirements và traceability | `docs: add FOH BOH BRD` |

Không trộn backend, frontend và product-doc thay đổi vào một branch nếu chúng có thể review riêng. Nếu một feature bắt buộc nhiều layer, dùng một parent feature branch hoặc PR liên kết; vẫn tách commit theo layer.

## 3. Luồng làm việc chuẩn

```text
main
  └── branch đúng scope
        ├── commit nhỏ, một mục đích
        ├── push branch
        ├── CI chạy trên push
        └── pull request → main
```

Trước khi tạo branch mới:

```bash
git switch main
git pull --ff-only origin main
git switch -c codex/<scope>
```

Trước khi push:

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
git status --short
```

`git add` phải nêu file/path cụ thể; không dùng `git add .` khi working tree có thay đổi của task khác.

## 4. Có cần merge khi push branch khác không?

Không. Push chỉ tải commit lên remote branch:

```bash
git push -u origin codex/<scope>
```

Merge chỉ cần khi muốn đưa branch vào branch đích, thường là qua pull request. Quy trình an toàn:

1. Push branch chức năng.
2. Mở PR vào `main` hoặc branch integration đã được chỉ định.
3. Chờ CI và review.
4. Merge PR bằng squash hoặc merge commit theo policy repository.
5. Cập nhật branch khác từ `main` sau khi merge.

Không push trực tiếp vào `main` cho feature/bugfix. Nếu branch B phụ thuộc branch A chưa merge, tạo PR B → A hoặc ghi dependency rõ trong PR; không cherry-pick tùy tiện làm mất traceability.

## 5. Thứ tự merge đề xuất cho Luminex

1. `chore/project-setup`: CI, lint, test, environment và base tooling.
2. `docs/product-specs`/`codex/brd-foh-boh`: business baseline và traceability.
3. `feat/core`: shared contract, state, schema và error codes.
4. `feat/backend`: API, transaction, authorization, audit và tests.
5. `feat/frontend`: UI theo screen ID, loading/error/accessibility và browser verification.
6. `fix/small-changes`: chỉ merge khi sửa độc lập; nếu sửa cùng feature thì đưa vào PR feature đó.

UI prototype trong `docs/uiux/stitch/` không cần merge vào frontend; chỉ merge catalog/review docs nếu có thay đổi tài liệu.

## 6. Branch hiện tại cần lưu ý

Các branch cũ đang trỏ cùng commit nền `74c4dd2`, trong khi `main` đã có thêm commit UI/UX. Trước khi làm việc tiếp:

- Không force-push các branch cũ.
- Cập nhật branch bằng `git fetch origin` rồi merge/rebase `origin/main` theo policy của PR.
- Nếu branch chưa có commit riêng, nên đóng branch hoặc tạo branch mới từ `main` để tránh PR rỗng.
- Những thay đổi đang nằm trong working tree phải được phân loại trước khi commit; không đưa anti-slop, docs, package lock và code skeleton vào cùng một commit nếu không cùng scope.

## 7. Pull request checklist

- [ ] Branch name phản ánh một scope.
- [ ] PR mô tả requirement/BRD/PRD ID liên quan.
- [ ] Không chứa file ngoài scope hoặc secret.
- [ ] Có migration/rollback note nếu data model đổi.
- [ ] Có API contract/test reference nếu behavior đổi.
- [ ] UI change có browser screenshot/verification ở mobile và desktop.
- [ ] CI lint, typecheck, test và build xanh.
- [ ] Reviewer biết rõ dependency với PR khác.
- [ ] Sau merge đã cập nhật branch còn phụ thuộc.

## 8. Release guardrail

`main` là integration baseline, chưa đồng nghĩa production release. Release/tag chỉ được tạo khi BRD acceptance gates, tests, migration review, security check và UI alignment checklist đạt đủ.
