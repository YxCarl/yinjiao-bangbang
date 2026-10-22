# Reproducible demo fixtures / 可复现的合成演示数据

The fixture generator performs **local file generation only**. It never connects to WeChat, creates a cloud environment, approves real mentors, imports data, deletes records, or calls a model provider. All default identities, questions and messages are synthetic. These records do not prove real adoption or a completed cloud deployment.

生成器只生成本地文件，默认试运行。全部默认账号、问题和消息均为合成数据，不代表真实使用量。只在新建、专用的隔离测试环境使用；不要导入历史环境。

## Generate locally / 本地生成

From the repository root, with Node.js 22 or 24 LTS:

```powershell
npm run fixtures:demo
npm run fixtures:demo -- --write
```

The first command prints only counts. The second creates a new `outputs/demo-fixtures-v1/` directory containing five JSON Lines files and `manifest.json`. It refuses to overwrite an existing directory. To create another generation, supply a new direct child of `outputs`:

```powershell
npm run fixtures:demo -- --write --output "D:\miniprogram-师承杯\outputs\demo-fixtures-v2"
```

`outputs/` and `secrets/` are ignored by Git and explicitly excluded from the Mini Program package. Both exclusions are regression-tested; Git ignore alone does not control WeChat packaging. The generator rejects the C drive, paths outside this repository's output directory, existing targets and output-directory junctions.

| Collection | Initial records | Purpose |
| --- | ---: | --- |
| `users` | 5 | Two students, two approved synthetic mentors and one pending applicant |
| `orders` | 56 | Open, assigned, anonymous, other-mentor and completed questions |
| `conversations` | 110 | Paired participants, more than one list page |
| `messages` | 65 | More than one history page, including equal timestamps |
| `contents` | 1 | Searchable synthetic resource, no attachment |
| `aiTasks`, `rateLimits` | 0 | Start empty; no AI processing or historical counters are fabricated |

Dates are exported as Extended JSON (`{"$date":"..."}`), not ordinary strings. Use the CloudBase JSON import format and verify that `createTime`/`lastTime` become database Date values. Cursor comparisons require Date values. See the official [CloudBase data-management documentation](https://docs.cloudbase.net/database/manage).

## Bind private test accounts / 绑定私有测试账号

Default `SYNTHETIC_ONLY_*` owners cannot authenticate through WeChat. For real tests, a trusted environment operator must first obtain the two or more test-account OPENIDs privately and consistently bind them before import. Store a local binding JSON under ignored `secrets/`, for example:

```json
{
  "student": "<private student test OPENID>",
  "mentor": "<private mentor test OPENID>"
}
```

The other optional keys are `otherStudent`, `otherMentor`, and `pending`; each supplied account must differ. Generate with:

```powershell
npm run fixtures:demo -- --write --bindings secrets/demo-bindings.json --output outputs/demo-bound-v1
```

The command logs counts, not identity values. Bound output contains private test IDs and must stay outside Git, issue attachments and public screenshots. The simulated 1000-unit balances exist only for testing the order workflow. Fixture approval flags are only for operator-owned test actors, never a public approval mechanism.

## Import and verify / 导入与验证

1. Create a new isolated environment and the seven collections documented in [Deployment](DEPLOYMENT.md). Keep cleanup disabled. Deploy current functions and rules, and review [candidate indexes](INDEXES.md).
2. Check that the target environment has no unrelated users or records. Review `manifest.json` and import the five nonempty `.jsonl` files into the corresponding collections. Create `aiTasks` and `rateLimits` empty; there are no empty import files.
3. Confirm dates are database Dates, account bindings match test actors, and direct client database access is denied. Do not sign in first and then import conflicting duplicate profiles; resolve duplicate test profiles privately before testing.
4. As the student, open the anonymous question's conversation: 50 messages appear initially; load the earlier 15. Equal timestamps must not repeat or hide messages.
5. As the mentor, confirm the other mentor's question is absent. Claim the open question; exactly one assigned order and two membership records should result. Repeating the request preserves previews and unread counts. Two mentors racing should yield one assignment.
6. Scroll the conversation lists and use “加载更多会话”. Pending/revoked mentors must remain blocked from protected records on every page.
7. Record sanitized pass/fail results in [Testing and evidence](TESTING.md). Uploads, voice, AI processing and real WeChat identity checks require additional tests; this fixture has no private file IDs or recordings.

## Reset / 重置

The generator intentionally has no cloud-delete command. For repeat runs, prefer a new isolated environment. In a disposable fixture environment, a trusted operator can inspect the exact collection/document IDs in `manifest.json`, back up any wanted test output, and remove **only those fixture records** before reimporting. Do not empty collections or apply this to historical data.

The imported membership IDs deliberately use the `ybb_demo_v1_` namespace to exercise compatibility with older membership IDs. Runtime operations may create hashed `conv_*` memberships, new orders, messages and rate counters that are not in the manifest. After exercising writes, the manifest alone is not a complete reset: use a fresh test environment or explicitly review those additional test-owned records. Never expand deletion to unrelated records just to make fixture counts match.

新生成文件不能覆盖旧目录；云端复位也不会自动执行。实际操作产生的订单、会话或频控记录不一定带演示前缀，不能仅凭前缀推断“已经完全清空”。
