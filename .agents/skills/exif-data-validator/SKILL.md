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
npm run validate:exif
```

## Details
* Script Location: `/.agents/skills/exif-data-validator/scripts/validate-exif.ts`
