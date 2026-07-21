# Archive Manifest

The single source of truth for **what a semester archive captures and what it
deliberately excludes.** A semester archive is a point-in-time snapshot of the
authoritative MongoDB data (see [ARCHITECTURE.md](ARCHITECTURE.md), "Balance
authority") for one class, stored as one `SemesterArchive` document and rendered
read-only on the public Archive page.

> **Registration rule:** any new page or model MUST be added to this manifest —
> as captured or explicitly excluded — in the same PR that introduces it. This
> rule is mirrored in [CLAUDE.md](CLAUDE.md).

Capture and preview live in [backend/routes/archive.js](backend/routes/archive.js);
the archive shape is [backend/models/SemesterArchive.js](backend/models/SemesterArchive.js);
the read-only viewer is [frontend/src/pages/Archive.js](frontend/src/pages/Archive.js).

## Captured collections

| Source collection | Scope filter (what counts as "this semester") | Stored in archive as | Read-only page |
|---|---|---|---|
| `profiles` | `archived != true` | `profiles[]` | Profiles tab |
| `projects` | `archived != true` | `projects[]` | Projects tab |
| `posts` | `hidden != true` | `posts[]` | Forum tab |
| `comments` | `archived != true` | nested inside `posts[].comments` | Forum tab (under each post) |
| `transactions` | all rows | `transactions[]` | Explorer tab |
| `bounties` | all rows | `bounties[]` | *(captured; no dedicated tab yet — see Known gaps)* |
| `predictions` | `archived != true` | `predictions[]` | Predictions tab |
| `systemsettings` (prediction flags only) | keys `predictionEnabled2/3/4` | `predictionSettings{}` | Predictions tab (Open/Closed badge) |
| *(derived from `projects`)* | top 3 by `totalReceived`, projects 1–4 | `leaderboard[]` | Leaderboard tab + Overview |

`stats{}` holds the counts of each of the above (`totalProfiles`, `totalProjects`,
`totalPosts`, `totalComments`, `totalTransactions`, `totalBounties`,
`totalPredictions`, `totalCritCoinTransferred`).

### Predictions — what "the market" means here

Predictions have **no resolution or payout record** in this system. A prediction
is a single position: `predictorWallet → predictedWallet` for a given
`projectNumber` (2, 3, or 4), with a `createdAt`. The *winner* is simply rank 1
of that project's leaderboard snapshot; the only "market" metadata that exists is
whether each project's round was open, which is captured from
`SystemSettings.predictionEnabled{N}` into `predictionSettings`. There are no
payouts/settlements to capture because the game does not create any.

## Explicitly excluded collections

| Collection | Why excluded |
|---|---|
| `whitelists` | The class roster is **admin intent that persists across semesters**, not per-semester content. Like `bounties`, it is not cleared by `clear-current`. Not a snapshot. |
| `deploys` | Operational deploy-round tracking. The value it moves already lands in `transactions` (the authoritative ledger), which *is* archived. No student-facing history is lost. |
| `nonces` | Ephemeral auth challenge nonces. No historical meaning. |
| `systemsettings` (all keys except the prediction flags above) | Live configuration, not semester content. |
| `semesterarchives` | The archive container itself. |

## Clear-current behavior (post-archive reset)

`POST /clear-current` deletes `profiles` (except the admin wallet), `projects`,
`posts`, `comments`, `transactions`, and `predictions`. It does **not** delete
`bounties` (they persist across semesters) or `whitelists`. Bounties and the
whitelist are intentionally durable; everything else is per-semester.

## Preview and dry run (inspect before you mutate)

- **`GET /preview`** returns a live count for every captured type using the exact
  scope filters above. It **must remain declared before `GET /:archiveId`** in
  `archive.js` — Express matches in declaration order, and the `:archiveId`
  ObjectId route will otherwise capture the literal path `/preview` and 500 on
  `findById("preview")`, making every count read 0. The same ordering rule
  applies to any future literal GET path added to this router.
- **`POST /create` with `{ dryRun: true }`** builds the *entire* archive document
  in memory, validates it against the schema, and returns the real stats it would
  write — **without persisting anything**. Use it to confirm capture completeness
  (not just counts) before a real run. A real run is `POST /create` with a `name`
  and no `dryRun`.

## Known gaps (tracked, not yet closed)

- **Bounties have no dedicated read-only tab** in `Archive.js`, though they are
  captured and counted. Add a Bounties tab when this is prioritized.
- **Overview stat cards** omit `totalBounties` and `totalPredictions` even though
  `stats` holds them.
