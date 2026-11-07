# 1. Record architecture decisions

- Status: Accepted
- Date: 2026-11-07

## Context

Design decisions need to stay discoverable as the app grows from a local tool to a product.

## Decision

Use lightweight ADRs (Michael Nygard format) in `docs/adr`, numbered sequentially. Superseded
ADRs are kept and marked as such.

## Consequences

Significant changes (data model, SG math, platform, CI/CD) come with an ADR in the same PR.
