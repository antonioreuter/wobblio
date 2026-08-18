## Purpose

Canonicalizes the merchants, products, and categories found on receipts into a shared catalog, and serves the crowdsourced regional price index that powers price comparison — without ever attaching a contributor's identity to a published price.

## Requirements

### Requirement: De-identified price observations
Emitted price observations SHALL carry no tenant, user, household, or invoice reference, and no free-text tags. Each observation SHALL record only product, merchant, coarse region, day-precision date, price, currency, and provenance flags.

#### Scenario: Observation emitted from a receipt
- **WHEN** a trustworthy receipt emits price observations
- **THEN** each row identifies the product, merchant, country, region, and observation date, and contains nothing that identifies the contributor or the source invoice

#### Scenario: Contributor has opted out of the shared index
- **WHEN** a receipt is processed for a contributor who opted out
- **THEN** no observations are emitted at all

#### Scenario: Merchant could not be resolved
- **WHEN** a receipt yields no merchant
- **THEN** no observations are emitted

### Requirement: Receipt-verbatim pricing
The price signal SHALL be the pack price computed from the receipt as line total divided by quantity. The system SHALL NOT derive, store, or gate on a normalized per-unit price.

#### Scenario: Line with no printed pack size
- **WHEN** a purchased line does not state its pack size
- **THEN** it still emits an observation on its pack price alone

#### Scenario: Pack size is known
- **WHEN** a line's pack size is known
- **THEN** the size enriches the record but does not determine whether the line is emitted

#### Scenario: Non-purchase line
- **WHEN** a line is a deposit, fee, has no resolved product, or has a non-positive quantity or total
- **THEN** it emits no observation

### Requirement: Discount detection
A line SHALL be marked discounted only when the price actually paid per pack is measurably below the price the receipt itself lists.

#### Scenario: Paid below the listed unit price
- **WHEN** the computed pack price is below the receipt's listed unit price by more than a rounding tolerance
- **THEN** the observation is marked discounted

#### Scenario: Receipt lists no unit price
- **WHEN** the receipt states no listed unit price for the line
- **THEN** the observation is not marked discounted, because the comparison cannot be made

### Requirement: Provenance of an observation
Each observation SHALL record whether a human confirmed the receipt and the contributor's trust score at write time.

#### Scenario: Receipt corrected by its owner before emission
- **WHEN** the owner corrected the invoice before its observations were emitted
- **THEN** the rows are marked human-confirmed rather than automatic

#### Scenario: Receipt processed without human review
- **WHEN** no correction was made
- **THEN** the rows are marked automatic

### Requirement: Merchant canonicalization
The system SHALL resolve a receipt's merchant text to a catalog merchant by exact alias, then by fuzzy match, then by model-assisted matching against brand candidates, and SHALL create a provisional merchant only when none matches.

#### Scenario: Exact alias hit
- **WHEN** the normalized merchant text matches a known alias in the receipt's country
- **THEN** that merchant is used with no model invocation

#### Scenario: Fuzzy match that is clearly ahead of its runner-up
- **WHEN** the best fuzzy candidate clears the similarity floor and leads the runner-up by more than the confidence margin
- **THEN** it is used, and its brand name is written back as an alias so later receipts hit the exact path

#### Scenario: Fuzzy match too close to call
- **WHEN** the best candidate does not lead the runner-up by the required margin
- **THEN** it is rejected and resolution falls through to model-assisted matching

#### Scenario: No catalog match at all
- **WHEN** no existing merchant matches
- **THEN** a provisional merchant is created and the invoice is routed to review

#### Scenario: Alias write-back stores the brand, not the receipt header
- **WHEN** an alias is written back after a fuzzy or model-assisted match
- **THEN** the stored alias is the resolved brand name, so per-store and per-city header variants do not accumulate

### Requirement: Per-merchant product identity
A catalog product SHALL belong to exactly one merchant. Products SHALL NOT be compared across merchants on identity alone.

#### Scenario: Product variant split by a user
- **WHEN** a user splits a product into a new variant
- **THEN** the variant inherits the parent's merchant

#### Scenario: Legacy product with no merchant
- **WHEN** a split is attempted on a product that predates per-merchant identity and carries no merchant
- **THEN** the split is refused until the product has been assigned a merchant

### Requirement: User-driven product split
Splitting a product SHALL be an explicit user action that re-homes only the caller's own purchase lines, and SHALL NOT retroactively alter other contributors' data or already-published observations.

#### Scenario: Valid split
- **WHEN** a user names a new variant and selects at least one of their own purchase lines
- **THEN** a new product is created under the same merchant, the selected lines move to it, and confirmed aliases are written so future receipts resolve correctly

#### Scenario: Split with no name or no lines
- **WHEN** the variant name is blank or no lines are selected
- **THEN** the split is refused

#### Scenario: Other contributors' history
- **WHEN** a split completes
- **THEN** other tenants' lines and the published observation store are left unchanged, and re-home naturally as future receipts resolve through the corrected aliases

### Requirement: Invoice categorization
The system SHALL categorize an invoice from the merchant's catalog category when one exists, and SHALL fall back to a line-item vote and then a model tiebreak only for merchants absent from the catalog. An invoice category SHALL always be a macro category.

