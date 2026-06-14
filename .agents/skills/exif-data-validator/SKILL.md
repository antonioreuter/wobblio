---
name: exif-data-validator
description: Scans project components and test data to verify that camera uploads strip EXIF metadata for GDPR compliance.
---

# EXIF Data Validator

Ensures that user uploads do not leak metadata (like location details, device serials, or timestamps) in compliance with the data minimization requirements of GDPR.

## Description
This skill verifies that:
- Flutter camera capture configuration integrates metadata stripping (using native configuration or Dart libraries).
- S3 upload modules reject raw unprocessed images or run metadata checks.
- Test suites check for EXIF presence in uploaded files.

## How to Use
Run the EXIF metadata check on project assets and upload adapters:
```bash
cd Source/backend && npm run validate:exif
```

Run this whenever camera capture, upload adapter, or S3 PUT code changes. Hard gate — do not commit on non-zero exit.

## Interpreting Output

| Output | Meaning | Action required |
|---|---|---|
| `[FAIL] EXIF strip not detected in upload adapter` | S3 adapter sends raw image bytes | Apply `sharp` or `piexifjs` strip before the S3 PUT call |
| `[FAIL] GPS tags present in test fixture` | Sample receipt image leaks location data | Strip EXIF from the fixture file, or add it to `.gitignore` |
| `[FAIL] Flutter capture missing metadata strip` | `image_picker` result used without stripping | Use `flutter_exif_rotation` or native strip before upload |
| `[WARN] Image exceeds 1MB` | Uncompressed upload; not a blocker but increases cost | Compress to ≤1MB JPEG before S3 PUT |
| Exit 0, no FAIL lines | All checks passed | Safe to commit |

## Details
* Script Location: `.agents/skills/exif-data-validator/scripts/validate-exif.ts`
