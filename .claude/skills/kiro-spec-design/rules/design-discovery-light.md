# Light Discovery Process for Extensions

Focused discovery for extending an existing system: identify extension points and existing patterns to follow, the modification scope (files, components), compatibility of new or changed dependencies, and integration risks. For new libraries, verify current official documentation and licensing; record key findings in `research.md` (technology alignment section).

## When to Escalate to Full Discovery

Switch to full discovery if you find:

- Significant architectural changes needed
- Complex external service integrations
- Security-sensitive implementations
- Performance-critical components
- Unknown or poorly documented dependencies

## Output Requirements

- Clear integration approach (note boundary impacts in `research.md`)
- List of files/components to modify
- New dependencies with versions
- Integration risks and mitigations
- Testing focus areas
