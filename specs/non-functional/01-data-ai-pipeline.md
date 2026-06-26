# 01 — Agentic Ingestion Pipeline (Strands Agents Integration)

**Non-Functional Specification | Phase 3/5 | Parallel Agentic Invoice Ingest Workflow**

## Overview

This specification details the introduction of an alternative, agentic invoice processing pipeline built on the open-source AWS model-driven SDK, **Strands Agents** (`@strands-agents/sdk`). 

Rather than running the agentic workflow in the same execution context as the legacy 5-stage sequential pipeline (detailed in [07 — Core Ingestion Pipeline](../mvp/07-core-ingestion-pipeline.md) and [08 — Data Intelligence Layer](../mvp/08-data-intelligence-layer.md)), the agentic pipeline is deployed as a **completely standalone component** in its own CloudFormation/CDK Stack. 

Traffic is routed at the backend API confirmation layer: confirming an invoice enqueues a message to either the legacy SQS queue or the new dedicated Agentic SQS queue, triggering the respective isolated worker Lambda.

---

## 1. Architectural Integration & Port Isolation

To preserve Wobblio's strict dependency directionality (per [code-quality-guard.md](../../.claude/rules/code-quality-guard.md)), the backend API remains unaware of the internal workings of either pipeline. Instead, routing is handled dynamically during invoice confirmation by abstracting SQS enqueuing behind a domain port.

### Ingestion Queue Port

A new port `IInvoiceIngestionQueuePort` is defined in the core business layer:

```typescript
// Source/backend/src/core/ports/ingestion/IInvoiceIngestionQueuePort.ts
export interface IInvoiceIngestionQueuePort {
  /**
   * Enqueues a message to the processing queue.
   */
  enqueue(
    invoiceId: string,
    tenantId: string,
    s3Key: string
  ): Promise<void>;
}
```

### Ingestion Queue Adapter & Dynamic Routing

We implement the `SqsInvoiceIngestionQueueAdapter` in the infrastructure layer:
- The adapter reads the feature toggle parameter `/wobblio/config/features/agentic_pipeline_enabled` from AWS SSM Parameter Store (cached locally).
- If `agentic_pipeline_enabled` is `true`, it enqueues the message (`invoiceId`, `tenantId`, `s3Key`) to the new **Agentic SQS Queue**.
- If `agentic_pipeline_enabled` is `false`, it enqueues the message to the legacy **Legacy Ingestion SQS Queue**.

```
                           POST /invoices/{id}/confirm
                                      │
                                      ▼
                      SqsInvoiceIngestionQueueAdapter
                                      │
                Check SSM: /features/agentic_pipeline_enabled
                                      │
                     ┌────────────────┴────────────────┐
                     │ TRUE                            │ FALSE
                     ▼                                 ▼
           WobblioAgenticQueue                 WobblioLegacyQueue
             (Agentic Stack)                    (Backend Stack)
                     │                                 │
                     ▼                                 ▼
         Agentic Ingestion Worker            Legacy Ingestion Worker
          (Strands Agents SDK)               (5-Stage Serial Pipeline)
```

Both workers process the messages independently, update the same tenant database tables, and emit anonymized observations.

---

## 2. Infrastructure & CDK Deployment Stack

The agentic pipeline is defined in a new standalone CDK Stack class, `WobblioAgenticPipelineStack`. This stack is deployed separately from the main `WobblioBackendStack` to prevent dependency bloat and isolate compute resources.

### Stack Topology & Resources

The new stack defines the following resources:
1. **`WobblioAgenticQueue`** (AWS::SQS::Queue):
   - Message visibility timeout: 300 seconds (matching the Lambda timeout).
   - Dead-letter queue (DLQ) association.
2. **`WobblioAgenticDLQ`** (AWS::SQS::Queue):
   - Holds failed messages; triggers an alarm if messages exceed `0` for 5 minutes.
   - `maxReceiveCount`: 3.
