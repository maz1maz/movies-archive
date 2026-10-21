# Cinefilm Archive — notes for Claude

## Deploying (read before any deploy)

Production is the Cloudflare Worker `movies-archive` (`wrangler.jsonc`). Cloudflare Workers Builds deploys `main` automatically on every push or merge to `main`.

**Rule: production must always be built from `main`, and all work must reach `main` before it ships.**

On 2026-10-21, 97 commits on `claude/sharp-shannon-ok4yio` (Oct 7–18) had been deployed straight from that branch and were never merged. The next deploy from `main` silently removed all of them from the site. They were restored by merging the branch (maz1maz/movies-archive#73).

Before deploying, or before merging anything that triggers a deploy:

1. Run `git fetch origin` and check for branches with unmerged work. Use `git cherry origin/main <branch>`, not `rev-list --count`. Branches are squash-merged, so commit counts overstate what is missing. Any `+` line on a branch active in the last 30 days must be merged or explained first.
2. Never run `wrangler deploy` from a feature branch. Merge to `main` (a PR is fine) and let the `main` build deploy.
3. `npm run deploy` runs `scripts/pre-deploy-check.mjs`. Its first check enforces the two points above: it fails off `main`, when HEAD is ahead of or behind `origin/main`, or when a recent branch has unmerged commits. Overrides (`ALLOW_BRANCH_DEPLOY=1`, `ALLOW_UNMERGED_BRANCHES=1`) are for deliberate exceptions only. In CI these checks only warn.
4. After a deploy, confirm the live bundle hash matches the local build. The site serves `assets/index-<hash>.js`.

From a Claude Code cloud session, `wrangler deploy` can't upload changed static assets (the proxy-injected Cloudflare token makes the asset upload return 401). Ship through a PR to `main` instead.

## Conventions

- Code comments are in Persian. Match the surrounding style.
- Squash-merge feature PRs. Use a merge commit when bringing a long-lived branch back in, so its history is kept.

## Working with the owner

- Don't end replies with a list of suggestions to approve one at a time; the owner finds that tiresome. Build small, clearly useful follow-ups directly in the same change and mention them in one line. Ask only before big or destructive decisions (removing a feature, bulk data changes, restructuring a page).
- Replies are in Persian, in short sentences.
