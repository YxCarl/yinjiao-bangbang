# Cloud Function dependency policy / 云函数依赖策略

This security-upgrade candidate pins all 14 Cloud Functions to `wx-server-sdk@4.0.2`, with scoped npm overrides for `@cloudbase/node-sdk`'s `axios@0.34.0` and `@cloudbase/database@1.5.1`. It is not a cloud-validated release. The validator rejects manifest/lock drift, missing overrides and stale nested versions.

本安全升级候选将 14 个云函数同步固定到 `wx-server-sdk@4.0.2`，并定向覆盖 CloudBase 子依赖中的 Axios 与数据库库。版本与覆盖策略均有离线防回退检查；尚未完成云端验收，不得直接视为生产发布。

## Why the version is pinned / 为什么精确固定版本

- Cloud Functions are deployed as separate packages, so an uncoordinated edit can make runtime behavior differ between functions.
- Exact direct versions alone do not lock transitive dependencies. Each function now also commits an npm v3 `package-lock.json`; `npm run check:locks` rejects manifest drift, wrong direct versions and local/unverified package links. `npm ci` reproduces that recorded tree locally; the chosen cloud deployment mode must separately be verified to honor it.
- A newer major version is not assumed compatible. Database transactions, query/update result shapes, `serverDate`, storage URLs, and `getWXContext` must be rechecked before a repository-wide upgrade.

The pin is a reviewed repository candidate, not a claim that a version is permanently preferred or certified compatible by WeChat with these overrides.

固定版本与定向覆盖便于复现和审查，不表示微信官方已经认证这个覆盖组合。

## Upgrade procedure / 升级流程

1. Open one dependency-upgrade Issue or draft pull request and record the target version, upstream release notes, compatibility risks, and rollback owner. If API write permission is unavailable, commit the review record and publish the candidate branch for maintainer review.
2. Change all `cloudfunctions/*/package.json` files in one pull request. Do not mix the SDK upgrade with unrelated features.
3. Update `CLOUD_FUNCTION_SDK_VERSION` in `scripts/validate-project.js` and the matching assertion in `tests/project-structure.test.js`.
4. Run `npm test`, `npm run check:locks`, `npm run test:sdk` (after `npm ci` in `cloudfunctions/sendMessage`) and `npm run audit:cloud` locally and in GitHub Actions.
5. Deploy all functions to an isolated test environment using cloud-side dependency installation.
6. Execute the positive and negative matrix in [Deployment guide](DEPLOYMENT.md), including transactions, authorization, temporary file URLs, video analysis, and replay behavior.
7. Record the environment type, test date, SDK version, pass/fail result, and sanitized evidence in [Testing and evidence](TESTING.md).
8. Merge only after review. Redeploy the previous known-good commit if the isolated or staged deployment fails.

## Update cadence / 检查周期

Review upstream stable releases at least once per tagged release and when a security advisory affects the pinned version. Do not automatically merge dependency updates or deploy them directly to a historical/production environment.

每次准备发布标签时至少检查一次上游稳定版本；若固定版本受到安全公告影响，应立即复核。依赖更新不得自动合并，也不得绕过隔离环境直接部署到历史或生产环境。

## Audit and current upgrade gate / 审计与当前升级门槛

