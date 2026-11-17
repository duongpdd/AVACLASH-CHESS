# AvaClash interface refresh

## Product and source

The target product is **AvaClash Cup**, the tournament platform in [duongpdd/AVACLASH-CHESS](https://github.com/duongpdd/AVACLASH-CHESS). GitHub's default branch `main` and the local base both resolve to `64169ad0f1f9c52b019230188b5ad7ddac7531b7` (verified through the GitHub connector on 2026-11-10).

The previous preview mistakenly ran the old 1v1 configuration: `.env.local` had no tournament contract address. The homepage now always presents the Cup product. Missing contract configuration shows a Cup setup state rather than falling back to the legacy staking lobby.

## Design reference

Applied [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), inspected at commit `6ae86f6` on 2026-11-10. The reference checkout is outside this repository, under the parent workspace's `.design-tools` directory.

Queries run against the reference's Python search tool:

- `chess gaming tournament competitive --design-system --density 5 --variance 5`
- `minimalism editorial --domain style -n 1`
- `responsive layout --stack nextjs`

The gaming query recommended a feature showcase, clear action hierarchy, and an immersive presentation. Its heavy 3D effects were unsuitable for this chess application. The verified Minimalism & Swiss Style result supplied the grid, whitespace, restrained motion, and type hierarchy. The implementation uses the user's galaxy-purple image reference, local Vietnamese font, and semantic theme tokens.

## Implemented direction

- Midnight purple backgrounds (`#160D2B`), deep purple cards (`#271A43`), violet actions (`#A78BFA`), and lavender-white text (`#F5EFFF`). Light mode uses a pale lavender background and darker violet for readable text and buttons.
- Soft violet and pink radial lighting on public-page backgrounds, inspired by the reference image.
- Muted purple-gray board squares in the homepage illustration, puzzle board, and default Phaser board. Light pieces use lavender-white, and dark pieces use deep purple with a light outline. Last moves, selection, and the promotion dialog use lavender/violet; custom cosmetic skins retain their existing resolution rules.
- A restrained violet glow appears on primary-button hover.
- Wider public layouts, clearer headings, consistent surface and button radii.
- A static SVG/CSS opening-position illustration that uses existing Lucide icons and adds no rendering dependency.
- A prominent opening panel with a larger headline, violet lighting, subtle orbital decoration, and a larger perspective chess illustration. The open tournament follows immediately, then organizer/sponsor actions, the three-step workflow, and player rankings. The decorative board is hidden on narrow screens.
- Sponsorship has its own directory entry, filtering to tournaments whose registration window is still open. Its detail link expands the funding instructions and offers guests a contextual wallet-login link. Existing connected-wallet eligibility and transaction guards remain in force.
- Organizer login explains what to prepare. Sponsor login returns to the selected tournament; both explain connection, signing, and the separate transaction fees, with a public browsing alternative.
- Primary navigation opens the tournament directory and the existing protected creation route. The public navigation offers rankings instead of the legacy Vault.
- Cup branding and metadata, format/entry facts, a funded-tournament section, real Elo data, and a three-step organizer/player/referee workflow.
- Puzzle and same-device play remain available as secondary warm-up options.
- Consistent header, branding, preferences, and footer across existing routes.
- A keyboard skip link, visible focus, 44px preference controls, and existing reduced-motion rules.
- Contract availability and transaction guards remain in force. Missing Cup configuration is explained in a tournament-specific empty state.
- Vietnamese and English copy for all new product text.

Chess rules, wallet signatures, fees, registration, and contract hooks retain their existing behavior.

## Validation

- Production build: `pnpm --filter web build` passed, including TypeScript and generation of all 23 pages.
- ESLint: `node node_modules/eslint/bin/eslint.js src` passed from `web`.
- Current discovery revision: 25 tests passed across home identity/configuration and section-order regressions, sponsorship filtering, contextual login and safe return URLs, tournament catalog, creation form, valid/invalid tournament links, and translation parity.
- The new homepage regression tests cover both configured and unconfigured Cup states, and verify that missing configuration never exposes the staking lobby or a Vault navigation link.
- Browser: the actual local contract supplied an open funded tournament with 2/8 players and a running tournament with 8 players and 28 scheduled games.
- Browser: verified the directory, tournament detail, round-robin schedule, organizer preparation screen, sponsorship-only directory, expanded guest funding instructions, and contextual sponsor login preserving the selected tournament.
- Browser: the current Cup homepage at 375px had equal document scroll/client widths, with no horizontal overflow.
- Base text-token contrast ratios:

| Pair | Light | Dark |
| --- | ---: | ---: |
| Body / background | 14.24:1 | 16.58:1 |
| Muted text / card | 6.32:1 | 7.20:1 |
| Primary text / card | 7.04:1 | 5.87:1 |
| Button text / primary | 7.04:1 | 6.42:1 |

These ratios cover the named solid token pairs, not a complete accessibility audit of every existing component.

The galaxy-purple board palette also passed 18 earlier tests covering cosmetic theme resolution, Phaser rendering, puzzle controls, and same-device play. Existing rendering-color expectations were updated to the new default palette.

## Running the correct preview

Run the repository's supported `node scripts/dev-tournament.mjs --seed` command, then open `http://127.0.0.1:13000/`. It supplies the Cup address and uses its own Anvil RPC on port 18545 and relay on port 18080 without rewriting existing environment files. Stop any other Next.js dev server for this directory before starting it.

For this review, an additional open-registration fixture was created on that isolated Anvil using the ignored `.local/seed-cup-preview.mjs` helper. It checks chain ID 31337 and expects exactly the seeded demo tournament before making changes. Fixtures use local test balances. No Fuji or production transaction was submitted. Elo is empty because the sample tournaments have not finalized; no player statistics are fabricated.

Screenshots are saved in the ignored `.local/ui-redesign/` directory. The `cup-*.jpg` files show the corrected tournament product. Earlier screenshots preserve palette experiments on the incorrect 1v1 preview.
