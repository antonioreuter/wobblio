## Purpose

Turns a user-supplied receipt photo or PDF into a stored, categorized invoice with itemized lines, and decides whether that receipt is trustworthy enough to contribute anonymized price points to the shared index.

## Requirements

### Requirement: Upload admission
The system SHALL admit an upload only after checking format, entitlement, novelty, and available credit, and SHALL reject an inadmissible upload before any AI cost is incurred.

#### Scenario: Unsupported file type
- **WHEN** a user requests an upload slot for a content type outside the allowed set
- **THEN** the request is rejected and no upload slot is issued

#### Scenario: PDF upload without a paid entitlement
- **WHEN** a user without premium entitlement requests an upload slot for a PDF
- **THEN** the request is rejected as requiring premium

#### Scenario: Re-upload of an image the tenant already submitted
- **WHEN** a user requests an upload slot whose image digest matches an existing invoice of the same tenant
- **THEN** the request is rejected as a duplicate and no AI processing occurs

#### Scenario: Credit allowance already consumed
- **WHEN** a user's projected weekly credit usage, including uploads still being processed, is at or above their cap
- **THEN** the request is rejected and the reported usage reflects the projected figure that tripped the cap

### Requirement: Time-limited, size-capped upload slot
The system SHALL issue an upload target that expires within 300 seconds and that rejects any file exceeding the configured per-format byte ceiling at transfer time.

#### Scenario: Upload slot expiry
- **WHEN** an upload slot is issued
- **THEN** it is unusable more than 300 seconds after issue

#### Scenario: Oversize file offered
- **WHEN** a client transfers a file larger than the ceiling for its format
- **THEN** the transfer is rejected without the bytes being retained

### Requirement: Household attribution of uploads
The system SHALL resolve the uploader's household server-side and stamp every upload with it, and SHALL record whether the shared pool or the personal counter backs the upload.

#### Scenario: Member of a multi-person household uploads
- **WHEN** a user belonging to a household with two or more members uploads a receipt
- **THEN** the invoice is stamped with the household and marked as backed by the shared pool

#### Scenario: Solo user uploads
- **WHEN** a user with no household, or a household of one, uploads a receipt
- **THEN** the invoice is stamped with the household if any, and marked as backed by the personal counter

### Requirement: Upload confirmation
The system SHALL queue a receipt for processing only after confirming the uploaded file actually arrived.

#### Scenario: File never landed
- **WHEN** a client confirms an upload whose file is not present at the expected location
- **THEN** the confirmation is rejected as stale and nothing is queued

### Requirement: Exactly-once processing
The system SHALL claim each uploaded file exactly once before doing any work, and SHALL take no action on a repeated delivery of the same file.

#### Scenario: Repeated delivery of an already-claimed receipt
- **WHEN** the processing pipeline receives a receipt whose file is already claimed
- **THEN** processing stops immediately, no model is invoked, and the invoice is left untouched

### Requirement: Pre-AI validation at processing time
The system SHALL re-verify size and page-count limits when processing begins, and SHALL fail the receipt before invoking any model when a limit is exceeded.

#### Scenario: Oversize file reaches the worker
- **WHEN** a queued file exceeds the byte ceiling for its format
- **THEN** processing fails with an oversize outcome and no model is invoked

#### Scenario: PDF exceeding the page limit
- **WHEN** a queued PDF contains more pages than the configured maximum
- **THEN** processing fails with a too-many-pages outcome and no model is invoked

### Requirement: Unreadable receipt handling
The system SHALL accept a model verdict that a receipt is illegible, fail the invoice with a user-facing reason, and stop before canonicalization.

#### Scenario: Model judges the image illegible
- **WHEN** the parse returns an unreadable verdict
- **THEN** the invoice is failed with that reason, the run is charged because a model executed, and the invoice remains deletable by its owner

### Requirement: Adaptive parse escalation
When a parse looks unreliable, the system SHALL re-parse the same file once on a stronger model and take the better result. Escalation SHALL fail open: it never degrades an outcome the primary model already produced.

#### Scenario: Low-quality primary parse with a stronger tier available
- **WHEN** a primary parse falls into an escalation band and a stronger tier is provisioned
- **THEN** the same file is parsed once more on that tier and the stronger result is used

#### Scenario: Requested tier is not provisioned
- **WHEN** the chosen escalation tier has no model configured but another stronger tier does
- **THEN** the available tier is used instead

#### Scenario: No escalation tier provisioned at all
- **WHEN** no stronger model is configured
- **THEN** the primary result is used unchanged and the receipt behaves exactly as an unescalated deployment

#### Scenario: Stronger model fails or regresses
- **WHEN** the escalated parse throws, or returns unreadable for a file the primary read successfully
- **THEN** the primary result is retained and the invoice is not failed

#### Scenario: Escalation is never chained
- **WHEN** an escalated parse itself looks unreliable
- **THEN** no further escalation occurs

### Requirement: Retake gate
When a photo's parse remains grossly broken after the strongest available model has run, the system SHALL ask the user to re-photograph it rather than canonicalize the result.

#### Scenario: Photo still unusable after escalation
- **WHEN** escalation is enabled, the file is a photo, and the parse remains grossly broken
- **THEN** the invoice is marked as needing a retake, later canonicalization stages are skipped, and their token cost is not incurred

#### Scenario: PDF parse is broken
- **WHEN** the same condition is met for a PDF
- **THEN** no retake is requested, because re-photographing is not meaningful for a PDF

### Requirement: Receipt location resolution
The system SHALL resolve each receipt to a country and region from the receipt text, the upload-time coarse geolocation, and the contributor's profile, in that order of preference, and SHALL hold the invoice for user confirmation when no source is conclusive.

