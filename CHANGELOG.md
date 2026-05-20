# Changelog

All notable changes to `@fluxaria/helix-lib` are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
with pre-1.0 conventions: minor bumps signal BREAKING changes; patch bumps are safe.

## [Unreleased]

### Removed

- **BREAKING:** `provider: "custom"` removed from `HelixConfig`. The OpenAI adapter already accepts an optional `baseUrl`, so any OpenAI-compatible endpoint can be reached via `provider: "openai"` with `baseUrl` set. Callers using `"custom"` must switch to `"openai"`; note that `files.*` will now hit the configured backend (which may not implement it) instead of throwing a typed `not_supported` error.

## [0.0.1] — 2026-04-29

Initial test release. The public API is unstable and may change without warning before `0.1.0`. Not intended for production workloads.

### Added

- **`createHelix(config: HelixConfig)` factory** — single entry point with a discriminated union on `provider: "openai" | "azure" | "custom" | "vertex"`. (ADR-0002)
- **`Helix` interface** with namespaced operations: `responses.create`, `files.{create,list,delete}`, `models.list`, `test`. (ADR-0002)
- **OpenAI provider** via the official `openai` SDK. (ADR-0003)
- **Azure OpenAI provider** via `AzureOpenAI`; `models.list` uses native `fetch` against the deployments endpoint with a hardcoded api-version. (ADR-0003, ADR-0004)
- **Custom OpenAI-compatible provider** for self-hosted or third-party endpoints. (ADR-0003)
- **`FilesCreateParams`** with `file: File | Blob` and required `purpose: HelixFilePurpose` (literal union mirroring OpenAI's `FilePurpose`). (ADR-0005)

### Known limitations

- Errors are passed through raw from the underlying SDK. Standardization to a single `HelixError` class with discriminated `category` is planned. (ADR-0006)
- `vertex` provider variant is declared in `HelixConfig` but not yet implemented — calling `createHelix({ provider: "vertex", ... })` throws.

[0.0.1]: https://github.com/fluxaria/helix-lib/releases/tag/v0.0.1
[Unreleased]: https://github.com/fluxaria/helix-lib/compare/v0.0.1...HEAD
