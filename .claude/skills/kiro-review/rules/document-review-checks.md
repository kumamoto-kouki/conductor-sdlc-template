# Document-Only Mechanical Checks

## When This Applies

The review target is a document with no code diff to run: `requirements.md`, `design.md`, `tasks.md`, a steering file, a playbook, or a skill file. There is no test suite to run, no behavioral RED phase, and no lint target for that content.

## Read-as-N/A

- **Check 1 (Regression Safety)**: N/A. Report `Tests: N/A (document-only review)`.
- **Check 5 (RED Phase Evidence)**: N/A. Report `RED phase: N/A (document-only review)`.
- **Check 6 (Runtime-Sensitive Static Checks)**: N/A. Report `Static checks: N/A (document-only review)`.
- Checks 2 (placeholder markers), 3 (secrets), and 4 (boundary respect) still apply as written — run them against the changed document files.

## Substitute Checks

Run these instead, and fold the results into MECHANICAL_RESULTS or FINDINGS as appropriate:

- **ID cross-reference**: for each requirement ID, design section number, or task ID the document references, confirm the referenced ID actually exists in the target document and was not silently renumbered or dropped.
- **Forbidden-vocabulary grep**: if the document is subject to a project writing standard (e.g. `.kiro/steering/writing-standards.md`), grep the diff for terms that standard forbids (unverifiable hedge words, ungrounded speculation) rather than skipping vocabulary checks entirely.
- **Dependency-declaration diff**: if the document introduces or names a new library, package, or tool, confirm `package.json` (or the project's equivalent manifest) was updated to match, or flag the mismatch.
- **Reference validity spot-check**: for relative file paths or section links the document adds, confirm the target exists rather than assuming it does; do not rely solely on `npm run verify`'s check 8 to catch this later.

These substitute checks are examples, not an exhaustive list — extend them if the document type calls for a different mechanical signal.
