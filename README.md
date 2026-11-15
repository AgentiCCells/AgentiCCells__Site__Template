# AgentiCCells Site Template

The seed every site from the AgentiCCells site factory is created from (AgentiCCells__Site__Factory, stage FAC-004). Cut down from AgentiCCells__Website on 2026-11-15 by factory@AgentiCCells.dinis.

## What a site gets
- `content/*.md`: the pages, with `title`, `description` and optional `nav` front matter.
- `site.json`: the site's name, description and contact address (may be empty).
- `CNAME`: the site's domain. **The template has none**; the factory's seed step writes it. Without it, CI builds, checks and versions the site but does not deploy it.
- `build/build.mjs`: builds `site/`, with no dependencies. Page hooks go in `build/pages/*.mjs`.
- Gates: `build/validate.js` (structure, links, wording, key shapes, no third-party scripts), `build/leak-scan.mjs` (secret shapes), `build/check-commits.mjs` (every commit carries `Agent: role@AgentiCCells.person`).
- `.github/workflows/pages.yml`: on every push to `dev`, run the gates, deploy to GitHub Pages when `CNAME` exists, and tag the next `v0.1.N`.
- `team/release.sh`: run every gate with no pipes, rebase on `dev`, push, retry.
- `CLAUDE.md`: the team's rules, copied unchanged.

## Release
```
node build/build.mjs && node build/validate.js && node build/leak-scan.mjs
team/release.sh
```
Commit messages end with one trailer block, no blank lines inside it, starting `Agent: role@AgentiCCells.person`.

## What a person still does for a new site (until the factory automates it)
Set the default branch to `dev`; allow `dev` to deploy in the `github-pages` environment; set the Pages source to GitHub Actions; point DNS at GitHub Pages; verify the domain in the organisation. Source: map/site-creation.md in AgentiCCells__Website.

Licences: code Apache-2.0; text CC BY 4.0.
