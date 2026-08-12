# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to use [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Updated the public roadmap after `v0.1.0` with versioned priorities and explicit completion criteria.
- Added a GitHub Social Preview asset with sanitized interface data.
- Removed the duplicate custom security-report link in favor of GitHub private vulnerability reporting.

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
