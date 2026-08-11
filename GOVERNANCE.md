# Project governance

Yinjiao Bangbang is currently maintained under a lightweight maintainer-led model.

## Primary maintainer

The current primary maintainer is [YxCarl](https://github.com/YxCarl). The primary maintainer is responsible for:

- roadmap and scope decisions;
- issue triage and contributor support;
- pull-request review and merge decisions;
- release preparation and changelog maintenance;
- dependency, privacy, and security maintenance;
- repository settings and access control.

## Decision process

Feature and architecture decisions should begin in a public GitHub issue. The maintainer records the decision and its trade-offs before implementation when a change affects data handling, authentication, external services, or backward compatibility.

Small, reversible fixes may proceed directly through a pull request. Security reports follow [SECURITY.md](SECURITY.md) and should not be discussed in a public issue before a fix is available.

## Releases

Releases use semantic versioning where practical. A release requires:

1. a clean `npm test` result;
2. an updated `CHANGELOG.md`;
3. review of new data flows, permissions, and external-service calls;
4. a Git tag and matching GitHub Release notes.

## Additional maintainers

Consistent contributors may be invited to triage or review after demonstrating sound technical judgment, respectful collaboration, and care with user data. Repository administration remains limited to the access required for each role.