3. **`WobblioAgenticWorkerLambda`** (AWS::Lambda::Function):
   - Node.js 24 runtime.
   - Subnet: Private subnets with RDS Security Group ingress.
   - Environment variables: DB secrets, SSM parameter paths, model registry configs.
   - SQS Event Source Mapping: Bounded to `WobblioAgenticQueue` with `maxConcurrency: 5` and `ReportBatchItemFailures: true`.

### IAM Least-Privilege Permissions

The `WobblioAgenticWorkerLambda` requires permissions to access shared resources across stacks:
- **RDS Database**: Ingress via RDS security groups to execute writes on tenant tables (`invoice`, `invoice_line`, `invoice_telemetry`) and the priceobservation table.
- **S3 Bucket**: Read access (`s3:GetObject`) to the shared invoices bucket in the backend stack.
- **AWS Bedrock**: Permission to invoke foundation models (`bedrock:InvokeModel` and `bedrock:Converse`) for vision parsing and agent reasoning.
- **AWS SSM**: Read access (`ssm:GetParameter`, `ssm:GetParametersByPath`) for `/wobblio/config/models/*` and `/wobblio/config/tags/*`.
- **KMS**: Decrypt permissions (`kms:Decrypt`) for database secrets and S3 bucket encryption keys (if customer-managed keys are configured).

---

## 3. Strands Agent Architecture

Inside the isolated `WobblioAgenticWorkerLambda`, processing is orchestrated using `@strands-agents/sdk` in a model-driven coordination pattern. The coordinator agent is configured with a system prompt detailing the target outcomes and provided with specialized tools.

### Coordinator Agent Configuration

The agent is instantiated dynamically, obtaining the active Bedrock Model ID from the SSM-managed `IModelRegistry`:

```typescript
import { Agent } from "@strands-agents/sdk";
import { z } from "zod";

const modelId = await modelRegistry.getModelId('vision_parser'); // e.g. Claude or Qwen

const invoiceAgent = new Agent({
  model: modelId,
  systemPrompt: `
    You are the Master Invoice Ingestion Coordinator. Your objective is to transform raw receipt images into structured, high-accuracy financial data.
    To do this, you must run the OCRParserTool to extract raw text and line items.
    Then, for the merchant and each product line item, you must invoke the resolution and normalization tools to canonicalize the entities.
    Finally, classify the overall receipt and generate search tags from the allowed vocabulary.
    
    Ensure all arithmetic balances (sum of lines matches total) before returning the final JSON schema-compliant result.
  `,
  outputSchema: ProcessedInvoiceSchema, // Structured output Zod validation
});
```

### Agent Tools

The agentic pipeline encapsulates existing domain service steps as specialized Tools using Strands' schema-driven tool structure:

1. **`OCRParserTool`**:
   - **Input**: S3 object key or image base64, plus file extension or MIME type (e.g. `.pdf` vs `.jpg`/`.png`).
   - **Execute**: 
     - Evaluates the input file type based on the file extension or S3 object metadata.
     - If the file is a PDF (extension `.pdf` or MIME type `application/pdf`), the tool queries `IModelRegistry.getModelId('pdf_parser')` (which maps to the SSM parameter `/wobblio/config/models/pdf_parser`) to resolve the Bedrock model ID for PDF processing (defaulting to Claude Sonnet 4.6).
     - If the file is a standard image (JPEG, PNG, etc.), the tool queries `IModelRegistry.getModelId('vision_parser')` (which maps to the SSM parameter `/wobblio/config/models/vision_parser`) to resolve the default vision model ID (defaulting to Qwen).
     - Invokes the resolved model in AWS Bedrock to parse the invoice, returning the raw JSON representation of the receipt (raw merchant string, date, tax, total, raw lines with totals, weights, and quantities).
2. **`MerchantResolverTool`**:
   - **Input**: Raw merchant string and country code.
   - **Execute**: Runs the canonical merchant resolution algorithm (VAT lookup, exact match, fuzzy similarity, or LLM fallback) and returns a canonical `merchant_id` + branch details.
3. **`ProductNormalizerTool`**:
   - **Input**: Array of raw product line items (name, category, price, quantity, size).
   - **Execute**: Processes the lines in batch, expanding abbreviations, performing `pgvector` embedding search for active product candidates, normalizes unit prices, and returns canonical `product_ids` and normalized prices.
