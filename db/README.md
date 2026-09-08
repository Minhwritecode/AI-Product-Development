# Database Workspace

Thư mục dành cho migration, seed và fixture PostgreSQL.

## Planned layout

```text
db/
├── migrations/
├── seed/
└── fixtures/
```

Schema phải bám [data model baseline](../docs/architecture/data-model.md) và giữ invariant transaction/audit/ledger.
