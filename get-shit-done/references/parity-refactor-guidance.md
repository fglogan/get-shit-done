# Parity and Refactor Hardening Guidance

Use this guidance when the user requests full parity, migration hardening, major refactor hardening, final push, or phrases like:
- "zero capability loss"
- "zero compatibility loss"
- "upstream parity"
- "line-by-line comparison"

## Directive

- Re-audit the entire target project before finalizing the push.
- Compare against the latest upstream baseline using both structural and detailed methods:
  - AST/API surface analysis
  - call graph analysis
  - line-by-line review for high-risk code, config, and structure files
- Every upstream capability must be either:
  1. implemented and verified, or
  2. captured as an explicit pending task with risk and acceptance criteria.
- No silent drops are allowed: capability, compatibility, and connectivity must be preserved.
- Update as-built design docs for both the upstream baseline and target implementation in the same cycle.

## Required Planning Outputs

Plans for parity-hardening work must include tasks for:
- upstream inventory and parity matrix generation
- AST/call-graph extraction and comparison across both codebases
- divergence triage (implemented, partial, missing, intentional)
- compatibility/connectivity checks (API schema, auth, transport, provider, MCP, PTY, LSP, config)
- regression validation commands and evidence capture
- as-built documentation synchronization

Each divergence task must include:
- concrete file scope
- observable behavior to restore or preserve
- verification command or evidence artifact
- blocker condition if parity criteria are not met

## Completion Gate

Do not mark parity-hardening work complete until all are true:
- no unclassified upstream divergences remain
- critical compatibility/connectivity paths are validated
- as-built docs match current implementation state
- any remaining non-critical gaps are tracked as explicit pending tasks
