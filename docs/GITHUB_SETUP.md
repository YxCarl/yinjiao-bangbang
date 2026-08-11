# GitHub publication checklist

Repository settings are part of the project's public maintenance evidence. Apply this checklist after reviewing the local changes.

## Repository identity

Recommended repository name:

```text
yinjiao-bangbang
```

Recommended description:

```text
Open-source WeChat Mini Program reference implementation for educator mentoring, lesson-plan review, teaching-video analysis, and Cloud Function workflows.
```

Recommended topics:

```text
wechat-miniprogram
education
edtech
teacher-development
mentoring
cloud-functions
javascript
open-source
```

Renaming a GitHub repository normally leaves a redirect from the old URL, but update the clone commands, badges, application form, and external links after the rename.

## Repository settings

- Enable Issues and private vulnerability reporting.
- Add a social-preview image based on a sanitized application screenshot.
- Protect `main` and require the `Validate` workflow before merging.
- Require pull-request review when additional maintainers join.
- Disable force pushes and branch deletion on `main`.
- Confirm GitHub recognizes the root MIT license.
- Pin the repository on the maintainer profile and add a concise profile bio.

## First public issues

Create real issues for work that will actually be maintained, for example:

1. implement verified mentor approval;
2. publish tested database and storage rules;
3. add Cloud Function unit tests with a database mock;
4. add consent, retention, and deletion flows for teaching videos;
5. publish a sanitized demo video and reproducible pilot notes.

Do not create placeholder issues merely to increase activity.

## Suggested commit boundaries

Keep the current work reviewable in several commits:

1. `fix: harden cloud workflows and file access`
2. `docs: establish open-source governance and bilingual documentation`
3. `ci: add repository validation and GitHub templates`

Preserve authorship of any pre-existing local changes and inspect each staged diff before committing.

## First release

Publish `v0.1.0` only after manual testing in WeChat Developer Tools. The release notes should state that it is a reference implementation, list the 11 Cloud Functions, link the deployment guide, and repeat the mentor-verification, simulated-wallet, and video-privacy limitations.

Do not publish user counts, school pilots, adoption, or security claims that cannot be verified publicly.