#### Scenario: Merchant carries a catalog category
- **WHEN** the resolved merchant has a default category
- **THEN** that category's macro is used and neither the line vote nor the model runs

#### Scenario: Unknown merchant with a clear line-item majority
- **WHEN** no merchant category exists and the line-item vote is decisive
- **THEN** the vote's category is used without a model call

#### Scenario: Unknown merchant with an inconclusive vote
- **WHEN** the line-item vote is inconclusive
- **THEN** a model tiebreak resolves it, and its answer is reduced to a macro category

#### Scenario: Receipt identified as a restaurant bill
- **WHEN** the parse identifies the document as a restaurant bill
- **THEN** the invoice is categorized as dining out regardless of its lines

### Requirement: Deterministic deposit and discount categorization
Deposits, fees, and negative-total lines SHALL be categorized structurally, overriding any model-assigned leaf category while preserving the model's macro category.

#### Scenario: Deposit line
- **WHEN** a line is flagged as a deposit or fee
- **THEN** its category is set to the deposit bucket of its macro category

#### Scenario: Negative-total line
- **WHEN** a line's total is negative
- **THEN** its category is set to the discount bucket of its macro category

### Requirement: Provisional catalog entries are quarantined on write
Observations referencing a provisional merchant or product SHALL be written quarantined, and SHALL become servable only when the referenced entities are promoted.

#### Scenario: Observation for a newly created product
- **WHEN** a receipt line resolves to a provisional product
- **THEN** its observation is written quarantined and does not appear in any served price series

#### Scenario: Entity promoted afterwards
- **WHEN** a provisional merchant or product is promoted
- **THEN** its quarantined observations are released and become eligible for serving

#### Scenario: Entity rejected afterwards
- **WHEN** a provisional merchant or product is rejected
- **THEN** its observations are quarantined and stop being served

### Requirement: Serving quorum
A market price cell SHALL be served only when it is backed by at least 3 distinct observations at read time. Quorum SHALL be evaluated on the observations themselves, not on catalog entity status.

#### Scenario: Cell below quorum
- **WHEN** a product and merchant combination in a region has fewer than 3 qualifying observations
- **THEN** no market line is served for it

#### Scenario: Quarantined observations do not count toward quorum
- **WHEN** a cell's observations are quarantined
- **THEN** they do not contribute to quorum and the cell is not served

### Requirement: Market trend serving
The system SHALL serve the public market trend only to entitled callers, over a bounded recent window, and SHALL restrict a single view to one currency so prices are never blended across currencies.

#### Scenario: Caller without market entitlement
- **WHEN** a caller who is not entitled requests a comparison
- **THEN** no market lines are returned and the reason is reported as requiring premium

#### Scenario: Observations exist only in another currency
- **WHEN** in-window observations exist for a product but only in a currency other than the view currency
- **THEN** no market line is served and the reason is reported as a currency mismatch

#### Scenario: Country not mapped to a currency
- **WHEN** the requested country has no known currency
- **THEN** the view currency is inferred from the caller's own receipts first, and only then from the public store

### Requirement: Own purchase history is never gated
A caller's own purchase history SHALL always be served, without quorum, entitlement, or catalog-promotion gates.

#### Scenario: Product only the caller has ever bought
- **WHEN** a caller requests a trend for a product no one else has scanned
- **THEN** their own purchase series is served even though no market line qualifies

#### Scenario: Caller is not entitled to the market view
- **WHEN** a non-entitled caller requests a comparison
- **THEN** their own history is still served in full

### Requirement: Freshness honesty
Every served series SHALL be annotated with the age of its most recent point, and SHALL be marked stale once that age exceeds the staleness window.

#### Scenario: Series with no recent observation
- **WHEN** the most recent point in a series is older than the staleness window
- **THEN** the series is returned marked stale together with its age in days

#### Scenario: Caller's own long-unbought product
- **WHEN** the caller last bought a product months ago
- **THEN** their own series is marked stale on the same basis as a market series

### Requirement: Empty-result diagnostics
When a requested product yields no line, the system SHALL report why, distinguishing entitlement, absence of data, window, currency, and quorum.

#### Scenario: Nothing scanned in the region
- **WHEN** no observation exists for the product in the region
- **THEN** the reason is reported as no observations in region

#### Scenario: Data exists but predates the window
- **WHEN** all observations for the product are older than the serving window
- **THEN** the reason is reported as out of window

#### Scenario: Data exists but is short of quorum
- **WHEN** in-window observations exist but no merchant reached quorum
- **THEN** the reason is reported as below quorum, together with how many merchants and how close the best cell came

### Requirement: Comparison request bounds
The system SHALL bound and validate comparison requests.

#### Scenario: No product selected
- **WHEN** a comparison is requested with no products
- **THEN** the request is rejected

#### Scenario: Too many products selected
- **WHEN** more products are requested than the per-view maximum
- **THEN** the request is rejected

#### Scenario: Region omitted
- **WHEN** a comparison is requested without a country and region
- **THEN** the request is rejected, because a price series is meaningless without a region
