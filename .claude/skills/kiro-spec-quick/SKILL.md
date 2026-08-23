---
name: kiro-spec-quick
description: Quick spec generation with interactive or automatic mode
allowed-tools: Read, Skill, Bash, Write, Glob, Agent
argument-hint: <project-description> [--auto]
---

# Quick Spec Generator

<instructions>
## CRITICAL: Automatic Mode Execution Rules

**If `--auto` flag is present in `$ARGUMENTS`, you are in AUTOMATIC MODE.**

In Automatic Mode:

- Execute ALL 4 phases in a continuous loop without stopping
- Display progress after each phase (e.g., "Phase 1/4 complete: spec initialized")
- IGNORE any "Next Step" messages from Phase 2-4 (they are for standalone usage)
- After Phase 4, run the final sanity review before exiting
- Stop ONLY after the sanity review completes or if error occurs

---

## Core Task

Execute 4 spec phases sequentially. In automatic mode, execute all phases without stopping. In interactive mode, prompt user for approval between phases.

Before claiming quick generation is complete, run one lightweight sanity review over the generated requirements, design, and tasks. **Dispatch a fresh subagent for it** — this context generated those documents, so reviewing them here would be self-review (discipline C, `.kiro/steering/orchestration.md`). If no fresh subagent can be dispatched, do not run the review here and do not report it as passed: say plainly that the sanity review was not performed independently, and leave it to the PO to decide whether to proceed.

**spec.json approval state — the two modes differ, and that difference is intentional**:

Each phase you complete sets that phase's `approvals.<phase>.generated: true` in `spec.json`. Whether `approved` follows depends on the mode.

- **Automatic Mode** (`--auto`): the `-y` chain resolves every approval without a human reading anything. Phase 3 invokes `/kiro-spec-design {feature} -y`, which auto-approves `requirements` (the phase immediately before it). Phase 4 invokes `/kiro-spec-tasks {feature} -y`, which auto-approves `design` and its own `tasks`. So once Automatic Mode completes Phase 4, all three phases show `approved: true` — that is the correct end state of a full automatic run. If `approved: false` is still present on any phase afterwards, do not treat it as expected; treat it as a signal that a phase did not run to completion (skipped, errored, or `-y` not honored) and investigate before proceeding.
- **Interactive Mode**: `-y` is never passed. Each phase ends at `generated: true, approved: false` until the PO approves it via `/kiro-approve {feature}`. Seeing `approved: false` here is the normal, correct state — Interactive Mode exists precisely so that a human, not a flag, records the approval.

