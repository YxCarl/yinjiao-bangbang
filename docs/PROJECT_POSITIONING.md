# Project positioning / 项目定位

## What this repository claims

Shifu Zaima is a reference implementation of a two-sided mentoring workflow for WeChat Mini Programs. Its contribution is the documented combination of:

- student request creation for lesson-plan review, teaching questions, and trial-lesson video analysis;
- independently approved mentor access, order claiming, per-order messaging, and completion state;
- server-authorized identity and file access based on WeChat `OPENID`;
- replay-safe transactions, bounded inputs, caller-scoped rate limits, request-bound uploads, and executable behavior tests.

The repository is intended to help contributors study, audit, and adapt these interaction patterns. It is not presented as a hosted marketplace or a production-ready education service.

## What this repository does not claim

The project does **not** claim to have invented:

- student and teacher roles;
- two-sided service or order workflows;
- messaging, appointments, document uploads, or Cloud Functions;
- the general idea of using a WeChat Mini Program for education.

Those are established product and engineering patterns. Open-source value does not require every primitive to be unprecedented; it requires the repository's own contribution, boundaries, evidence, and reuse path to be clear.

## Related public projects

The following examples illustrate adjacent prior art. They are not dependencies, and no claim is made that this short list is exhaustive.

| Project | Overlap | Difference in focus |
| --- | --- | --- |
| [StudyAppt](https://github.com/zxwangbingbing/StudyAppt) | WeChat Cloud Development with student, teacher, and administrator experiences | Course-hour management and appointment operations rather than the lesson-plan, question, and trial-lesson mentoring workflow used here |
| [QuestionWechatApp](https://github.com/kesixin/QuestionWechatApp) | A complete education-oriented Mini Program with front-end and back-end code | Exam and question-bank workflows rather than a two-sided mentoring service |
| [Secondhand-goods-on-campus](https://github.com/zhuyuzhu/Secondhand-goods-on-campus) | Identity, publishing, and order-like marketplace interactions in a Mini Program | Campus goods and information exchange rather than educator guidance |

A targeted public search performed on 2026-08-16 did not establish that the exact feature combination in Shifu Zaima is unique. Search results and public repositories change, so maintainers should not use phrases such as “first”, “only”, or “unprecedented” without a separate, reproducible prior-art review.

## How differentiation should be evaluated

Review this project on observable evidence:

1. Are the student-to-mentor state transitions explicit and reusable?
2. Are authorization and file-access boundaries implemented on the server rather than trusted to the client?
3. Do retries, concurrent state changes, abuse limits, and negative cases have executable tests?
4. Can a new contributor understand the architecture and reproduce a test deployment without private production data?
5. Can another education project reuse one workflow without copying an entire hosted product?

Real-world educational impact, usability, and production fitness require separate deployment and user-study evidence. They cannot be inferred from repository completeness or local tests.

## Provenance and reuse

Related-project links are included for context only. Contributors must submit code and assets they authored or are authorized to license, preserve required notices for any third-party material, and identify adapted sources in the pull request. Similar product structure is not evidence of copied code, but undocumented copying is also not made acceptable by changing names or styling.

---

## 中文说明

“师傅在吗”的定位是一套可学习、可审计、可复用的微信小程序师生服务双端交互参考实现。它的可验证贡献在于将“教案精修、教学问答、试讲视频分析、导师审批与接单、订单会话”组合成有明确状态、权限边界和测试证据的流程。

本项目不宣称首创“学员端 + 教师端”、云函数、订单、即时沟通或教育小程序这些通用模式。已有公开项目与本项目在角色、云开发、预约或订单等方面存在交集，但业务重点和工程边界并不相同。开源价值不等于所有基础元素都必须前所未有；更重要的是贡献范围真实、与已有工作的关系透明，且他人能够审查和复用。

维护者不应使用“第一个”“唯一”或“前所未有”等无法证明的表述。对项目的评价应聚焦于可执行测试、安全边界、可重复部署、领域流程以及贡献者可以实际复用的抽象。
