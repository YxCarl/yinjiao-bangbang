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

Publish `v0.1.0` as a pre-release after automated validation and, when an AppID is available, manual testing in WeChat Developer Tools. Use [docs/releases/v0.1.0.md](releases/v0.1.0.md) as the release body. The notes explicitly distinguish the GitHub source release from deployment to the WeChat platform.

Recommended commands:

```bash
git tag -a v0.1.0 -m "v0.1.0 public beta"
git push origin v0.1.0
```

Then create a GitHub Release for `v0.1.0`, set the title to:

```text
v0.1.0 – Public Beta / 首个开源预览版
```

Mark it as a pre-release. GitHub supplies the source ZIP and TAR.GZ automatically, so no manually assembled package or `.wxapkg` asset is needed.

The public showcase image is `docs/images/interface-overview.png`. It masks the profile identifier and wallet balances. Replace it only with equally sanitized screenshots.

Do not publish user counts, school pilots, adoption, or security claims that cannot be verified publicly.