The same transitional state also persists when a phase is run standalone without `-y` (e.g. an individually delegated bulk-generation run, as described in `kiro-spec-init`'s approval-state section) — there too, `approved` correctly stays `false` until a human records approval afterward.

## Execution Steps

### Step 1: Parse Arguments and Initialize

Parse `$ARGUMENTS`:

- If contains `--auto`: **Automatic Mode** (execute all 4 phases)
- Otherwise: **Interactive Mode** (prompt at each phase)
- Extract description (remove `--auto` flag if present)

Example:

```
"User profile with avatar upload --auto" → mode=automatic, description="User profile with avatar upload"
"User profile feature" → mode=interactive, description="User profile feature"
```

Display mode banner and proceed to Step 2.

### Step 2: Execute Phase Loop

Execute these 4 phases in order:

---

#### Phase 1: Initialize Spec (Direct Implementation)

**Core Logic**:

1. **Check for Brief**:
   - If `.kiro/specs/{feature-name}/brief.md` exists (created by `/kiro-discovery`), read it for discovery context (problem, approach, scope, constraints)
   - Use brief content as the project description instead of `$ARGUMENTS`

2. **Generate Feature Name**:
   - Convert description to kebab-case
   - Example: "User profile with avatar upload" → "user-profile-avatar-upload"
   - Keep name concise (2-4 words ideally)

3. **Check Uniqueness**:
   - Use Glob to check `.kiro/specs/*/`
   - If directory exists with only `brief.md` (no `spec.json`), use that directory (discovery created it)
   - Otherwise if feature name exists, append `-2`, `-3`, etc.

4. **Create Directory**:
   - Use Bash: `mkdir -p .kiro/specs/{feature-name}` (skip if already exists from discovery)

5. **Initialize Files from Templates**:

   a. Read templates:

   ```
   - .kiro/settings/templates/specs/init.json
   - .kiro/settings/templates/specs/requirements-init.md
   ```

   b. Replace placeholders:

   ```
   {{FEATURE_NAME}} → feature-name
   {{TIMESTAMP}} → current ISO 8601 timestamp (use `date -u +"%Y-%m-%dT%H:%M:%SZ"`)
   {{PROJECT_DESCRIPTION}} → description
   en → language code (detect from user's input language, default to `en`)
   ```

   c. Write files using Write tool:

   ```
   - .kiro/specs/{feature-name}/spec.json
   - .kiro/specs/{feature-name}/requirements.md
   ```

6. **Output Progress**: "Phase 1/4 complete: Spec initialized at .kiro/specs/{feature-name}/"

**Automatic Mode**: IMMEDIATELY continue to Phase 2.

**Interactive Mode**: Prompt "Continue to requirements generation? (yes/no)"

- If "no": Stop, show current state
- If "yes": Continue to Phase 2

---

#### Phase 2: Generate Requirements

Invoke `/kiro-spec-requirements {feature-name}` via the Skill tool.

Wait for completion. IGNORE any "Next Step" message (it is for standalone usage).

**Output Progress**: "Phase 2/4 complete: Requirements generated"

**Automatic Mode**: IMMEDIATELY continue to Phase 3.

**Interactive Mode**: Run `/kiro-approve {feature-name} requirements` so the PO reads the requirements and records approval, then prompt "Continue to design generation? (yes/no)"

- If the PO does not approve the requirements: Stop, show current state, report what they asked to change
- If "no": Stop, show current state
- If "yes": Continue to Phase 3

---

#### Phase 3: Generate Design

**Automatic Mode**: Invoke `/kiro-spec-design {feature-name} -y` via the Skill tool. The `-y` flag auto-approves requirements without the PO reading them.

**Interactive Mode**: Invoke `/kiro-spec-design {feature-name}` via the Skill tool — **without `-y`**. Requirements must already be approved; if they are not, run `/kiro-approve {feature-name} requirements` first (this is the Phase 2 approval the PO was prompted for) and then invoke design generation.

Wait for completion. IGNORE any "Next Step" message.

**Output Progress**: "Phase 3/4 complete: Design generated"

**Automatic Mode**: IMMEDIATELY continue to Phase 4.

**Interactive Mode**: Run `/kiro-approve {feature-name} design` so the PO reads the design and records approval, then prompt "Continue to tasks generation? (yes/no)"

- If the PO does not approve the design: Stop, show current state, report what they asked to change
- If "no": Stop, show current state
- If "yes": Continue to Phase 4

---

#### Phase 4: Generate Tasks

**Automatic Mode**: Invoke `/kiro-spec-tasks {feature-name} -y` via the Skill tool. Note: `-y` auto-approves the design (the phase immediately before) and the generated tasks. It does not approve requirements — Phase 3's `-y` already did that.

**Interactive Mode**: Invoke `/kiro-spec-tasks {feature-name}` via the Skill tool — **without `-y`**. Requirements and design are already approved by the PO at this point. After generation, run `/kiro-approve {feature-name} tasks` so the PO reads the task plan and records approval.

Wait for completion.

**Output Progress**: "Phase 4/4 complete: Tasks generated"

#### Final Sanity Review

After Phase 4, run a lightweight sanity review before claiming completion.

- Review `requirements.md`, `design.md`, and `tasks.md` directly from disk. If `brief.md` exists, use it only as supporting context.
- The reviewer is always a fresh subagent (see the Core Mission note on discipline C). Pass only file paths and the review objective; the reviewer should read the generated files itself.
- Review focus:
  - Do requirements, design, and tasks tell a coherent story?
  - Are there obvious contradictions, missing prerequisites, or missing task coverage for required design work?
  - Are `_Depends:_`, `_Boundary:_`, and `(P)` markers plausible for implementation?
- If the review finds only task-plan-local issues, repair or update the generated `tasks.md` once, then re-run the sanity review.
- If the review finds a real requirements/design gap or contradiction, stop and report follow-up instead of claiming the quick spec is implementation-ready.

**All 4 phases plus sanity review complete.**

Output final completion summary (see Output Description section) and exit.

---

## Important Constraints

### Error Handling

- Any phase failure stops the workflow
- Display error and current state
- Suggest manual recovery command

</instructions>

## Output Description

### Mode Banners

**Interactive Mode**:

```
Quick Spec Generation (Interactive Mode)

You will be prompted at each phase, and each phase is approved by you via /kiro-approve (no auto-approval).
Note: Skips gap analysis and design validation.
```

**Automatic Mode**:

```
Quick Spec Generation (Automatic Mode)

All phases execute automatically without prompts.
Note: Skips optional validations (gap analysis, design review) and ALL human approval — requirements, design, and tasks are auto-approved unread via -y. Internal review gates still run.
Final sanity review still runs.
```

### Intermediate Output

After each phase, show brief progress:

```
Spec initialized at .kiro/specs/{feature}/
Requirements generated → Continuing to design...
Design generated → Continuing to tasks...
```

### Final Completion Summary

Provide output in the language specified in `spec.json`:

```
Quick Spec Generation Complete!

Generated Files:
- specs/{feature}/spec.json
- specs/{feature}/requirements.md ({X} requirements)
- specs/{feature}/design.md ({Y} components, {Z} endpoints)
- specs/{feature}/tasks.md ({N} tasks)

Skipped: /kiro-validate-gap, /kiro-validate-design

Sanity review: PASSED | FOLLOW-UP REQUIRED

Approval state: {Automatic Mode: 全3工程を -y で自動承認済み（PO は未読）／Interactive Mode: PO が承認した工程と、未承認で残っている工程}

Next Steps:
1. Review generated specs (especially design.md)
2. Optional: `/kiro-validate-gap {feature}`, `/kiro-validate-design {feature}`
3. Approve any phase still pending: `/kiro-approve {feature}`
4. Start implementation: `/kiro-impl {feature}`
```

## Safety & Fallback

### Error Scenarios

**Template Missing**:

- Check `.kiro/settings/templates/specs/` exists
- Report specific missing file
- Exit with error

**Directory Creation Failed**:

- Check permissions
- Report error with path
- Exit with error

**Phase Execution Failed** (Phase 2-4):

- Stop workflow
- Show current state and completed phases
- Suggest: "Continue manually from `/kiro-spec-{next-phase} {feature}`"

**Sanity Review Failed**:

- Stop workflow
- Report the exact contradiction, missing prerequisite, or task-plan issue
- Suggest targeted follow-up with `/kiro-spec-design {feature}`, `/kiro-spec-tasks {feature}`, or manual edits depending on the finding

**User Cancellation** (Interactive Mode):

- Stop gracefully
- Show completed phases
- Suggest manual continuation
