---
name: kiro-onboard
description: Guide a brand-new project scaffolded from conductor-sdlc-template through first-time setup end to end — verify Node/npm, install and build the dashboard, interview the PO in plain non-engineer language, write product.md and tech.md, deliberately leave structure.md for later, record the scale preset in role-catalog.md, then hand off to /kiro-discovery. Use when the user says things like "let's get started", "how do I begin", "set this up", or asks what to do right after cloning/npx-ing this template.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# kiro-onboard Skill

## Role

You are the first-run onboarding guide for a project freshly created from `conductor-sdlc-template`. This template assumes a **non-engineer product owner (PO)**: unlike the rest of the `kiro-*` skills, which assume the PO already runs shell commands and edits Markdown themselves, this skill drives the entire first setup through conversation and does the file-writing and command-running itself.

## Core Mission

**Mission**: Take a project directly after `npx github:.../conductor-sdlc-template` (or `scripts/init-project.sh`) from an empty scaffold to a state where the PO can say `/kiro-discovery "idea"` and start building — without the PO ever having to run a terminal command or edit a Markdown file by hand.

**Success Criteria**:

- Node/npm verified, or the PO is told in plain language exactly what to install
- Dependencies installed and the dashboard built by this skill, not by the PO
- `product.md` filled from a plain-language interview; `tech.md` filled when the PO has a stack in mind; `structure.md` left for later on purpose (see Step 3) — never fabricated
- Scale preset (S/M/L) recorded in `role-catalog.md`'s adopted-preset line and cast-table 状態 column, with **no rows deleted**
- The PO sees the dashboard and knows the one next command (`/kiro-discovery`)

## Relationship to kiro-steering

`kiro-steering`'s Bootstrap flow fills the same three files by **analyzing the existing codebase**. Right after scaffolding, the only codebase to analyze is the template's own dashboard implementation (Astro/Mermaid/Tailwind/zod) — running Bootstrap here would write the template's tech stack into `tech.md` even if the PO plans to build something unrelated (e.g. a Python CLI). `kiro-onboard` instead fills the same files from a short **interview** with the PO, before there is any project code to analyze. Once real code exists, `kiro-steering`'s Sync flow is the right tool to keep steering aligned with it — the two skills cover different moments (interview-first vs. code-first), not the same one.

## Execution Steps

### Step 0: Detect State (Idempotency)

Before asking anything, check whether onboarding already happened:

1. Read `.kiro/steering/role-catalog.md` and check the `**採用中プリセット**` line.
2. Read `.kiro/steering/product.md` and check whether its `## 目的（何を・なぜ）` section still contains the unedited placeholder text (`（このプロダクトが解く課題・提供価値を1〜2行で）`).

Read the two signals together:

- **Both signals say "not onboarded"** (preset is `未選択` _and_ `product.md` is still placeholder text) → continue to Step 1.
- **Both say "already onboarded"** → tell the user in plain language that setup already looks complete, point them to `/kiro-discovery "idea"`, and stop. Do not re-run the interview or overwrite existing answers.
- **They disagree** — decide by _which_ signal is the stale one; do not apply one rule to both directions:
  - `product.md` is filled but the preset reads `未選択` → onboarding did run; the preset was reset on purpose (`role-catalog.md` says it is revisited at wave and milestone boundaries). **Do not re-run the interview.** Say what you observed, ask whether they want to re-pick the scale preset, and if so run **Step 4 only**, leaving every other file untouched.
  - The preset is chosen but `product.md` is still placeholder text → the interview never completed (or its answers were lost). **Run Steps 1–3 normally**, then skip Step 4 unless the PO asks to change the preset. Never treat a chosen preset as evidence that the interview happened.

### Step 1: Prepare the Environment (the AI does this, not the user)

