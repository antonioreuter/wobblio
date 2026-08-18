## Purpose

Gives operators the controls needed to keep the shared catalog and the ingestion pipeline healthy — promoting or rejecting provisional entities, merging duplicates, and reprocessing system-faulted receipts — without granting them access to any tenant's receipt content.

## Requirements

### Requirement: Operators never see tenant receipt content
Operator surfaces SHALL NOT expose the content of another tenant's receipt, nor any locator that would allow retrieving its stored image. Cross-tenant operator work SHALL be performed through narrowly scoped server-side operations only.

#### Scenario: Listing quarantined receipts
- **WHEN** an operator lists receipts held for reprocessing
- **THEN** each entry carries only its identifier, owner reference, fault reason, and timestamp, and the stored-image locator is removed before the response leaves the server

#### Scenario: Operator attempts to read invoice detail
- **WHEN** an operator requests the parsed contents of a tenant's invoice
- **THEN** the request is refused, because operator role does not confer tenant data access

### Requirement: Mutating operator actions are audited
Every operator action that changes state SHALL be recorded with the acting operator's identity, the action, the target, and the resulting state. Read-only operator activity SHALL NOT generate audit events.

#### Scenario: Operator approves a catalog entity
- **WHEN** an operator approves a provisional merchant or product
- **THEN** an audit entry records the operator, the action, the target, and the new status

#### Scenario: Operator browses the curation queue
- **WHEN** an operator lists or filters queues
- **THEN** no audit entry is written

### Requirement: Curation queue
The system SHALL present provisional merchants and products awaiting a promotion decision, always scoped to a country, with optional region and category filters and a bounded page size.

#### Scenario: Country not supplied
- **WHEN** a queue, category breakdown, or region breakdown is requested without a country
- **THEN** the request is rejected

#### Scenario: Page size beyond the maximum
- **WHEN** a page size above the permitted maximum is requested
- **THEN** it is clamped to the maximum

#### Scenario: Country selector
- **WHEN** an operator opens the queue
- **THEN** only countries that actually contain provisional items are offered

### Requirement: Corroboration status is visible
Each queue entry SHALL show how many distinct observations back it and whether it has reached the serving quorum, so promotion decisions are informed by corroboration rather than by name alone.

#### Scenario: Entity backed by enough observations
- **WHEN** a provisional entity has at least the quorum number of observations
- **THEN** it is presented as having met corroboration

#### Scenario: Entity below quorum
- **WHEN** a provisional entity has fewer observations than the quorum
- **THEN** it is presented as not yet corroborated, with its current count

### Requirement: Promotion and rejection move the price index
Approving an entity SHALL release its quarantined observations, and rejecting one SHALL quarantine them. Catalog status alone SHALL NOT determine what is served; serving is gated on the observations' quarantine state.

#### Scenario: Provisional product approved
- **WHEN** an operator approves a provisional product
- **THEN** its status becomes active and its quarantined observations are released for serving

#### Scenario: Provisional merchant rejected
- **WHEN** an operator rejects a provisional merchant
- **THEN** its status becomes inactive and its observations are quarantined, stopping them being served

#### Scenario: Unknown target
- **WHEN** an approve or reject targets an entity that does not exist
- **THEN** the request fails and no audit entry is written

### Requirement: Guarded catalog merge
A product merge SHALL be refused unless the two products share a category, a unit, and a merchant, and their similarity clears the configured floor. A refusal SHALL name the failing guard.

#### Scenario: Category mismatch
- **WHEN** a merge is attempted between products of different categories
- **THEN** it is refused with a category-mismatch reason

#### Scenario: Cross-merchant merge
- **WHEN** a merge is attempted between products of different merchants
- **THEN** it is refused with a merchant-mismatch reason, because per-merchant identity forbids it

#### Scenario: Similarity below the floor
- **WHEN** the two products' similarity is below the floor, including when similarity cannot be computed
- **THEN** it is refused with a low-similarity reason

#### Scenario: Source equals target
- **WHEN** a product is merged into itself
- **THEN** it is refused

#### Scenario: Permitted merge
- **WHEN** all guards pass
- **THEN** the merge is applied and the audit entry records which records moved, so the merge can later be traced and remediated

### Requirement: Best-effort merge groups
A merge group SHALL apply every compatible source and skip incompatible ones with a reason, rather than failing the whole group.

#### Scenario: Group with a mix of compatible and incompatible sources
- **WHEN** an operator commits a merge group where some sources fail a guard
- **THEN** the compatible sources are merged, and the rest are reported as skipped with their reasons

#### Scenario: Empty group
- **WHEN** a merge group is committed with no sources or no target
- **THEN** the request is rejected

#### Scenario: Compatibility preview
- **WHEN** an operator previews a candidate group against a chosen target
- **THEN** per-source compatibility is returned so incompatible rows can be flagged before commit

### Requirement: Alias remediation
An operator SHALL be able to deactivate a product alias that resolves receipts to the wrong product.

#### Scenario: Alias deactivated
- **WHEN** an operator deactivates an alias
- **THEN** it no longer resolves future receipts, and the action is audited against its product

#### Scenario: Unknown alias
- **WHEN** the alias does not exist
- **THEN** the request fails

### Requirement: System-fault quarantine and reprocessing
Receipts that failed for a system fault SHALL be held for operator reprocessing rather than charged to or deletable by their owner, and SHALL be re-runnable from the stored file.

#### Scenario: Operator reprocesses a held receipt
- **WHEN** an operator reprocesses a quarantined receipt
- **THEN** its processing claim is released, its quarantine is cleared, and it is re-queued so the run is charged and the owner is notified on success

#### Scenario: One receipt in a batch fails to re-queue
- **WHEN** a reprocess batch contains a receipt that is no longer held or cannot be re-queued
- **THEN** it is counted as skipped and the remaining receipts still proceed

#### Scenario: Receipt demoted as unprocessable
- **WHEN** an operator marks a hopeless receipt as unprocessable
- **THEN** it becomes an owner-deletable user fault and its owner is notified

#### Scenario: Owner notification fails
- **WHEN** notifying the owner of a demotion fails
- **THEN** the demotion still stands, because the state change is the source of truth and the notification is advisory

### Requirement: System-fault rate signal
The system SHALL report how many receipts were quarantined in the current week against a configured threshold, as an alert signal only.

#### Scenario: Threshold reached
- **WHEN** the week's quarantine count reaches the configured threshold
- **THEN** the faults view reports being over threshold

#### Scenario: Threshold has no gating effect
- **WHEN** the count is over threshold
- **THEN** ingestion continues unimpeded, because the signal is advisory and not a guard
