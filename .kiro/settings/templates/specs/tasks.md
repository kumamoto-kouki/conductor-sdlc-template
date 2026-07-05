# Tasks: {{FEATURE_NAME}}

<!--
Document structure template for /kiro-spec-tasks. Write all prose content in
the language configured in spec.json.language. Follow rules/tasks-generation.md
(in the kiro-spec-tasks skill directory) for the full checkbox format, `(P)`
parallel-marker rules, and the task plan review gate -- this file only fixes
the minimum shape.

Max 2 levels (major task "1.", sub-task "1.1"; no "1.1.1"). Major tasks
increment 1, 2, 3...; sub-tasks reset per major task. Order implies
dependency: task N depends on everything before it unless a task is marked
`(P)` (parallel-safe) or declares `_Depends: X.X_` explicitly.
-->

- [ ] 1. <Foundation: environment / test infra / shared setup>
- [ ] 1.1 <Sub-task description>
  - <detail bullet>
  - <observable completion bullet -- what will be true when this is done>
  - _Requirements: 1.1_

- [ ] 2. <Core feature area>
- [ ] 2.1 (P) <Sub-task description>
  - <detail bullet>
  - <observable completion bullet>
  - _Requirements: 1.2, 1.3_
  - _Boundary: <ComponentName from design.md>_

- [ ] 2.2 (P) <Sub-task description>
  - <detail bullet>
  - <observable completion bullet>
  - _Requirements: 2.1_
  - _Boundary: <ComponentName from design.md>_

- [ ] 3. <Integration and wiring>
- [ ] 3.1 <Sub-task description>
  - <detail bullet>
  - <observable completion bullet>
  - _Depends: 2.1, 2.2_
  - _Requirements: 3.1_

- [ ] 4. <Validation: E2E, edge cases, regression>
- [ ] 4.1 <Sub-task description>
  - <detail bullet>
  - <observable completion bullet>
  - _Requirements: 1.1, 2.1, 3.1_

<!--
_Requirements:_ lists only numeric requirement IDs, comma-separated -- no
descriptive suffixes or translations. `(P)` marks a task with no dependency on
its immediately preceding peers; omit it entirely when generated with
--sequential. Every requirement ID from requirements.md must appear in at
least one task; every component/contract from design.md must be represented.
-->

## Traceability (optional)

<!--
Add this table once a spec has observed at least one requirement/design
mapping slip (see full-sdlc.md "forward-engineering enhancement" trigger
criteria). Omit it for specs where the checkbox `_Requirements:_` markers
above already give sufficient traceability.
-->

| Requirement ID | Design Section       | Task |
| -------------- | -------------------- | ---- |
| 1.1            | §7 `<ComponentName>` | 1.1  |
