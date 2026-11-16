# AgentiCCells Site Template

The seed every site from the AgentiCCells site factory is created from (AgentiCCells__Site__Factory, FAC-004). Its layout follows the site repositories made by hand by sites@AgentiCCells.dinis on 2026-11-16, which are live; the gates are the team's stronger versions.

## Layout
- `src/`: the site, copied to `_site/` by `scripts/build.mjs`, which replaces `__VERSION__` and writes `_site/version.json`.
- `hub.json`: the site's entry for the hub.
- `scripts/validate.mjs`: structure, links, wording, no third-party scripts, hub.json fields, no template placeholder in a seeded site.
- `scripts/leak-scan.mjs`: secret shapes over tracked files and `_site/`; skips the vault's ciphertext; fails on any file from `.sg_vault/local/`.
- `scripts/check-commits.mjs`: every commit carries `Agent: role@AgentiCCells.person`.
- `scripts/release.sh`: every gate with no pipes, rebase on `dev`, push, retry.
- `.github/workflows/pages.yml`: on every push to `dev`, the gates, then deploy to GitHub Pages and tag the next `v0.1.N`.
- `.gitignore`: keeps `.sg_vault/local/`, `.sg_vault/work/`, `*.pem` and `_site/` out of git. `.gitattributes` marks the vault store as binary.
- `CLAUDE.md`: the team's rules, copied unchanged.

## Placeholders
`__SITE_NAME__`, `__SITE_DESCRIPTION__`, `__SITE_REPO__` (owner/name) and `__SITE_DOMAIN__` appear in `src/` and `hub.json`. The factory's seed step replaces them and deletes `.factory-template`. While that file exists (the template itself), placeholders are allowed and CI builds, checks and tags but does not deploy.

## Release
```
node scripts/build.mjs && node scripts/validate.mjs && node scripts/leak-scan.mjs
scripts/release.sh
```

Licences: code Apache-2.0; text CC BY 4.0.
