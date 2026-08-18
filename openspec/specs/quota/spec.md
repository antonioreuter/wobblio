## Purpose

Meters how much AI processing each user or household may consume per week, enforcing one credit allowance at upload time and charging the actual cost after processing succeeds.

## Requirements

### Requirement: Credit-based weekly allowance
Usage SHALL be metered in credits representing actual model token consumption, accumulated per calendar week, and SHALL NOT be metered as a count of invoices.

#### Scenario: Week boundary
- **WHEN** a new week begins
- **THEN** the accumulated counter resets and the full cap is available again

#### Scenario: Cheap and expensive receipts
- **WHEN** two receipts of very different processing cost are uploaded
- **THEN** they consume proportionally different amounts of the allowance

### Requirement: Single enforcement point
All allowance decisions SHALL be resolved by one shared rule so that the enforced allowance and the allowance displayed to the user can never diverge.

#### Scenario: Usage display and upload enforcement
- **WHEN** a user views their usage and then attempts an upload
- **THEN** the cap and counter shown are exactly the ones the upload is judged against

### Requirement: Soft-cap admission check
Admission SHALL be a read-only check that permits an upload while used credits remain strictly below the cap. Admission SHALL NOT write to the counter.

#### Scenario: Usage below the cap
- **WHEN** a user's used credits are below their cap
- **THEN** the upload is admitted and no counter is written

#### Scenario: Usage at or above the cap
- **WHEN** used credits have reached the cap
- **THEN** the upload is refused

#### Scenario: Unlimited allowance
- **WHEN** a user's cap is unlimited
- **THEN** every upload is admitted without reading the counter

### Requirement: In-flight projection
The admission check SHALL add a pessimistic projection for uploads still being processed, so a burst of concurrent uploads cannot all clear the cap before any of them is charged.

#### Scenario: Burst of concurrent uploads near the cap
- **WHEN** several uploads are admitted and still processing while another is requested
- **THEN** the in-flight uploads are projected at the average cost per receipt and counted against the cap

#### Scenario: Refusal reporting
- **WHEN** an upload is refused on the projected figure
- **THEN** the reported usage is the stored usage plus the projection that tripped the cap, not the cap itself

### Requirement: Charge on model execution
The counter SHALL be incremented once, after processing, with the tokens actually consumed. A run SHALL be charged whenever a model executed, including runs that ended in a user-fault failure.

#### Scenario: Successful processing
- **WHEN** a receipt is processed successfully
- **THEN** the actual token cost is added to the counter that admitted the upload

#### Scenario: Receipt judged unreadable
- **WHEN** a model ran and returned an unreadable verdict
- **THEN** the run is still charged, because the cost was genuinely incurred

#### Scenario: Failure before any model ran
- **WHEN** processing fails validation before invoking a model
- **THEN** nothing is charged

#### Scenario: Counter consistency across pool and personal
- **WHEN** a run is charged
- **THEN** it is charged to the same counter the admission check evaluated, as recorded on the invoice at upload time

### Requirement: Household pool allowance
When a user belongs to a household of at least two members, uploads to household space SHALL draw on an additive shared pool rather than the personal counter. The pool SHALL NOT borrow from any member's personal allowance.

#### Scenario: Household of two or more
- **WHEN** a member of a multi-person household uploads
- **THEN** the shared pool counter is evaluated and charged

#### Scenario: Household of one
- **WHEN** the only member of a household uploads
- **THEN** the personal counter is evaluated and charged

#### Scenario: Personal allowance is untouched by pool exhaustion
- **WHEN** a household pool is exhausted
- **THEN** members' personal allowances are neither consumed nor made available to cover the pool

### Requirement: Pool cap follows the household owner
The household pool cap SHALL be derived from the owner's role, so an owner with an unlimited personal allowance lifts the whole pool to unlimited.

#### Scenario: Owner holds an operator role
- **WHEN** the household owner's role carries an unlimited personal cap
- **THEN** the pool cap is unlimited for every member

#### Scenario: Owner role cannot be read
- **WHEN** the owner's role is unavailable
- **THEN** the caller's own role is used and the owner is treated as normally capped, never as unlimited

### Requirement: Configuration is fail-closed
Missing allowance configuration SHALL refuse uploads rather than defaulting to a permissive value.

#### Scenario: Cap configuration absent
- **WHEN** a required allowance parameter cannot be read
- **THEN** the upload is refused rather than admitted on a default
