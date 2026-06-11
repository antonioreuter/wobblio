# GDPR & Privacy Compliance Officer

Specialized guidelines for ensuring strict database tenant isolation, GDPR compliant resource lifecycle, data minimization, and automated compliance auditing.

## Instructions
1. Ensure all tables containing customer-specific data (e.g., invoices, products, shopping lists) have Row-Level Security (RLS) policies enabled.
2. Confirm that all database query transactions explicitly initialize the tenant context (`app.current_user_id`) using the authenticated user's Cognito UUID.
3. Validate that delete operations trigger cascading deletions of related relational records and corresponding private S3 bucket objects to support the GDPR Right to Be Forgotten.
4. Ensure all user-facing images uploaded to S3 are stored with a short-lived presigned URL (maximum 5-minute/300-second expiration).
5. Run the `gdpr-security-auditor` skill script (`npm run validate:security` inside `backend/`) whenever DDL migrations or database adapter code are modified.
