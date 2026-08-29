---
name: kiro-debug
description: Investigate implementation failures using root-cause-first debugging. Use when an implementer is blocked, verification fails, or repeated remediation does not converge.
allowed-tools: Read, Bash, Grep, Glob, WebSearch, WebFetch
argument-hint: <failure-summary>
---

# kiro-debug

## Overview

This skill is for fresh-context root cause investigation. It combines local evidence, runtime/config inspection, and external documentation or issue research when available. It is not a patch generator for guess-first debugging.

## When to Use

- Implementer reports `BLOCKED`
- Reviewer rejection repeats after remediation
- Validation fails unexpectedly
- A task appears to conflict with runtime or platform reality
- The same failure survives more than one attempted fix

Do not use this skill to speculate about fixes before gathering evidence.

## Inputs

Provide:

- Exact failure symptom or blocker statement
- Error messages, stack trace, and failing command output
- Current `git diff` or summary of uncommitted failed changes
- Task brief: what was being built
- Reviewer feedback, if the failure came from review rejection
- Relevant spec file paths (`requirements.md`, `design.md`)
- Relevant requirement/design section numbers
- Relevant `## Implementation Notes`
- Runtime or environment constraints already known

## Outputs

Return:

- `ROOT_CAUSE`
- `CATEGORY`
- `FIX_PLAN`
- `VERIFICATION`
- `NEXT_ACTION: RETRY_TASK | BLOCK_TASK | STOP_FOR_HUMAN`
- `CONFIDENCE: HIGH | MEDIUM | LOW`
- `NOTES`

Use the language specified in `spec.json`.

## Method

Gather evidence first — the exact error and failing command, relevant repo/runtime/dependency state, and (when web access is available) official docs or version-specific issues — before classifying anything. For runtime/dependency issues, docs and version issues often contain the shortest path to root cause.

### 1. Classify the Root Cause

Use one category:

- `MISSING_DEPENDENCY`
- `RUNTIME_MISMATCH`
- `MODULE_FORMAT`
- `NATIVE_ABI`
- `CONFIG_GAP`
- `LOGIC_ERROR`
- `TASK_ORDERING_PROBLEM`
- `TASK_DECOMPOSITION_PROBLEM`
- `SPEC_CONFLICT`
- `EXTERNAL_DEPENDENCY`

### 2. Determine the Smallest Safe Next Action

Use `NEXT_ACTION: RETRY_TASK` when the issue can be fixed inside this repo (editing files, adjusting configuration, adding or correcting dependencies, restructuring code) within the current approved task plan.

### 3. Determine Whether the Task Plan Is Still Valid

Decide whether the current approved task plan is still safe to execute as written.

Prefer `NEXT_ACTION: STOP_FOR_HUMAN` when:

- A missing prerequisite task should exist before this one
- The current task is ordered incorrectly relative to unfinished work
- The current task boundary is wrong and should be split or merged
- The task is too large or ambiguous to fix safely inside the current implementation loop

Use `NEXT_ACTION: BLOCK_TASK` only when the current task should stop but the rest of the queue can still proceed safely.

Do not propose a brute-force code fix as a substitute for revising `tasks.md` or the approved plan.

## Critical Rule

Do not propose a multi-fix shotgun plan. Identify the root cause first, then produce the smallest plausible fix plan. If the true problem is a spec conflict or architecture problem, say so directly.

## Stop / Escalate

Use `NEXT_ACTION: STOP_FOR_HUMAN` when the blocker genuinely requires:

- Human product/requirements decision
- External credentials or inaccessible services
- Hardware or unavailable external systems
- Re-scoping due to spec/platform conflict

If the issue is fixable by repo changes inside the current task plan, do not escalate prematurely.

## Output Format

```md
## Debug Report

- ROOT_CAUSE: <1-2 sentence root cause>
- CATEGORY: MISSING_DEPENDENCY | RUNTIME_MISMATCH | MODULE_FORMAT | NATIVE_ABI | CONFIG_GAP | LOGIC_ERROR | TASK_ORDERING_PROBLEM | TASK_DECOMPOSITION_PROBLEM | SPEC_CONFLICT | EXTERNAL_DEPENDENCY
- FIX_PLAN:
  1. <specific repo-fixable action>
  2. <specific repo-fixable action>
- VERIFICATION: <command(s) to confirm the fix>
- NEXT_ACTION: RETRY_TASK | BLOCK_TASK | STOP_FOR_HUMAN
- CONFIDENCE: HIGH | MEDIUM | LOW
- NOTES: <context the next implementer should know>
```
