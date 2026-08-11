# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to use [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