#### Scenario: Coordinates supplied at upload
- **WHEN** a client supplies geolocation with the upload request
- **THEN** it is reduced to a coarse country and region and the precise coordinates are discarded

#### Scenario: Country known but region unmapped
- **WHEN** geolocation resolves a country whose region cannot be mapped
- **THEN** the country is retained and the region is left for the user to supply

### Requirement: Single user confirmation of location
An invoice awaiting location SHALL accept exactly one user confirmation, and only while its parse outcome permits contribution.

#### Scenario: Location confirmed for a mapped area
- **WHEN** the user confirms a country and region that exist in reference data
- **THEN** the invoice location is resolved and its deferred price observations are emitted

#### Scenario: Location confirmed for an unmapped area
- **WHEN** the user confirms an area absent from reference data
- **THEN** the location is stored, the invoice is held, and no observations are emitted until the area becomes mapped

#### Scenario: Second confirmation attempt
- **WHEN** a user confirms the location of an invoice whose location is already set
- **THEN** the request is rejected

#### Scenario: Invoice whose parse cannot contribute
- **WHEN** a user confirms the location of an invoice that is duplicated, still processing, or failed
- **THEN** the request is rejected and no observation is ever emitted for it

#### Scenario: Held area becomes mapped later
- **WHEN** reference data begins covering a held invoice's area
- **THEN** its observations are built from the stored lines and emitted, and the invoice becomes resolved

### Requirement: Receipt integrity gate
A receipt whose parse is not trustworthy SHALL contribute nothing to the shared price index, even though it is still stored for its owner.

#### Scenario: Arithmetic does not reconcile
- **WHEN** the parsed line totals do not reconcile with the printed total
- **THEN** the invoice is stored for its owner and emits no price observations

#### Scenario: Parse confidence below threshold
- **WHEN** overall parse confidence is below the minimum
- **THEN** the invoice emits no price observations

#### Scenario: Receipt resembles one already submitted
- **WHEN** the receipt matches an existing invoice on merchant, date, total, and line count
- **THEN** it emits no price observations

#### Scenario: Re-upload of a previously deleted contributing receipt
- **WHEN** a receipt whose digest already contributed observations is uploaded again after deletion
- **THEN** it emits no further observations, permanently

#### Scenario: New catalog entry is not an integrity failure
- **WHEN** a trustworthy receipt contains a product or merchant not yet in the catalog
- **THEN** the receipt still emits, and only the affected lines are withheld from serving until promotion

### Requirement: Review routing
The system SHALL route an invoice to human review when confidence is insufficient at the receipt, line, or merchant level, and mark it parsed otherwise.

#### Scenario: A single low-confidence line
- **WHEN** any line is normalized with low confidence
- **THEN** the invoice is routed to review

#### Scenario: Newly created merchant
- **WHEN** the receipt's merchant was created provisionally during processing
- **THEN** the invoice is routed to review

### Requirement: Processing progress visibility
The system SHALL expose the current processing stage to the uploading client while the receipt is being processed, and a lost progress update SHALL never fail an ingestion.

#### Scenario: Long-running parse stage
- **WHEN** the receipt enters the model-parsing stage
- **THEN** the stage is published before the model call begins, so the reported label is accurate during the wait

#### Scenario: Progress publication fails
- **WHEN** publishing a stage update fails
- **THEN** ingestion continues unaffected

### Requirement: Owner correction of a parsed receipt
The system SHALL let an invoice's owner correct its fields and lines while the invoice is in a correctable state, and SHALL mark the corrected receipt as human-confirmed for price-index purposes.

#### Scenario: Valid correction submitted
- **WHEN** the owner submits corrections with positive line quantities and non-negative totals
- **THEN** the corrections are stored, the invoice becomes parsed, and its later emissions are marked human-confirmed rather than automatic

#### Scenario: Invalid correction submitted
- **WHEN** a correction carries a negative total or a non-positive line quantity
- **THEN** the correction is rejected in full

#### Scenario: Invoice not in a correctable state
- **WHEN** a correction targets an invoice that cannot be corrected
- **THEN** the request is rejected

### Requirement: Deletion and data minimization
Deleting an invoice SHALL remove the stored receipt image, hide the invoice from its owner, and free the digest so the same image can be uploaded again. Already-emitted anonymized observations SHALL survive.

#### Scenario: Owner deletes a parsed invoice
- **WHEN** the owner deletes a deletable invoice
- **THEN** the image is removed, the invoice is hidden, the digest claim is released, and previously emitted anonymized observations are left untouched

#### Scenario: Deleting a quarantined invoice
- **WHEN** the owner attempts to delete an invoice held for operator reprocessing
- **THEN** the request is rejected, so deletion cannot be used to obtain a free re-scan

#### Scenario: Invoice belonging to another tenant
- **WHEN** a user attempts to delete an invoice they do not own
- **THEN** the invoice is reported as not found, disclosing nothing about its existence

### Requirement: Receipt sharing by expiring link
The system SHALL let an owner mint a share link for an invoice that expires after a bounded period, and the raw token SHALL be returned exactly once.

#### Scenario: Share created
- **WHEN** an owner creates a share for their invoice
- **THEN** a token is returned once, stored only in hashed and encrypted form, and expires within 7 days

#### Scenario: Invalid, revoked, or expired token presented
- **WHEN** a share token that is unknown, revoked, or past expiry is presented
- **THEN** access is refused without distinguishing which condition applied

### Requirement: Accuracy feedback
The system SHALL record an owner's accuracy verdict on a parsed receipt.

#### Scenario: Unrecognized verdict submitted
- **WHEN** a verdict outside the accepted set is submitted
- **THEN** the request is rejected

#### Scenario: Verdict on another tenant's invoice
- **WHEN** feedback targets an invoice the caller does not own
- **THEN** the invoice is reported as not found
