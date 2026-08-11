# Security policy

## Supported versions

Security fixes are applied to the latest code on `main`. This project has not yet published a stable production release.

## Reporting a vulnerability

Please use GitHub private vulnerability reporting for this repository when available. If it is unavailable, contact the maintainer through the GitHub profile and request a private reporting channel without publishing exploit details.

Include, where possible:

- the affected page, Cloud Function, or data collection;
- prerequisites and minimal reproduction steps;
- the potential impact;
- a suggested mitigation;
- whether any real user data may have been exposed.

Please do not access data that is not yours, disrupt a deployment, or retain sensitive data while testing.

## Security boundaries

- Cloud Functions trust `OPENID` from the WeChat runtime, not identity fields supplied by pages.
- Conversation reads and writes require a matching membership document.
- Protected profile and order mutations are server-side operations.
- Model-provider keys belong in Cloud Function environment variables.
- Deployment owners are responsible for restrictive database and storage rules.

## Known limitations

- Mentor roles are self-selected in the current demonstration flow. Production operators must add identity verification and an approval state before granting access to student requests.
- The wallet is simulated and must not be connected to real payments.
- Uploaded videos may be shared with the configured external model provider through temporary URLs. Consent, retention, deletion, and vendor terms must be handled by the deployer.
- Rate limiting, abuse prevention, content moderation, audit logging, and automated deletion are not yet complete.

These limitations are tracked in [docs/ROADMAP.md](docs/ROADMAP.md).
