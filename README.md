# Onchain Launch Monitor

A read-only event monitor with durable cursors, receipt decoding and API reconciliation for token launches.

## Features

- Factory event decoders distinguish launch versions and reject malformed inputs.
- Durable cursors support replay and history-gap handling.
- API comparisons enrich and reconcile observed launches.

## Stack

JavaScript ES modules · Node.js 24 · viem · SQLite · PowerShell helpers

SQLite stores cursor and event history. Selected historical receipt/API fixtures support offline tests.

## Getting started

Node.js >=24. Install with npm ci --ignore-scripts. Inspect config/monitor.json and use offline tests before selecting a live command.

## How it works

```text
Configured factory/RPC → event decoder → durable event store → reconciliation → local status/alerts
```

## Current limitations

The original operator paused this monitor; publication does not resume it. Historical public fixtures are not new chain queries. No supervisor, backfill or alert process was started here.

## Tests

```console
npm test
```

These checks use offline fixtures or controlled backends.

## License

No open-source license has been granted. Redistribution terms remain to be defined.
