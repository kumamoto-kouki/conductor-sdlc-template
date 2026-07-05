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
