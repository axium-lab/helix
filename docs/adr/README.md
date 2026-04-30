# Architecture Decision Records

Compact records of architectural decisions for `helix-lib`.

## Format

We use [Nygard ADRs](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions). Each ADR captures: Context · Decision · Consequences.

ADRs are immutable once accepted. New decisions that supersede an ADR get a new entry referencing the prior one.

## Index

| # | Title | Date | Status |
|---|---|---|---|
| 0001 | Hexagonal Interface Contract for helix-lib v0 | 2026-04-27 | Superseded by 0002 |
| 0002 | SDK-Mirror Public API — Single Factory and Namespaced Interface | 2026-04-28 | Accepted |
| 0003 | Real HTTP Implementations via openai SDK (OpenAI, Azure, Custom) | 2026-04-28 | Accepted |
| 0004 | Azure models.list via Native Fetch with Hardcoded API Version | 2026-04-28 | Accepted |
| 0005 | FilesCreateParams Narrowed to File \| Blob with Required Purpose | 2026-04-28 | Accepted |
| 0006 | Standardized HelixError Across All Providers | 2026-04-29 | Accepted (planned) |
| 0007 | Explicit Mappers for OpenAI `responses.create` Adapter | 2026-04-30 | Accepted |