4. **`InvoiceClassifierTool`**:
   - **Input**: Resolved merchant ID and resolved product line item categories.
   - **Execute**: Resolves the overarching invoice category using merchant default priors or spend votes.
5. **`SearchTagGeneratorTool`**:
   - **Input**: Canonical merchant, invoice category, and line item spend shares.
   - **Execute**: Evaluates deterministic trigger maps and picks up to 3 tags from the SSM-managed tag vocabulary.

---

## 4. Admin Console & Dynamic Control

To manage the transition between the two deployment stacks, we introduce controls and history tracking in the Admin Console.

### Admin Endpoint

- `POST /admin/features/toggle` — Update a feature flag (requires role `ADMIN` or `OPERATOR`).
  - Request body: `{ feature: 'agentic_pipeline_enabled', value: boolean }`
  - Action: Writes the new value to `/wobblio/config/features/agentic_pipeline_enabled` in SSM.
  - Audit log: Creates an entry in `admin_audit_log` with `action='feature.toggle'`, `details={ feature: 'agentic_pipeline_enabled', before: oldVal, after: newVal }`.

### UI Panel (`/admin/pipeline-toggles`)

A dedicated dashboard panel displays:
1. **Global Toggle**: A toggle switch to turn the agentic pipeline ON or OFF.
2. **Auditing History**: A list of recent toggle changes showing who changed it, the previous state, the new state, and the timestamp.
3. **Canary Guidance Alert**: A caution notice prompting operators to monitor the DOWN-ratio and latency KPIs for 30 minutes following any toggle event.

---

## 5. Telemetry & Cost Analysis

To compare performance and measure the ongoing infrastructure cost of processing invoices, both pipelines log structured telemetry and record run data in a dedicated database table. This enables cohort-level cost analysis to verify that users are not consuming more in LLM token fees than what they are paying for in subscriptions.

### Ingestion Telemetry Schema

A new table `invoice_telemetry` is created in the database to store execution-level performance and token consumption data:

```sql
CREATE TABLE invoice_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
  processed_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  pipeline_type VARCHAR(20) NOT NULL CHECK (pipeline_type IN ('LEGACY', 'STRANDS')),
  processing_ms INTEGER NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd NUMERIC(10, 4) NOT NULL,
  status VARCHAR(30) NOT NULL
);

-- Indexes for cohort and trend queries
CREATE INDEX idx_invoice_telemetry_tenant ON invoice_telemetry(tenant_id);
CREATE INDEX idx_invoice_telemetry_invoice ON invoice_telemetry(invoice_id);
CREATE INDEX idx_invoice_telemetry_date ON invoice_telemetry(processed_on);
```

### Row-Level Security (RLS)