Run `npm run check:locks` offline, then `npm run audit:cloud` with npm-registry access. The audit groups byte-equivalent dependency trees (ignoring each function's root name/version) to avoid querying the same tree fourteen times. A changed tree gets its own audit. It checks every function, prints function names, a tree fingerprint, severity counts and public advisory URLs; it never prints credentials or executes dependency install scripts. Network/registry failure is an incomplete audit, never a pass.

The separate **Dependency audit** workflow runs on relevant pushes/pull requests and can be triggered manually in Actions. It has read-only repository permissions, no deployment keys, and no automatic fixes, merges or deployment. High/critical findings fail it; moderate/low findings remain visible. The ordinary **Validate** workflow checks behavior on Node 22 and 24 LTS. Review the [official Node release status](https://nodejs.org/en/about/previous-releases) when maintaining this matrix; the host test runtime is not the CloudBase runtime.

**2026-10-22 comparison:** the previous `3.0.4` tree reported 12 affected entries (4 moderate, 6 high, 2 critical, including inherited findings). Unmodified `4.0.2` still reported 6 (1 moderate, 5 high). The candidate below reports **0 low/moderate/high/critical findings** across all 14 function locks. These are advisory snapshots, not proof that an application has no vulnerabilities or that earlier advisories were exploited.

### Candidate rationale and risks / 候选选择与风险

- `wx-server-sdk@4.0.2` is the registry stable release at review time. Its [upstream notes](https://github.com/wechat-miniprogram/wx-server-sdk/blob/master/README.md) describe the move from CloudBase Node SDK 2.10.0 to 3.17.2; this removes the legacy request/form-data/jsonwebtoken dependency chains.
- Its bundled CloudBase Node SDK still pins vulnerable Axios and database libraries. Under **only `@cloudbase/node-sdk`**, override Axios to `0.34.0`, from the maintained 0.x line. [Axios release notes](https://github.com/axios/axios/releases/tag/v0.34.0) describe configuration/proxy hardening and changes to inherited options and NO_PROXY behavior. Real loopback HTTP tests cover the SDK bridge's JSON, header, redirect, failure and timeout paths; production proxy settings remain unverified.
- Override `@cloudbase/database` to `1.5.1`, an official published package that removes the separate vulnerable lodash.set/unset packages. **It is published under the upstream `next` tag**, not the current `latest` database major. This scoped override is our candidate, not an upstream-supported wx-server-sdk dependency combination. It also upgrades BSON from 4.x to 6.x and changes transaction document requests to normal database endpoints with a transaction ID. Those changes specifically require isolated platform acceptance.
- BSON 6 declares Node `>=16.20.1`; all installed entry points and contracts are tested on supported Node 22/24 in CI. This does not certify an old Cloud Function runtime. Record and test the actual selected platform runtime before deployment; do not deploy to Node 12/14/16.0.
- No alias shim, vendored patched dependency, install script, audit suppression, beta wx-server-sdk or `audit fix --force` is used. Remove the overrides only when an upstream SDK supplies clean equivalents and the same acceptance checks pass.

Tree fingerprint: `3421a993380cc524832c2c714f90edde20ee11aeef99c49c525ab0b2e4b85828` (all 14 functions). Re-run the online audit at review/release time; advisories change.

### Remaining merge and deployment gate / 合并与部署门槛

Before release or production use:

1. Review this focused candidate branch; local and CI tests do not authorize a production rollout.
2. In a new isolated environment, verify that the chosen installer honors npm overrides and the committed lock. Use npm supporting overrides (npm 8.3+); record actual resolved SDK, Axios, database and BSON versions. A cloud installer ignoring overrides restores vulnerable dependencies even if the repository audit is green.
3. Run the full deployment matrix, with special attention to transaction-ID propagation, commit conflicts, rollback, missing documents, native Date cursors, `stats.updated`, WeChat identity and protected files. Use both student and mentor test accounts; never historical user data.
4. Record sanitized evidence and re-run the audit, then review/merge. Do not tag `v0.2.0` or call the cloud gate complete while evidence is missing.
5. Rollback owner: repository maintainer. Before any deployment, snapshot the current isolated function artifacts/configuration. If the candidate fails, stop rollout and restore those artifacts. The repository pre-upgrade reference is `26ad3dc`; it has known advisories and is **not** a safe production fallback. Do not change database schemas or migrate historical data in this dependency PR.

本候选已消除当前锁定依赖树的已知审计告警，并增加真实 SDK 本地契约测试；隔离云环境验收仍待完成。主分支与云环境不会因推送候选分支而自动更新。本次未改动生产数据、部署凭据或云环境。
