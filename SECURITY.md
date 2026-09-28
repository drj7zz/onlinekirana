# Security

## Reporting a vulnerability

Please do not post suspected vulnerabilities, credentials, or personal data in a
public issue. Use GitHub's private vulnerability reporting for this repository
when it is available. If private reporting is unavailable, contact the
maintainers privately through the contact details on the repository profile.

Include a description of the affected area and steps to reproduce. Do not include
real customer records or live credentials in a report.

## Secret handling

- Keep local `.env` files and production credentials out of Git.
- Use the `.env.example` files as templates and set production values in the
  hosting provider's secret manager.
- Treat any credential committed or shared accidentally as compromised: revoke
  or rotate it immediately. Removing it from the latest commit does not remove it
  from Git history or copies already made.
