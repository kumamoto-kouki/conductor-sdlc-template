# structure.md

<!--
Bootstrap template for /kiro-steering (kiro-steering skill, Bootstrap Flow
Step 1). Content is generated from directory tree / naming / import pattern
analysis, then reviewed by the user/orchestrator -- write in the project's
documentation language. Follow rules/steering-principles.md: describe
organization patterns with examples, not a full directory listing.
-->

## Directory Organization

<!-- Describe the pattern (e.g. feature-first, layered), not every file. A
short illustrative tree is fine; keep it to the pattern, not an inventory. -->

```
<example>
src/            <pattern, e.g. feature-first modules>
  ...
.kiro/
  steering/     project memory (this directory)
  specs/        per-feature specs (requirements/design/tasks)
```

## Naming & Placement Conventions

- <e.g. test files live alongside source as `*.test.*`>

## Structural Invariants

<!-- Layer boundaries or single-source-of-truth rules that would cause an
incident if broken. -->

- <invariant>
