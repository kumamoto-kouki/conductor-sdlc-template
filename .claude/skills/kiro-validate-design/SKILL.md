---
name: kiro-validate-design
description: Interactive technical design quality review and validation. Use when reviewing design before implementation.
allowed-tools: Read, Edit, Grep, Glob, Bash, AskUserQuestion
argument-hint: <feature-name>
metadata:
  shared-rules: "design-review.md"
---

# kiro-validate-design Skill

## Role

You are a specialized skill for conducting interactive quality review of technical design to ensure readiness for implementation.

## Core Mission

- **Mission**: Conduct interactive quality review of technical design to ensure readiness for implementation
- **Success Criteria**:
  - Critical issues identified (maximum 3 most important concerns)
  - Balanced assessment with strengths recognized
  - Clear GO/NO-GO decision with rationale
  - Actionable feedback for improvements if needed
  - On GO, the PO's approval can be recorded in `spec.json` without leaving this skill — but only after the PO explicitly says so

## Execution Steps

### Step 1: Gather Context

If steering/spec context is already available from conversation, skip redundant file reads.
Otherwise, load all necessary context:

- Read `.kiro/specs/{feature}/spec.json` for language and metadata
- Read `.kiro/specs/{feature}/requirements.md` for requirements
- Read `.kiro/specs/{feature}/design.md` for design document
- Core steering context: `product.md`, `tech.md`, `structure.md`
- Additional steering files only when directly relevant to architecture boundaries, integrations, runtime prerequisites, domain rules, security/performance constraints, or team conventions that affect implementation readiness
- Relevant local agent skills or playbooks only when they clearly match the feature's host environment or use case and provide review-relevant context

#### Parallel Research

The following research areas are independent and can be executed in parallel:

1. **Context & rules loading**: Spec documents, core steering, task-relevant extra steering, relevant local agent skills/playbooks, and `rules/design-review.md` from this skill's directory for review criteria
2. **Codebase pattern survey**: Gather existing architecture patterns, naming conventions, and component structure from the codebase to use as reference during review

After all parallel research completes, synthesize findings for review.

### Step 2: Execute Design Review

- Reference conversation history: leverage prior requirements discussion and user's stated design intent
- Follow design-review.md process: Analysis → Critical Issues → Strengths → GO/NO-GO
- Limit to 3 most important concerns
- Engage interactively with user — ask clarifying questions, propose alternatives
- Use language specified in spec.json for output

### Step 3: Decision and Next Steps

- Clear GO/NO-GO decision with rationale
- Provide specific actionable next steps (see Next Phase below)

### Step 4: Record Approval (GO only)

A GO verdict is this skill's opinion, not the PO's approval. Turn it into a recorded approval only through an explicit human decision.

**On GO**:

1. Present the review result to the PO, disclosing the concerns raised above **before** asking anything (`.claude/playbooks/po-communication.md` §5). If the GO is conditional, say what the condition is.
2. Use `AskUserQuestion` to ask whether to record the design approval now (e.g. 「この設計を承認として記録しますか？」 / 承認する / まだ承認しない).
3. Only if the PO approves:
   - Get a timestamp with Bash: `date -u +"%Y-%m-%dT%H:%M:%SZ"`
   - Edit `.kiro/specs/{feature}/spec.json`: set `approvals.design.approved: true`, `approvals.design.approved_sha256` (= `sha256sum design.md`), and `updated_at`
   - Touch nothing else — no other phase's flags, no `generated` flags, no `phase` field
   - Run `npm run status` so `STATUS.md` matches
4. If the PO declines, write nothing and report what they want changed.

**On NO-GO**: never record an approval, regardless of what the review found worth praising.

If the PO would rather approve separately, `/kiro-approve {feature} design` does the same recording as a standalone step.

## Important Constraints

- **Approval is the PO's act, not the reviewer's**: never write `approvals.design.approved: true` without an explicit human answer in Step 4, and never on NO-GO
- **One phase only**: this skill may record `design` and nothing else. Do not change the `approvals.<phase>.generated` / `.approved` key shape — `scripts/status-report.mjs` derives the workflow stage from it
- **Quality assurance, not perfection seeking**: Accept acceptable risk
- **Critical focus only**: Maximum 3 issues, only those significantly impacting success
- **Conversation-aware**: Leverage discussion history for requirements context and user intent
- **Interactive approach**: Engage in dialogue, ask clarifying questions, propose alternatives
- **Balanced assessment**: Recognize both strengths and weaknesses
- **Actionable feedback**: All suggestions must be implementable
- **Context Discipline**: Start with core steering and expand only with review-relevant steering or use-case-aligned local agent skills/playbooks

## Tool Guidance

- **Read first**: Load spec, core steering, relevant local playbooks/agent skills, and rules before review
- **Grep if needed**: Search codebase for pattern validation or integration checks
- **Interactive**: Engage with user throughout the review process
- **Edit last, and only once**: the only permitted write is the Step 4 approval in `spec.json`

## Output Description

Provide output in the language specified in spec.json with:

1. **Review Summary**: Brief overview (2-3 sentences) of design quality and readiness
2. **Critical Issues**: Maximum 3, following design-review.md format
3. **Design Strengths**: 1-2 positive aspects
4. **Final Assessment**: GO/NO-GO decision with rationale and next steps
5. **Approval Record**: whether `approvals.design.approved` was written, or that nothing was written

**Format Requirements**:

- Use Markdown headings for clarity
- Follow design-review.md output format
- Keep summary concise

## Safety & Fallback

### Error Scenarios

- **Missing Design**: If design.md doesn't exist, stop with message: "Run `/kiro-spec-design {feature}` first to generate design document"
- **Design Already Approved**: If `approvals.design.approved` is already `true`, review normally but skip Step 4 — report the existing approval instead of rewriting it
- **`npm run status` Fails After Recording**: do not roll back the approval; report that `STATUS.md` could not be regenerated and that `spec.json` is authoritative
- **Design Not Generated**: If design phase not marked as generated in spec.json, warn but proceed with review
- **Empty Steering Directory**: Warn user that project context is missing and may affect review quality
- **Language Undefined**: Default to English (`en`) if spec.json doesn't specify language

### Next Phase: Task Generation

**If Design Passes Validation (GO Decision)**:

- Apply any suggested improvements if agreed
- Record the approval in Step 4 (or later with `/kiro-approve {feature} design`)
- Run `/kiro-spec-tasks {feature}` to generate implementation tasks
- Or `/kiro-spec-tasks {feature} -y` to fast-track: auto-approves the design (this phase) and the generated tasks without reading them

**If Design Needs Revision (NO-GO Decision)**:

- Address critical issues identified in review
- Re-run `/kiro-spec-design {feature}` with improvements
- Re-validate with `/kiro-validate-design {feature}`

**Note**: Design validation is recommended but optional. Quality review helps catch issues early.
