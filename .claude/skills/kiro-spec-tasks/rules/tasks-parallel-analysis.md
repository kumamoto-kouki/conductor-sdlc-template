# Parallel Task Analysis Rules

## `(P)` is optional and informational

`(P)` after a task number means the task has no dependency on its immediately preceding peers. Marking it is **optional**: the current execution system does not consume it — `kiro-impl` always runs tasks sequentially and treats `(P)` as informational (see its SKILL.md). Actual parallelism in this template happens at the multi-spec wave level (`/kiro-spec-batch`), not between tasks inside one spec.

## If you do mark `(P)`

- Only when the task has no data dependency on pending tasks, touches no shared files or mutable resources, and its `_Boundary:_` annotation does not overlap with the other `(P)` tasks.
- Append `(P)` immediately after the numeric identifier, outside the checkbox brackets (e.g. `- [ ] 2.1 (P) Build background worker`).
- Still declare specific prior work from a different major-task group with `_Depends: X.X_` — the dependency declaration matters for execution order regardless of `(P)`.
- Omit `(P)` markers entirely when sequential execution is requested (`--sequential` flag).
