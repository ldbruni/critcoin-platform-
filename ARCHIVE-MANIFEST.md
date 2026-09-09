# Archive Manifest

The single source of truth for **what a semester archive captures, and what it
deliberately excludes.** A semester archive is a point-in-time snapshot of the
authoritative MongoDB data (see [ARCHITECTURE.md](ARCHITECTURE.md), "Balance
authority") for one class, stored as one `SemesterArchive` document and rendered
read-only on the public Archive page.

This file exists because the archive has silently dropped data before. Most of
the capture is dynamic and needs no maintenance — but a few places **enumerate
project numbers by hand**, and those are exactly where a new project slot goes
missing without anyone noticing. They are listed below under
[Adding a project number](#adding-a-project-number).

Capture and preview live in [backend/routes/archive.js](backend/routes/archive.js);
the archive shape is [backend/models/SemesterArchive.js](backend/models/SemesterArchive.js);
the read-only viewer is [frontend/src/pages/Archive.js](frontend/src/pages/Archive.js).

## Captured collections

| Source collection | Scope filter (what counts as "this semester") | Stored in archive as | Read-only tab |
|---|---|---|---|
| `profiles` | `archived != true` | `profiles[]` | Profiles |
| `projects` | `archived != true` | `projects[]` | Projects |
| `posts` | `hidden != true` | `posts[]` | Forum |
| `comments` | `archived != true` | nested in `posts[].comments` | Forum (under each post) |
| `transactions` | all rows | `transactions[]` | Explorer |
| `bounties` | all rows | `bounties[]` | *(captured; no tab — see Known gaps)* |
| `predictions` | `archived != true` | `predictions[]` | *(captured; no tab — see Known gaps)* |
| *(derived from `projects`)* | top 3 by `totalReceived`, **per project number 1–5** | `leaderboard[]` | Leaderboard + Overview |

`stats{}` holds counts of each of the above: `totalProfiles`, `totalProjects`,
`totalPosts`, `totalComments`, `totalTransactions`, `totalBounties`,
`totalPredictions`, `totalCritCoinTransferred`.

Wallet addresses are resolved to display names **at snapshot time**, so archives
stay readable after the profiles behind them are deleted.

### What "per project" capture means

Project submissions are captured by a single unfiltered query over `projects` —
every project number rides along automatically, with its `title`, `description`,
`image` (Cloudinary URL), `totalReceived`, and resolved `authorName`. Tips and
investments are not stored per project; they are ordinary `project_tip` rows in
`transactions`, captured wholesale, and their value is also reflected in each
project's `totalReceived`.

The **leaderboard is the exception**: it is derived, not copied, by a loop over
an explicit range of project numbers.

## Adding a project number

Project numbers are hardcoded — there is no registry. Adding one means editing
every site below **in the same change**, or the new project is silently
incomplete. Verified against Project 5.

| File | What to extend |
|---|---|
| [backend/models/Project.js](backend/models/Project.js) | `projectNumber` schema `max:` — the hard gate; a write above it is rejected |
| [backend/routes/projects.js](backend/routes/projects.js) | live leaderboard loop, `GET /:projectNumber` bounds, `POST /` bounds |
| [backend/routes/archive.js](backend/routes/archive.js) | **archive leaderboard snapshot loop** — miss this and the archive holds the submissions but no leaderboard group |
| [frontend/src/pages/Projects.js](frontend/src/pages/Projects.js) | project tab bar |
| [frontend/src/pages/Leaderboard.js](frontend/src/pages/Leaderboard.js) | live leaderboard sections |
| [frontend/src/pages/Archive.js](frontend/src/pages/Archive.js) | **archived project tabs** — miss this and the data is captured but unreachable |
| [backend/routes/predictions.js](backend/routes/predictions.js) | validator bound and the `predictionEnabled*` settings keys, *if* the slot gets a prediction round |
| [frontend/src/pages/Prediction.js](frontend/src/pages/Prediction.js) | `PROJECTS`, *if* the slot gets a prediction round |
| [frontend/src/pages/Admin.js](frontend/src/pages/Admin.js) | prediction toggle list, *if* the slot gets a prediction round |

Not every slot has a prediction round: **Project 1 does not**. Predictions cover
projects 2–5.

## Explicitly excluded collections

| Collection | Why excluded |
|---|---|
| `whitelists` | The class roster is admin intent that **persists across semesters**, not per-semester content. Like bounties, it is not cleared by `clear-current`. |
| `deploys` | Operational deploy-round tracking. The value it moves already lands in `transactions` (the authoritative ledger), which *is* archived. |
| `systemsettings` | Live configuration, not semester content. Note this means the per-project prediction open/closed flags are **not** captured. |
| `semesterarchives` | The archive container itself. |

## Clear-current behavior (post-archive reset)

`POST /clear-current` deletes `profiles` (except the admin wallet), `projects`,
`posts`, `comments`, `transactions`, and `predictions`. It does **not** delete
`bounties` or `whitelists` — those are intentionally durable. Nothing on-chain is
touched; student wallets keep whatever CritCoin they hold on Sepolia.

## Known gaps (tracked, not yet closed)

- **`GET /preview` is shadowed and returns nothing usable.** It is declared
  *after* `GET /:archiveId` in `archive.js`, so Express matches the literal path
  `/preview` to the ObjectId route, `findById("preview")` throws, and the admin
  UI renders 0 for every count. It does **not** affect what `POST /create`
  captures. Any literal GET path added to this router must be declared before
  `/:archiveId`.
- **`GET /preview` does not count predictions**, even once un-shadowed.
- **Bounties and predictions have no read-only tab** in `Archive.js`, though both
  are captured and counted. The viewer's tabs are overview, profiles, projects,
  leaderboard, forum, explorer.
