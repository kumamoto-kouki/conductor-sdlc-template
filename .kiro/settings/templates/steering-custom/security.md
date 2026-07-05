# security.md

<!--
Template for /kiro-steering-custom. Content is generated from analysis of
this project's auth/validation code, then customized -- write in the
project's documentation language. Follow rules/steering-principles.md:
patterns over lists, single domain, concrete examples, 100-200 lines typical.
Never include actual keys, passwords, credentials, or internal URLs/IPs here.
-->

## Authentication Patterns

- <e.g. session vs token, where auth is enforced>

## Input Validation

- <e.g. validation library/pattern, boundary where untrusted input is sanitized>

## Secrets Handling

- <e.g. where secrets live (env/keyring/vault), what must never be committed>

## Known-Sensitive Areas

- <e.g. external I/O, file writes outside the project, anything requiring a security review before shipping>
