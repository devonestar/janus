# Candidate Path Thin Fixture

## Goal

Reduce flaky deploys without a major rewrite.

## Constraints

- One maintainer
- No large architectural rewrite this quarter

## NFRs

- Reliability must improve
- Rollback must stay simple

## Assumptions

- Most flakes come from a small number of unstable steps

## Decision requested

Pick the most robust path.