Because `invoice_telemetry` holds user-specific transactional data (`tenant_id`), RLS is enabled on the table to preserve strict tenant isolation (per hard invariant #1):

```sql
ALTER TABLE invoice_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON invoice_telemetry
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
```

### GDPR Cascade Purge Compliance

In compliance with Wobblio's 30-day GDPR delete hard purge policy (detailed in [14 — GDPR & Data Lifecycle](../mvp/14-gdpr-data-lifecycle.md)), any deletion of a tenant's account must cascade-delete all associated rows in the `invoice_telemetry` table. This is handled at the database level by the `ON DELETE CASCADE` foreign key constraint on the `tenant_id` field.

### Telemetry Write Path

During the final phase of processing, inside the worker's unified database transaction, the worker writes the runtime statistics to the `invoice_telemetry` table:

```typescript
// Transactional write wrapper inside ingestion worker
await dbClient.query(`
  INSERT INTO invoice_telemetry 
    (tenant_id, invoice_id, pipeline_type, processing_ms, input_tokens, output_tokens, cost_usd, status)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`, [
  context.tenantId,
  invoiceId,
  'STRANDS', // or 'LEGACY'
  metrics.processingMs,
  metrics.tokensConsumed.input,
  metrics.tokensConsumed.output,
  metrics.costUsd,
  metrics.status
]);
```

In addition to the database write, a structured JSON telemetry log event is output to CloudWatch:

```json
{
  "event": "invoice_processed",
  "invoice_id": "inv_12345",
  "pipeline_type": "STRANDS",
  "processing_ms": 4250,
  "tokens_consumed": { "input": 1200, "output": 400 },
  "cost_usd": 0.015,
  "status": "PARSED"
}
```

### Cost Deficit Analysis (SQL Query)

Operators can execute the following query to identify "heavy-spender" cohorts whose LLM ingestion cost exceeds standard subscription tiers (e.g. €2.50 per month):

```sql
-- Identifies users whose total monthly API ingestion cost exceeds standard subscription tier limits
SELECT 
  t.tenant_id,
  u.role as current_subscription_tier,
  COUNT(t.invoice_id) as total_invoices_processed,
  SUM(t.cost_usd) as total_monthly_api_cost,
  SUM(t.input_tokens) as total_input_tokens,
  SUM(t.output_tokens) as total_output_tokens
FROM invoice_telemetry t
JOIN app_user u ON t.tenant_id = u.id
WHERE t.processed_on >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY t.tenant_id, u.role
HAVING SUM(t.cost_usd) > 2.50 -- Monthly standard tier subscription cost limit
ORDER BY total_monthly_api_cost DESC;
```

---

## 6. Nightly Rollup (`kpi_daily`) & UI Comparison

The EventBridge nightly rollup cron Lambda is updated to group ingestion telemetry by the `pipeline_type` dimension. The table `kpi_daily` will store metrics with this dimension:

```sql
-- Query example for side-by-side dashboard rendering
SELECT 
  metric_date,
  metric_name,
  dimensions->>'pipeline_type' as pipeline,
  value
FROM kpi_daily
WHERE metric_name IN ('avg_processing_time_ms', 'cost_per_invoice', 'needs_review_rate', 'feedback_down_ratio')
  AND metric_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY metric_date DESC, pipeline;
```

### Admin KPI Visuals

The KPI dashboard (per [08 — KPI Dashboard](../mvp/admin-console/08-kpi-dashboard.md)) is extended with a "Pipeline Performance Comparison" tab:
- **Comparison Cards**: Side-by-side cards showing:
  - Average Latency (Legacy vs. Strands)
  - Average Cost per Ingest (Legacy vs. Strands)
  - Review Rate (percentage of invoices routed to `NEEDS_REVIEW`)
  - Feedback Score (UP / DOWN ratio comparison)
- **Time-Series Charts**: Multi-line graphs showing the 90-day trend of latency and cost per invoice for both pipelines.

---

## 7. Exploratory Testing & LLM-as-a-Judge

Prior to enabling the agentic pipeline in production, we run local evaluation simulations comparing both approaches against ground truth data.

### CLI Evaluation Runner

A new test runner script is introduced: `scripts/evaluate-pipelines.ts` (runnable locally via `npm run compare:pipelines`).
- **Input**: A test dataset containing receipt images and corresponding manually curated "ground truth" JSON outputs (located in `invoices/fixtures/evaluation-set/`).
- **Execution**:
  - Runs each invoice through the `LegacyInvoiceProcessorAdapter` (in dry-run mode, bypassing database writes and price observations).
  - Runs each invoice through the `StrandsAgentInvoiceProcessorAdapter` (in dry-run mode).
  - Collects execution metrics (processing time, tokens, API cost, output JSON).

### Model-as-a-Judge Evaluation

The outputs from both pipelines are compared by a more capable model (e.g. Claude 3.5 Sonnet acting under the `insight` role) to grade the results.

#### Evaluator Prompt Structure:

```xml
You are an expert financial data auditor. Compare the two extracted invoice JSON structures against the provided Ground Truth JSON.

<ground_truth>
{{GROUND_TRUTH_JSON}}
</ground_truth>

<legacy_output>
{{LEGACY_JSON}}
</legacy_output>

<agentic_output>
{{AGENTIC_JSON}}
</agentic_output>

Grade both outputs on a scale from 0.0 to 1.0 on the following criteria:
1. Extraction Accuracy: Are amounts, dates, VAT IDs, and merchant details correct?
2. Line-Item Completeness: Were all products, pack sizes, and prices parsed correctly?
3. Classification Alignment: Is the invoice mapped to the correct category?
4. Tag Relevance: Are the selected tags appropriate based on the vocabulary?

Provide your output strictly in JSON conforming to the following structure:
{
  "legacy_scores": { "extraction": 0.9, "completeness": 0.8, "classification": 1.0, "tags": 0.7, "overall": 0.85 },
  "agentic_scores": { "extraction": 1.0, "completeness": 0.95, "classification": 1.0, "tags": 1.0, "overall": 0.98 },
  "analysis": "Brief description of discrepancies..."
}
```

The runner aggregates these scores and prints a comparative summary table including average scores, average latency, and average cost per invoice.

---

## 8. Next Steps: Model Tuning & Swapping

If the agentic workflow outperforms the legacy sequential approach:
1. **Dynamic Model Swapping**: Use the Admin Console's Model Matrix page to replace the Bedrock model configuration `/wobblio/config/models/vision_parser` or `/wobblio/config/models/pdf_parser`. We can experiment with faster/cheaper alternatives (e.g., swapping Qwen for Claude Haiku or Llama 3 Vision) to reduce pipeline costs while maintaining extraction quality.
2. **Fine-Tuning/Prompts Optimization**: Optimize Strands Agent prompts using the evaluation set to reduce input tokens and prevent unnecessary reasoning loops.

---

## 9. Specification & Deployment Checklist

### CDK Stack Infrastructure (`WobblioAgenticPipelineStack`)
- [ ] Define the separate `WobblioAgenticPipelineStack` CDK class
- [ ] Create SQS queue `WobblioAgenticQueue` with DLQ `WobblioAgenticDLQ` and `maxReceiveCount: 3`
- [ ] Create `WobblioAgenticWorkerLambda` running Node.js 24 in private subnets
- [ ] Bind SQS event source mapping with `maxConcurrency: 5` and `ReportBatchItemFailures: true`
- [ ] Grant S3 read access to shared invoice bucket
- [ ] Grant Bedrock runtime invoke model permissions
- [ ] Grant SSM Parameter Store read access to `/wobblio/config/*` parameters
- [ ] Configure PostgreSQL RDS database connection permissions and security groups

### Database & GDPR Config
- [ ] Create database migration script for `invoice_telemetry` table with `ON DELETE CASCADE` constraints
- [ ] Enable Row-Level Security (RLS) on `invoice_telemetry` table using `app.current_tenant_id`
- [ ] Verify `invoice_telemetry` rows are fully deleted on tenant hard-purge (GDPR validation)

### API Routing
- [ ] Define `IInvoiceIngestionQueuePort` interface in core domain
- [ ] Implement `SqsInvoiceIngestionQueueAdapter` supporting dynamic queue destination selection
- [ ] Update `POST /invoices/{id}/confirm` backend route to invoke `IInvoiceIngestionQueuePort.enqueue`
- [ ] Implement the dynamic toggle check (`/wobblio/config/features/agentic_pipeline_enabled`) at SQS enqueuing time

### Ingestion Worker Code
- [ ] Create standalone entry point for `WobblioAgenticWorkerLambda` using `@strands-agents/sdk`
- [ ] Implement the Strands Coordinator Agent with Zod schemas for structured outputs
- [ ] Build Agent Tools wrapping existing Stage 1 to Stage 5 domain services (OCR, Merchant, Product, Category, Tagging)
- [ ] Implement file type detection (PDF vs Image) inside the `OCRParserTool`
- [ ] Integrate `IModelRegistry` inside `OCRParserTool` to load `pdf_parser` (Sonnet 4.6) for PDFs and `vision_parser` (Qwen) for images
- [ ] Save telemetry run data directly to the `invoice_telemetry` table inside the ingestion transaction
- [ ] Ensure DB writes for tenant tables are executed inside a unified transaction with active RLS tenant context
- [ ] Log telemetry JSON containing the `pipeline_type: 'STRANDS'` parameter on completion