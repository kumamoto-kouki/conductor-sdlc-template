# Requirements: {{FEATURE_NAME}}

<!--
Document structure template for /kiro-spec-requirements. Write all prose
content in the language configured in spec.json.language. Keep EARS trigger
keywords (When / If / While / Where / The [system] shall) in English even when
the surrounding language is not English -- see rules/ears-format.md in the
kiro-spec-requirements skill directory for the full pattern catalog.

Requirement headings MUST carry a leading numeric ID ("Requirement 1", not
"Requirement A"). Acceptance criteria IDs follow N.M (Requirement 1 -> 1.1,
1.2, ...). These numeric IDs are the join key used by design.md and tasks.md
traceability -- do not renumber once design/tasks reference them.
-->

## Project Description

- **Who has the problem**: <role or user group>
- **Current situation**: <what exists today, or the gap>
- **What should change**: <the shift this feature makes>

<!-- If a brief.md exists (from /kiro-discovery), scope/exclusions default to
brief.md's `## Scope`. Restate an exclusion here only when it changes how an
acceptance criterion should be read. -->

## Requirement 1: <Requirement Area Title>

**Purpose**: <why this requirement area exists, one or two sentences>

### Acceptance Criteria

1.1 The [System] shall [response/action]. <!-- Ubiquitous -->

1.2 When [event], the [System] shall [response/action]. <!-- Event-driven -->

1.3 If [trigger], then the [System] shall [response/action]. <!-- Unwanted behavior -->

1.4 While [precondition], the [System] shall [response/action]. <!-- State-driven -->

1.5 Where [feature is included], the [System] shall [response/action]. <!-- Optional feature -->

<!-- Use only the patterns that apply; delete the rest. Add a _Boundary:_ line
below the acceptance criteria only when this requirement area's scope could
otherwise be misread:
_Boundary: <what this requirement area explicitly does not cover>_
-->

## Requirement 2: <Requirement Area Title>

**Purpose**: <why this requirement area exists>

### Acceptance Criteria

2.1 ...

<!-- Repeat "## Requirement N: <Title>" blocks for every requirement area.
Every acceptance criterion must be testable, unambiguous, and single-behavior. -->

## Open Questions (optional)

<!--
Add this section whenever a question is still unanswered at the end of the
requirements phase. Classify every entry by WHO HOLDS THE ANSWER -- an
unresolved item filed under the wrong owner is worse than one left blank,
because nobody is waiting for it.

  - **AI が調べる**   -- answerable by research or by reading the codebase.
  - **PO が決める**   -- a business, cost, or risk trade-off. The AI cannot
                        resolve it by investigating harder, and must not
                        absorb it as an assumption.
  - **第三者に聞く**  -- held by someone outside the room (an actual user, an
                        external accountant, a customer, a vendor).

In the 2026-08-24 run this classification was missing and a decision the PO
had personally made years earlier -- and could reverse -- was filed as
"the AI will look into it". It was not researchable: it was a trade-off
between two invariants the PO had already approved, and only the PO could
settle it. State also what breaks if the question stays open.
-->

<!-- Table headings and the three owner values follow spec.json.language, like
     every other prose element in this template. English shown here as the
     placeholder form; Japanese equivalents are 「AI が調べる／PO が決める／第三者に聞く」. -->

| #   | Open question | Who holds the answer                      | What fails while it stays open                  |
| --- | ------------- | ----------------------------------------- | ----------------------------------------------- |
| 1   | <question>    | AI investigates / PO decides / ask a third party | <which acceptance criterion or invariant fails> |
