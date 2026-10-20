# Onchain Launch Monitor

**Launch-event decoding, durable cursors and API reconciliation.**

![Language: JavaScript](https://img.shields.io/badge/Language-JavaScript-F7DF1E?style=flat-square&logo=javascript) ![Node.js: 24+](https://img.shields.io/badge/Node.js-24%2B-555555?style=flat-square) [![License: MIT](https://img.shields.io/badge/License-MIT-555555?style=flat-square)](LICENSE)

[Overview](#overview) · [Quickstart](#quickstart) · [Example](#example) · [Validation](#validation) · [Documentation](#documentation)

## Overview

A read-only event monitor with durable cursors, receipt decoding and API reconciliation for token launches.

**Stack:** JavaScript ES modules · Node.js 24 · viem · SQLite · PowerShell helpers

## An event remains replayable

| Component | Behavior |
| --- | --- |
| Decode | Factory-event decoders distinguish supported launch versions. |
| Resume | SQLite cursors and event history support replay and gap handling. |
| Reconcile | API comparisons enrich and cross-check observed launches. |

## Processing path

```mermaid
flowchart LR
  N0["Configured factory/RPC"]
  N1["event decoder"]
  N2["durable event store"]
  N3["reconciliation"]
  N4["local status/alerts"]
N0 --> N1 --> N2 --> N3 --> N4
```

## Quickstart

```console
npm ci --ignore-scripts
npm test
```

The commands above install prerequisites or run the specified offline checks. Live collection, cloud operations, messaging and trading are separate operational steps when present.

## Example

**Inspect the workflow**

Inspect a stored receipt fixture, identify its launch-version decoder and follow the normalized event into durable state. Then compare the API-reconciliation view. The original operator paused the live monitor; reading or publishing the source does not resume that process.

## Configuration and storage

Node.js 24+, viem and SQLite. [package.json](package.json) separates tests, status, monitoring, backfill and alerts. Review [config/monitor.json](config/monitor.json) before choosing an operational command.

## Repository guide

| Location | Responsibility |
| --- | --- |
| [src/monitor.mjs](src/monitor.mjs) | Live monitor entrypoint |
| [src/status.mjs](src/status.mjs) | Local status |
| [src/backfill.mjs](src/backfill.mjs) | Historical collection |
| [tests](tests) | Offline fixture suites |

## Validation

These checks use offline fixtures or controlled backends.

## Scope and operational boundaries

Historical receipt/API fixtures are recorded inputs, not new chain queries. Current factory coverage, backfill completeness and provider limits need operational verification.

## Documentation

- The repository guide above links directly to the implementation and configuration files.

## License and attribution

Project-authored source code is licensed under the [MIT License](LICENSE). Third-party components and datasets retain their respective rights and licenses.
