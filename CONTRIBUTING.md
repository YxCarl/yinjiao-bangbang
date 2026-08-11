# Contributing

Thank you for helping improve Yinjiao Bangbang. Contributions to documentation, tests, accessibility, privacy, and Mini Program workflows are welcome.

## Before starting

1. Search existing issues and pull requests.
2. Open an issue for a feature, data-model change, or behavioral change.
3. Do not include real student information, classroom recordings, credentials, cloud identifiers, or other confidential data.
4. Keep each pull request focused on one problem.

## Local workflow

1. Fork and clone the repository.
2. Create a branch such as `fix/message-membership-check`.
3. Configure your AppID and cloud environment only in local/private settings.
4. Make the smallest complete change.
5. Run:

   ```bash
   npm test
   ```

6. Manually exercise affected pages in WeChat Developer Tools.
7. Open a pull request using the repository template.

## Pull-request expectations

A useful pull request explains:

- the user or maintainer problem;
- the chosen approach and alternatives considered;
- how the change was tested;
- any new database collection, field, permission, external request, or data-retention behavior;
- screenshots for visible interface changes, with all personal data removed.

Generated code is welcome, but the contributor remains responsible for reviewing, testing, licensing, and explaining it.

## Coding conventions

- Use two spaces for indentation in JavaScript and JSON.
- Prefer server-side Cloud Functions for protected mutations.
- Derive identity from the Cloud Function context, never from a client-supplied user ID.
- Validate and bound client-supplied strings, numbers, file identifiers, and roles.
- Keep secrets in server-side environment variables.
- Preserve compatibility with the WeChat Mini Program runtime; avoid adding a build step without discussing it first.

## Reporting security issues

Do not open a public issue for a suspected vulnerability. Follow [SECURITY.md](SECURITY.md).
