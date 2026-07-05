# Design: {{FEATURE_NAME}}

<!--
Document structure template for /kiro-spec-design. Write all prose content in
the language configured in spec.json.language. Follow rules/design-principles.md
(in the kiro-spec-design skill directory) for section authoring guidance --
this file only fixes the section order and the minimum content each section
must carry.

Default section order: Overview -> Goals/Non-Goals -> Boundary Commitments ->
Architecture -> File Structure Plan -> Components & Interfaces -> optional
sections -> Testing Strategy -> Requirements Traceability. Feature-specific
sections (e.g. an I/O format spec) may be inserted between File Structure Plan
and Components & Interfaces when the feature needs them.
-->

## 1. Overview

<one paragraph: what this design builds and why, tying back to the problem in requirements.md>

## 2. Goals / Non-Goals

- **Goals**: <what this design must achieve>
- **Non-Goals**: <what this design explicitly does not attempt>

## 3. Boundary Commitments

<!-- Mechanically checked by the design review gate -- do not leave placeholder-only. -->

- **Owns**: <what this spec is responsible for>
- **Out of Boundary**: <what this spec explicitly does not own>
- **Allowed Dependencies**: <upstream systems/specs this design may depend on>
- **Revalidation Triggers**: <changes elsewhere that would require revisiting this design>

## 4. Architecture

<!-- Add a Mermaid diagram only when 3+ components or external systems
interact (see design-principles.md Diagram Guidelines). State the dependency
direction explicitly, e.g. Types -> Config -> Repository -> Service -> Runtime -> UI. -->

- **Dependency direction**: <layer> -> <layer> -> ...

## 5. File Structure Plan

<!-- Mechanically checked: must contain concrete file paths, and every
component named in Section 7 must appear here with a path. No "TBD". -->

| File     | Responsibility       | New / Modified |
| -------- | -------------------- | -------------- |
| `<path>` | <one responsibility> | New            |

## 6. Data Models

<!-- Optional. Domain Model (aggregates, entities, invariants) and Logical
Data Model (structure, indexing) only when the feature introduces or changes
persisted/exchanged data. Omit this section entirely otherwise. -->

## 7. Components & Interfaces

<!-- Summary table first, then one block per component that introduces a new
boundary. Presentational/no-new-boundary components may stay summary-only. -->

| Component | Domain         | Intent     | Requirements | Key Dependencies |
| --------- | -------------- | ---------- | ------------ | ---------------- |
| `<Name>`  | <domain/layer> | <one line> | 1.1, 1.2     | <dependency>     |

### `<ComponentName>`

- **Responsibility**: <single responsibility>
- **Interface**: <method signatures / inputs / outputs / error envelope, with explicit types -- no `any`>
- **Requirements**: 1.1, 1.2

## 8. Error Handling Strategy

<!-- Feature-specific decisions/deviations only; link to steering for baseline practices. -->

## 9. Testing Strategy

<!-- Derive test items from requirements' acceptance criteria, not generic
patterns. Each item should name the component/behavior it verifies. -->

- <test item referencing a specific component and acceptance criterion>

## 10. Requirements Traceability

| Requirement ID | Design Section       | Components        |
| -------------- | -------------------- | ----------------- |
| 1.1            | §7 `<ComponentName>` | `<ComponentName>` |

<!-- Every numeric requirement ID from requirements.md must appear in this
table (or be covered by the component summary table in Section 7 when the
mapping is 1:1). This is one of the design review gate's mechanical checks. -->
