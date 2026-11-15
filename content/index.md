---
title: A new AgentiCCells site
description: This site was created from the AgentiCCells site template. Its first page is a placeholder.
nav: 1
---
# A new AgentiCCells site

This site was created from the AgentiCCells site template. This page is a placeholder until the site's own content is written.

## How it is built

- **Files in git:** pages are Markdown in `content/`, built into `site/` by `build/build.mjs` with no dependencies.
- **Gates before every release:** the validator, the leak scan and a check that every commit names its agent.
- **Versioned by CI:** every push to `dev` that passes the gates deploys and takes the next version number.
