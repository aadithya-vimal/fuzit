# Fuzit V1 Release Performance Baseline

**Status:** Normative V1 Performance Evaluation Report  
**Scope:** V1 Release Retrieval & Indexing Benchmarks Baseline  
**Environment:** Node.js v24.x, x64 / cross-platform

## 1. Summary

This document establishes the official internal V1 performance baseline. All candidate selection, indexing, context retrieval, and graph traversal operations are evaluated against accepted precision, recall, MRR, NDCG, and memory thresholds.

## 2. Evaluation Suites and Thresholds

| Metric                      | Target Threshold         | Baseline Observed Status        |
| --------------------------- | ------------------------ | ------------------------------- |
| Precision                   | ≥ 0.90                   | 1.00 (Pass)                     |
| Recall                      | ≥ 0.90                   | 1.00 (Pass)                     |
| NDCG                        | ≥ 0.90                   | 1.00 (Pass)                     |
| MRR                         | ≥ 0.90                   | 1.00 (Pass)                     |
| Memory (Heap Peak)          | < 1000 MB                | < 250 MB on 50,000 files (Pass) |
| Incremental vs Cold Rebuild | Incremental speedup > 2x | Pass                            |

## 3. Results File

The exact benchmark outputs and environmental identity are saved deterministically at `benchmarks/results/v1-release-baseline.json`.

## 4. Known Caveats & Regression Gate Policy

- Zero unexplained material metric regressions allowed.
- Zero secret leakage in any benchmark fixture or evaluated path.
- Hard byte and token budgets are strictly enforced per profile.
