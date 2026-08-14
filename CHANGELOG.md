# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to use [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Updated the public roadmap after `v0.1.0` with versioned priorities and explicit completion criteria.
- Added a GitHub Social Preview asset with sanitized interface data.
- Removed the duplicate custom security-report link in favor of GitHub private vulnerability reporting.
- Added deny-client-access database rules and owner-only Cloud Storage rules.
- Routed order attachments, content documents, and voice downloads through an authorization Cloud Function.
- Added automated negative authorization and rule-configuration tests.
- Documented the security-rule rollout and isolated-environment verification matrix.
- Replaced client-selected mentor privileges with a pending application flow and explicit server-side approval checks.
- Revalidated approved-mentor status for order, conversation, and protected-file operations.
- Documented mentor approval states, trusted review, legacy migration, and isolated-environment verification.
- Added dependency-injected handlers and Cloud Database adapters for mentor order listing, claiming, and completion.
- Added deterministic behavior tests for approval, ownership, idempotency, and atomic state conflicts.
- Added dependency-injected handlers and Cloud Database adapters for conversation listing, message reading, and message sending.
- Tightened order-conversation authorization so stale, revoked, forged, or unassigned memberships cannot expose message previews or content.
- Made order creation transactional and idempotent with caller-scoped deterministic order IDs.
- Added client request-ID reuse, strict amount parsing, bounded order details, and rollback/replay behavior tests.
- Reworked video analysis into an owner-bound prepare, upload, start, and status workflow.
- Added transactional per-user AI task limits, replay-safe task IDs, real object-size checks, provider timeouts, response limits, and bounded timeline output.
- Switched video inference to the provider's asynchronous submit/result protocol and added resumable client polling across page reloads.
- Documented explicit evidence levels so local CI results are not presented as CloudBase deployment verification.

## [0.1.0] - 2026-08-11

### Added

- English and Chinese project documentation.
- MIT license, governance, contribution, conduct, and security policies.
- Repository validation, structural tests, and continuous integration.
- GitHub issue and pull-request templates.
- Server-side profile and order mutation functions.

### Changed

- Removed committed production-like WeChat AppID and cloud-environment identifiers.
- Moved the video-provider key from a database record to a Cloud Function environment variable.
- Added authorization checks for mentor order access and conversation membership.
- Included voice-message file metadata in server-side messages.

### Security

- Removed direct client writes for profiles, wallet balance, and order state.
- Added bounded input handling for messages, profiles, video file IDs, and orders.

[Unreleased]: https://github.com/YxCarl/yinjiao-bangbang/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/YxCarl/yinjiao-bangbang/releases/tag/v0.1.0