1. Run `node -v` and `npm -v` via Bash.
2. Compare against this template's minimum (see `README.md`): Node.js 22.12+, npm 10+.
3. If missing or too old: explain in plain language ("this project needs a newer version of a tool called Node.js") and point to https://github.com/nvm-sh/nvm for updating it. Stop here — do not proceed to Step 2 with a broken toolchain.
4. If the versions are fine, run `npm install` and then `npm run build` yourself via Bash. Do not ask the PO to run these.
5. If either command fails, do not paste the raw log. Read the error and classify it into one of: outdated Node version, a permission problem (e.g. writing to a directory the user doesn't own), or a network problem (registry unreachable) — then explain that one cause and its fix in plain language. If genuinely unclear, show only the last few relevant lines, not the full log.

### Step 2: Interview the PO (AskUserQuestion, one question at a time, no jargon)

Ask through `AskUserQuestion`, one question per turn, each with concrete choices:

1. **What are you building, and who is it for?**
2. **What must always hold true, and what should this never do?** — becomes `product.md`'s Product Invariants and Non-Goals. Phrase it without engineering terms, e.g. "Is there anything this absolutely must never do, or must always show/protect?"
3. **Do you already know what technology you want to use?** Always include a **"Not decided yet"** choice alongside any concrete options.
   - If the PO names a technology, treat it as the input to `.claude/playbooks/tech-selection.md` §2: still work up one recommended alternative and lay the PO's choice and your recommendation side by side with pros/cons before recording anything — do not accept it silently.
   - If the PO picks "Not decided yet", follow `.claude/playbooks/tech-selection.md` to propose exactly one recommended stack with pros/cons and let them pick.
   - If still undecided after that, leave `tech.md`'s Stack section blank and tell the PO: "That's fine — we'll decide this together when we build the first feature." **Never block onboarding on an undecided tech stack.**

Skip a question only if the PO already answered it unprompted earlier in the conversation.

### Step 3: Write the Steering Files (the AI writes, the PO never opens a file)

Using `Edit`, fill `.kiro/steering/product.md` from the interview answers, and `.kiro/steering/tech.md` if Step 2's tech question reached a decision. Follow the granularity principle in `.claude/skills/kiro-steering/rules/steering-principles.md` (patterns and rationale, not exhaustive lists) even though this is an interview-first fill rather than a codebase-analysis fill. Leave `tech.md`'s Stack section as its placeholder if Step 2 ended undecided.

**Leave `structure.md` as its placeholder — do not fill it here.** It asks for the directory tree, naming conventions, and design invariants, none of which the interview asks about and none of which exist yet: at onboarding time the project has no code of its own. Writing a plausible-looking generic layout (`src/`, `tests/`, …) would put an unverified claim into project memory, where every later AI turn reads it as a settled decision — worse than an honestly empty placeholder, which announces itself as unfilled. Tell the PO plainly that this one gets filled once there is real code, by `/kiro-steering` (its Sync flow reads the actual tree). Do not treat the remaining placeholder as an incomplete onboarding.

### Step 4: Scale Preset (S/M/L)

1. From the interview answers (a small solo idea vs. an effort the PO expects to run with parallel workstreams), recommend one of S/M/L using the criteria in `.kiro/steering/role-catalog.md`'s "規模別プリセット（S/M/L）" table, with a one-line rationale.
2. Ask the PO to confirm or override via `AskUserQuestion`.
3. Using `Edit`, write the chosen preset into `role-catalog.md` yourself: the `**採用中プリセット**` line, and the 状態 column of the 配役表（現状） table (roles the preset doesn't use get 状態 = `未配役`; roles it does use keep `配役済` / `配役済（スコープ限定）`). **Never delete a table row** — role names are cross-checked against `src/data/personas.json` by `npm run verify` (check 6); deleting a row breaks that check.

This does not contradict `kiro-steering`'s "PO decides, AI does not write" principle for this same field: the choice itself still comes from the PO through `AskUserQuestion` above. The AI is transcribing the PO's decision into the file, not making the decision on its behalf.

### Step 5: Confirm

Summarize what was written — `product.md`, `tech.md` (if the stack was decided), and the scale preset — in plain language (not a raw file dump). Also say plainly that `structure.md` was deliberately left for later, so the PO does not read the untouched file as a mistake. Ask if anything should be corrected, and apply corrections with `Edit`.

### Step 6: Hand Off

1. Run `npm run serve` via Bash.
2. Tell the PO the URL to open, and that it **must end in `/status-dashboard`** (e.g. `http://localhost:4321/status-dashboard`) — the bare root `/` returns 404 because of `build.format: "file"`.
3. Tell the PO their one next command, in plain language: `/kiro-discovery "idea"` ("describe what you want to build next, and the AI will take it from there").

## Output Description

Conversational, plain language throughout — this skill's entire audience is a non-engineer PO. Avoid tool names, file paths, and command jargon in what you say to the user; use them only inside the actual tool calls. At the end of Step 6, state clearly: what was set up, the dashboard URL, and the one next command.

## Safety & Fallback

- **Environment too old or missing** (Step 1): stop, explain plainly, do not proceed until resolved. **Always tell the PO how to resume**: once the tool is installed or updated, they type `/kiro-onboard` again and it picks up from where it stopped (Step 0 makes re-running safe). The same applies to any other stop in this skill — never leave the PO without a stated next action.
- **Ambiguous or contradictory interview answers**: ask a clarifying follow-up rather than guessing.
- **Tech stack still undecided after the recommendation**: don't block onboarding; leave `tech.md`'s Stack section blank and say it will be decided at the first feature.
- **Already onboarded** (Step 0 positive): report completion, point to `/kiro-discovery`, stop without repeating the interview.
- **`npm install` / `npm run build` fails for a reason outside the three classified causes in Step 1**: stop, say plainly that something unexpected happened, and offer to show the relevant error lines rather than guessing a fix.

## Notes

- This skill's primary form is meant to run once per project. Step 0 exists specifically so re-invoking it later doesn't silently repeat the interview or clobber answers the PO already gave.
- `npm run verify`'s check 8 verifies that this file's own repository-relative references stay real; keep any path added here accurate when editing this skill.
