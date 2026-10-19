# Onchain Launch Monitor

> **Local private review:** publication is paused. See [security review and remaining release conditions](docs/SECURITY_REVIEW.md). Local fixes have not been pushed.


A read-only event monitor with durable cursors, receipt decoding and API reconciliation for token launches.

![review](https://img.shields.io/badge/review-private-374151) ![primary](https://img.shields.io/badge/primary-JavaScript-2563EB) [![LinkedIn](https://img.shields.io/badge/LinkedIn-Douglas%20Silva-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/douglas-silva-data-analyst/)

[Overview](#overview) · [Architecture](#architecture) · [Setup](#setup) · [Validation](#validation) · [Roadmap](#roadmap) · [Review notes](docs/REVIEW.md)

## Overview

- Factory event decoders distinguish launch versions and reject malformed inputs.
- Durable cursors support replay and history-gap handling.
- API comparisons enrich and reconcile observed launches.

**Technology:** JavaScript ES modules · Node.js 24 · viem · SQLite · PowerShell helpers

**Persistence and data:** SQLite stores cursor and event history. Selected historical receipt/API fixtures support offline tests.

## Architecture

```text
Configured factory/RPC → event decoder → durable event store → reconciliation → local status/alerts
```

| Location | Review focus |
| --- | --- |
| [`src/core.mjs`](src/core.mjs) | Source/configuration inspected for scope and structure |
| [`src/engine.mjs`](src/engine.mjs) | Source/configuration inspected for scope and structure |
| [`src/store.mjs`](src/store.mjs) | Source/configuration inspected for scope and structure |
| [`src/network.mjs`](src/network.mjs) | Source/configuration inspected for scope and structure |
| [`tests/monitor.test.mjs`](tests/monitor.test.mjs) | Source/configuration inspected for scope and structure |

Internal package and module names are retained where changing them would affect imports or compatibility. This descriptive repository name does not imply a completed package/API migration.

## Setup

Node.js >=24. Install with npm ci --ignore-scripts. Inspect config/monitor.json and use offline tests before selecting a live command.

Start from an isolated environment. Use `.env.example` when present and inspect the configuration loader: an example file is not necessarily loaded automatically. Runtime databases, real account sessions and private credentials are not bundled. Live integration prerequisites are separate from local tests.

## Validation

Static parsing checked 0 Python files and 3 strict JSON files. Python syntax errors: 0; JSON errors: 0. The selected offline suite passed.

```console
npm test
```

These results apply to the selected checks on the preparation copy. They do not establish deployment readiness, full coverage, live provider availability or measured performance. CI definitions, when present under `docs/ci-templates/`, are inactive review templates; no remote CI badge is claimed.

## Limits and current status

The original operator paused this monitor; publication does not resume it. Historical public fixtures are not new chain queries. No supervisor, backfill or alert process was started here.

This private snapshot is for code and portfolio review. Generated runtime material and unreviewed binary assets may be excluded. [Review notes](docs/REVIEW.md) record preparation scope, findings and outstanding validation.

## Roadmap

- [ ] Validate the fixture suite after dependency installation.
- [ ] Document a minimal configuration independent of original local paths.
- [ ] Review reorg, reconciliation and restart handling before a bounded live test.

## History and attribution

No recoverable original Git history was verified for this snapshot. Import and preparation commits use their actual current dates; filesystem timestamps are not treated as development dates.

No open-source license is granted by this preparation. A license and attribution review is required before public redistribution.

## Maintainer and feedback

Douglas de Oliveira Silva · [GitHub](https://github.com/qquante) · [LinkedIn](https://www.linkedin.com/in/douglas-silva-data-analyst/)

For this private review, report reproducible issues with a minimal fixture and the exact check output. Keep account data, credentials and generated sensitive reports out of issues and commits. Existing contribution guidelines apply where present.

**Topics:** `javascript`, `nodejs`, `sqlite`, `viem`, `blockchain`, `event-processing`, `monitoring`
