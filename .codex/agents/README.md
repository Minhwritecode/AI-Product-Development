# Luminex project subagents

This project-scoped agent set contains the complete TOML collection from
[VoltAgent/awesome-codex-subagents](https://github.com/VoltAgent/awesome-codex-subagents).

The collection currently contains 175 agents across core development,
language specialists, infrastructure, quality/security, data/AI,
developer experience, specialized domains, business/product,
meta-orchestration, research, AI governance and platform/evals.

Roles especially relevant to Luminex include:

- `business-analyst`, `product-manager`, `ux-researcher`: clarify Luminex FOH/BOH workflows and acceptance criteria.
- `backend-developer`, `frontend-developer`, `ui-designer`: implement scoped product changes.
- `postgres-pro`, `data-analyst`, `ai-engineer`: review inventory data integrity, dashboards and AI safety boundaries.
- `reviewer`, `security-auditor`, `test-automator`: correctness, security and regression checks.
- `accessibility-tester`, `anti-ui-slop-reviewer`: QR hospitality UX and finish-gate review.

The root [`AGENTS.md`](../../AGENTS.md) supplies Luminex-specific business rules and
workflow constraints. Use one write-capable agent per overlapping file area; run
review and audit agents read-only after implementation.

The upstream `gpt-5.6-sol` defaults were mapped to the host-supported
`gpt-5.6-terra` model. Other upstream model defaults and role instructions
were preserved. The files are project-scoped and do not install or modify
global user agents.
