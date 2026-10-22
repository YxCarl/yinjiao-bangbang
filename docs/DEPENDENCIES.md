# Cloud Function dependency policy / 云函数依赖策略

All committed WeChat Cloud Functions pin `wx-server-sdk` to exactly `3.0.4`. The repository validator and behavior suite reject a missing, ranged, or different version in any function package.

所有已提交的微信云函数均将 `wx-server-sdk` 精确固定为 `3.0.4`。如果任一云函数缺少该依赖、使用版本范围或改成其他版本，仓库校验与行为测试都会失败。

## Why the version is pinned / 为什么精确固定版本

- Cloud Functions are deployed as separate packages, so an uncoordinated edit can make runtime behavior differ between functions.
- Exact direct versions alone do not lock transitive dependencies. Each function now also commits an npm v3 `package-lock.json`; `npm run check:locks` rejects manifest drift, wrong direct versions and local/unverified package links. `npm ci` reproduces that recorded tree locally; the chosen cloud deployment mode must separately be verified to honor it.
- A newer major version is not assumed compatible. Database transactions, query/update result shapes, `serverDate`, storage URLs, and `getWXContext` must be rechecked before a repository-wide upgrade.

The pin is a compatibility baseline, not a claim that `3.0.4` is permanently preferred or the newest available version.

该固定版本只是当前兼容性基线，并不表示 `3.0.4` 永远优先，也不表示它是最新版本。

## Upgrade procedure / 升级流程

1. Open one dependency-upgrade Issue and record the target version, upstream release notes, compatibility risks, and rollback owner.
2. Change all `cloudfunctions/*/package.json` files in one pull request. Do not mix the SDK upgrade with unrelated features.
3. Update `CLOUD_FUNCTION_SDK_VERSION` in `scripts/validate-project.js` and the matching assertion in `tests/project-structure.test.js`.
4. Run `npm test` locally and in GitHub Actions.
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

**2026-10-22 observed result:** all 14 function locks share one tree. The audit reports 12 affected dependency entries: 4 moderate, 6 high, 2 critical, including inherited SDK findings. Examples include [form-data](https://github.com/advisories/GHSA-fjxv-7rqg-78g4), [jsonwebtoken](https://github.com/advisories/GHSA-qwph-4952-7xr6), and [lodash.set](https://github.com/advisories/GHSA-p6mc-m468-83gw). This is a dependency-advisory inventory, not 12 independently exploitable application flaws and not evidence that any real account was compromised.

The npm registry's stable tag was `wx-server-sdk@4.0.2` on this date; [upstream release notes](https://github.com/wechat-miniprogram/wx-server-sdk/blob/master/README.md) show a CloudBase SDK major-version change. No runtime upgrade was made in this maintenance batch. `npm audit fix --force` proposed a breaking downgrade, not a verified safe remediation, so do not run it blindly.

Before release or production use:

1. Compare supported stable SDK candidates and audit their complete dependency trees; do not assume the newest version is advisory-free.
2. Review advisory reachability in the actual enabled operations, without suppressing unreviewed high/critical findings.
3. Upgrade all 14 manifests, locks and validator/test baseline assertions in one focused change.
4. Run local tests and isolated CloudBase tests for identity, transactions/conflict retries, Date cursors, query results, protected files and rollback.
5. Record sanitized results and re-run the audit. Do not claim this gate passed while runtime evidence or high/critical remediation is missing.

当前高危/严重依赖告警仍未消除。锁文件和审计流程让风险可复现、可跟踪，并不等于修复了上游 SDK；升级与云端兼容性验收仍须单独完成。现有生产数据、部署凭据和云环境均未改动。
