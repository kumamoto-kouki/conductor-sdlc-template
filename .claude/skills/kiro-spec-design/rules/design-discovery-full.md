# Full Discovery Process for Technical Design

Research before design so that the design rests on complete, current information. Cover, as relevant to the feature: requirements mapped to technical needs and constraints; the existing implementation (reusable components, domain boundaries, extend vs refactor vs wrap); external dependencies (verify API signatures, versions, compatibility, rate limits against current official sources via WebSearch/WebFetch — do not design against remembered API details); architecture pattern and boundary/ownership analysis (preferred pattern and rejected alternatives go to `research.md`); and technical risks.

## Output Requirements

Capture all findings that impact design decisions in `research.md` using the shared template:

- Key insights affecting architecture, technology alignment, and contracts
- Constraints discovered during research
- Recommended approaches and selected architecture pattern with rationale
- Rejected alternatives and trade-offs (documented in the Design Decisions section)
- Updated domain boundaries that inform Components & Interface Contracts
- Risks and mitigation strategies
- Gaps requiring further investigation during implementation
