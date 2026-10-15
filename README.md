# Starlight content JSON

Write Markdown notes in `docs/` with YAML frontmatter at the very beginning of the file:

```markdown
---
title: Starlight
public: true
keywords: [moon, city, setting]
---

The note body goes here.
```

Run `npm install` once, then `npm run build:content` to generate JSON in `dist/`. Run `npm test` to check the generator. Only files with explicit `public: true` are included. `keywords` is optional and must be a list of strings. The generated body is Markdown with frontmatter removed; Obsidian-specific links and embeds are not converted.

In Obsidian, use a checkbox for `public` and a list for `keywords`. Quoting the whole value (such as `public: "true"` or `keywords: "[city, lore]"`) turns it into text, which the generator rejects.

`dist/index.json` lists `{ id, title, keywords, path }` for each public note. Each `path` points to a JSON file containing `{ id, title, keywords, body }`. IDs follow the note's path under `docs/`: `docs/New Bergen/Districts.md` becomes `new-bergen/districts`. Renaming or moving a note changes its ID and URL.

When this repository is pushed to GitHub, the workflow on `master` tests and builds the JSON, then publishes only generated files to the `content-data` branch. A consumer can fetch `https://cdn.jsdelivr.net/gh/OWNER/REPO@content-data/index.json` and then fetch a page using the returned `path`. Replace `OWNER/REPO` with the GitHub repository name. jsDelivr can cache branch URLs for up to 12 hours; purge its URL if an update must appear sooner.

This vault is intended to be in a public repository. `public: false` excludes a note from the generated JSON, but the original Markdown remains visible in the repository.
