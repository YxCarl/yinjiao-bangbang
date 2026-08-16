# Cloud Function dependency policy / 云函数依赖策略

All committed WeChat Cloud Functions pin `wx-server-sdk` to exactly `3.0.4`. The repository validator and behavior suite reject a missing, ranged, or different version in any function package.

所有已提交的微信云函数均将 `wx-server-sdk` 精确固定为 `3.0.4`。如果任一云函数缺少该依赖、使用版本范围或改成其他版本，仓库校验与行为测试都会失败。

## Why the version is pinned / 为什么精确固定版本

- Cloud Functions are deployed as separate packages, so an uncoordinated edit can make runtime behavior differ between functions.
- Exact versions make fresh cloud-side installs reproducible and keep rollback tied to a Git commit.
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
