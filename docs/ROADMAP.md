# Public roadmap / 公开路线图

**Last updated / 最后更新：2026-08-16**

This roadmap communicates current priorities, not guaranteed delivery dates. Planned work should be linked to a public issue before implementation, and completed work should include tests or other reproducible evidence.

本路线图用于说明当前优先级，不承诺具体交付日期。计划项在实施前应关联公开 Issue；完成项应提供测试、文档或其他可复现证据。

## Shipped: v0.1.0 open-source baseline / 已发布：v0.1.0 开源基线

Evidence: [v0.1.0 public beta](https://github.com/YxCarl/yinjiao-bangbang/releases/tag/v0.1.0) and the repository's `Validate` workflow.

- [x] Remove committed AppID-like deployment identifiers and cloud-environment IDs.
- [x] Add the MIT license, maintainer governance, contribution guide, code of conduct, and security policy.
- [x] Route protected profile, order, conversation, and message mutations through Cloud Functions.
- [x] Add order-access and conversation-membership authorization checks.
- [x] Add structural tests, repository validation, and GitHub Actions.
- [x] Publish bilingual project, architecture, deployment, and release documentation.
- [x] Publish a sanitized interface overview with identifiers and wallet balances masked.
- [x] Publish the first tagged source pre-release with automatic ZIP and TAR.GZ archives.

## Now: v0.2.0 secure and reproducible deployment / 当前：安全且可复现的部署

Deployment checkpoint: on 2026-08-14, four additive Cloud Functions were deployed and queried as `Active` after an off-repository backup of the 14 pre-existing functions. This is recorded in [Testing and evidence](TESTING.md), but it does not complete the fresh-environment smoke test or its cross-account authorization matrix.

部署检查点：2026-08-14，在对 14 个既有云函数完成仓库外备份后，4 个新增云函数已部署并查询为 `Active`。证据记录在[测试与证据](TESTING.md)中，但这并不等于已经完成全新环境烟雾测试或跨账号授权矩阵。

Platform compile checkpoint: on 2026-08-16, the authenticated WeChat Developer Tools CLI produced a successful preview after repository-only assets were excluded from the Mini Program package. The resulting source package was 210,305 bytes. The account still lists only the historical 18-function environment, so this does not complete item 1.

平台编译检查点：2026-08-16，已登录的微信开发者工具 CLI 在排除仓库专用素材后成功生成预览，源码包为 210,305 字节。当前账号仍只列出包含 18 个函数的历史环境，因此该结果不能完成第 1 项。

The first simulator-level negative calls reached the deployed validation paths successfully. A redacted, count-only data audit also identified migration blockers: an absent `contents` collection, client-readable historical data, legacy mentor records without approval status, and inconsistent legacy user/order state. Existing authorization-sensitive functions and deny-by-default rules remain intentionally undeployed until those records are reviewed.

首轮模拟器负向调用已经成功到达已部署函数的参数校验路径。脱敏且仅计数的数据审计同时发现了迁移阻塞项：缺少 `contents` 集合、历史数据仍可由客户端读取、历史师傅缺少审核状态，以及用户与订单状态不一致。在这些记录完成复核前，既有授权敏感函数与默认拒绝规则仍不会部署。

Priority order / 优先顺序：

1. [ ] Perform and document a full smoke test in WeChat Developer Tools using a maintainer-owned AppID and isolated test cloud environment.
2. [x] Publish deny-by-default database and storage rule examples with automated rule tests ([Issue #2](https://github.com/YxCarl/yinjiao-bangbang/issues/2)).
3. [x] Replace self-selected mentor access with an independently approved mentor-verification state and authorization checks ([Issue #4](https://github.com/YxCarl/yinjiao-bangbang/issues/4)).
4. [x] Introduce mockable Cloud Database adapters and add behavior-level tests for critical Cloud Functions ([Issue #6](https://github.com/YxCarl/yinjiao-bangbang/issues/6), covering mentor orders, messages, order creation, video analysis, and cleanup).
5. [x] Add caller-scoped rate limits and replay/abuse controls for messages, orders, request-bound file uploads, and AI tasks; broader moderation and operational monitoring remain production-hardening work.
6. [ ] Define and enforce file-size, video-duration, retention, deletion, and consent policies (bounds, versioned video acknowledgement, diagnosis-task binding, and disabled-by-default cleanup for unbound AI tasks/rate counters implemented; immutable order attachments and deletion of active business records remain deployment-policy work).
7. [x] Standardize Cloud Functions on one pinned, tested SDK version and document the upgrade process ([Dependency policy](DEPENDENCIES.md)).
8. [x] Publish an evidence-based project-positioning note that distinguishes common two-sided Mini Program patterns from this repository's specific contribution and avoids unsupported originality claims ([Project positioning](PROJECT_POSITIONING.md)).

### v0.2.0 definition of done / 完成标准

- A new contributor can deploy a test instance by following only the public documentation and supplying their own private credentials.
- Authorization and storage-rule tests run in CI and cover negative as well as successful paths.
- Security-sensitive limitations and migration steps are reflected in `SECURITY.md`, deployment documentation, and release notes.
- A tagged `v0.2.0` pre-release records test results and known limitations without exposing production data.

## Next: v0.3.0 maintainer and contributor experience / 下一阶段：维护与贡献体验

- [ ] Add deterministic development fixtures and reset instructions for all demo collections.
- [ ] Add an optional `miniprogram-ci` preview workflow with protected GitHub secrets and no credentials in logs or artifacts.
- [ ] Publish a short, sanitized walkthrough showing clone, configuration, deployment, and the four core user flows.
- [ ] Add Cloud Function dependency auditing and a documented update cadence.
- [ ] Add a provider interface for video analysis and an optional OpenAI-compatible adapter without changing the client pages.
- [ ] Document an opt-in, human-reviewed Codex workflow for issue triage, test generation, pull-request review, and release-note drafting.
- [ ] Label and maintain scoped `good first issue` tasks backed by contributor fixtures and acceptance criteria.

### v0.3.0 definition of done / 完成标准

- A pull request from a new contributor can be installed, tested, and reviewed without access to production services.
- Maintainer automation is reproducible, requires human approval for repository changes, and never exposes secrets.
- The demo walkthrough and contributor documentation match the tagged release.

## Later: v1.0 pilot readiness and maintenance evidence / 后续：试点准备与维护证据

- [ ] Run a documented, consent-based pilot only after the v0.2.0 security controls are complete.
- [ ] Publish anonymized aggregate usage and reliability metrics with collection methodology and limitations.
- [ ] Complete accessibility checks for supported Mini Program interactions and document remaining platform constraints.
- [ ] Publish backup, restore, rollback, data-export, and account-deletion procedures.
- [ ] Establish a sustainable release, dependency-update, issue-triage, and vulnerability-response cadence.
- [ ] Define the stability and migration guarantees required to remove the pre-release label.

## How progress is tracked / 如何跟踪进度

- Propose features and security work through [GitHub Issues](https://github.com/YxCarl/yinjiao-bangbang/issues/new/choose).
- Keep one primary roadmap item per Issue and link the implementing pull request.
- Mark an item complete only after the implementation and its verification evidence are public.
- Do not publish unverifiable user counts, school pilots, adoption, security, or performance claims.
- Security vulnerabilities should follow [SECURITY.md](../SECURITY.md), not a public Issue.
