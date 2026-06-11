import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- ── Extensions ──────────────────────────────────────────────────────────────
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE EXTENSION IF NOT EXISTS vector;

    -- ── Enums ────────────────────────────────────────────────────────────────────
    CREATE TYPE user_role         AS ENUM ('STANDARD', 'PREMIUM', 'TESTER', 'ADMIN');
    CREATE TYPE user_status       AS ENUM ('ACTIVE', 'WAITLIST', 'DELETED');
    CREATE TYPE merchant_created_via AS ENUM ('SEED', 'AUTO', 'ADMIN');
    CREATE TYPE merchant_status   AS ENUM ('PROVISIONAL', 'ACTIVE', 'INACTIVE');
    CREATE TYPE invoice_status    AS ENUM (
      'PROCESSING', 'NEEDS_REVIEW', 'PARSED',
      'FAILED_PROCESSING', 'SUSPECTED_DUPLICATE', 'DISCARDED'
    );
    CREATE TYPE budget_scope      AS ENUM ('TOTAL', 'CATEGORY', 'MEMBER');
    CREATE TYPE budget_period     AS ENUM ('WEEK', 'MONTH');
    CREATE TYPE quota_counter_type AS ENUM ('UPLOADS', 'HOUSEHOLD_UPLOADS');
    CREATE TYPE data_request_kind AS ENUM ('EXPORT', 'DELETION');
    CREATE TYPE data_request_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
    CREATE TYPE invoice_verdict   AS ENUM ('UP', 'DOWN');
    CREATE TYPE verdict_reason    AS ENUM ('ITEMS', 'MERCHANT_TOTAL', 'OTHER');
    CREATE TYPE alias_source      AS ENUM ('SEED', 'AUTO_FUZZY', 'AUTO_LLM', 'USER_CONFIRMED', 'ADMIN');
    CREATE TYPE product_base_unit AS ENUM ('KG', 'L', 'PIECE');
    CREATE TYPE price_obs_quality AS ENUM ('AUTO', 'USER_CONFIRMED');
    CREATE TYPE payment_tx_type   AS ENUM ('CHARGE', 'REFUND', 'DISPUTE', 'SUBSCRIPTION_UPDATE');
    CREATE TYPE payment_plan      AS ENUM ('MONTHLY', 'ANNUAL');
    CREATE TYPE catalog_created_via AS ENUM ('SEED', 'AUTO', 'ADMIN');
    CREATE TYPE catalog_status    AS ENUM ('PROVISIONAL', 'ACTIVE', 'INACTIVE');

    -- ── Global tables (no RLS) ───────────────────────────────────────────────────
    CREATE TABLE merchant (
      id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
      brand_name       TEXT          NOT NULL,
      country_code     CHAR(2)       NOT NULL,
      default_category_id TEXT       NULL,
      website          TEXT          NULL,
      created_via      merchant_created_via NOT NULL DEFAULT 'AUTO',
      status           merchant_status      NOT NULL DEFAULT 'PROVISIONAL'
    );

    CREATE TABLE merchant_branch (
      id                   UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
      merchant_id          UUID  NOT NULL REFERENCES merchant(id),
      branch_label         TEXT  NULL,
      address              TEXT  NULL,
      city                 TEXT  NULL,
      postal_code          TEXT  NULL,
      geo_point            POINT NULL,
      external_store_number TEXT NULL
    );

    CREATE TABLE merchant_alias (
      id               UUID   PRIMARY KEY DEFAULT uuid_generate_v4(),
      merchant_id      UUID   NOT NULL REFERENCES merchant(id),
      branch_id        UUID   NULL REFERENCES merchant_branch(id),
      alias_raw        TEXT   NULL,
      alias_normalized TEXT   NOT NULL,
      country_code     CHAR(2) NOT NULL,
      vat_id           TEXT   NULL,
      match_count      INT    NOT NULL DEFAULT 0,
      last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      source           alias_source NOT NULL DEFAULT 'SEED'
    );

    CREATE TABLE product_category (
      id        TEXT     PRIMARY KEY,
      parent_id TEXT     NULL REFERENCES product_category(id),
      name      TEXT     NOT NULL,
      name_nl   TEXT     NULL,
      level     SMALLINT NOT NULL
    );

    CREATE TABLE product_concept (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name        TEXT NOT NULL,
      category_id TEXT NOT NULL REFERENCES product_category(id)
    );

    CREATE TABLE product (
      id                   UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
      concept_id           UUID              NULL REFERENCES product_concept(id),
      category_id          TEXT              NOT NULL REFERENCES product_category(id),
      brand                TEXT              NULL,
      display_name         TEXT              NOT NULL,
      base_unit            product_base_unit NOT NULL,
      pack_size_base_units NUMERIC           NULL,
      embedding            vector(512)       NULL,
      created_via          catalog_created_via NOT NULL DEFAULT 'AUTO',
      status               catalog_status    NOT NULL DEFAULT 'PROVISIONAL'
    );

    CREATE TABLE product_alias (
      id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
      product_id       UUID         NOT NULL REFERENCES product(id),
      alias_normalized TEXT         NOT NULL,
      merchant_id      UUID         NULL REFERENCES merchant(id),
      match_count      INT          NOT NULL DEFAULT 0,
      source           alias_source NOT NULL DEFAULT 'AUTO_FUZZY',
      last_seen_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    -- Price Observation Store: no RLS, no tenant ref — de-identified by design (§6.5)
    CREATE TABLE price_observation (
      id                        UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
      product_id                UUID              NOT NULL REFERENCES product(id),
      merchant_id               UUID              NOT NULL REFERENCES merchant(id),
      country_code              CHAR(2)           NOT NULL,
      region_code               TEXT              NOT NULL,
      observed_on               DATE              NOT NULL,
      pack_price                NUMERIC(10,4)     NOT NULL,
      normalized_unit_price     NUMERIC(10,4)     NOT NULL,
      base_unit                 product_base_unit NOT NULL,
      currency                  CHAR(3)           NOT NULL,
      was_discounted            BOOLEAN           NOT NULL DEFAULT false,
      quality                   price_obs_quality NOT NULL DEFAULT 'AUTO',
      quarantined               BOOL              NOT NULL DEFAULT false,
      contributor_trust_at_write SMALLINT         NOT NULL
    );

    CREATE TABLE fx_rate (
      date  DATE   NOT NULL,
      base  CHAR(3) NOT NULL,
      quote CHAR(3) NOT NULL,
      rate  NUMERIC(18,8) NOT NULL,
      PRIMARY KEY (date, base, quote)
    );

    CREATE TABLE system_counter (
      name  TEXT   PRIMARY KEY,
      value BIGINT NOT NULL DEFAULT 0
    );

    CREATE TABLE limits (
      role_or_user_ref TEXT   NOT NULL,
      quota_name       TEXT   NOT NULL,
      value            BIGINT NOT NULL,
      PRIMARY KEY (role_or_user_ref, quota_name)
    );

    CREATE TABLE payment_transaction (
      id                UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id           UUID             NULL,
      stripe_event_id   TEXT             NOT NULL,
      type              payment_tx_type  NOT NULL,
      amount            NUMERIC(10,2)    NOT NULL,
      currency          CHAR(3)          NOT NULL,
      plan              payment_plan     NULL,
      occurred_at       TIMESTAMPTZ      NOT NULL,
      raw_payload_s3_key TEXT            NULL
    );

    CREATE TABLE kpi_daily (
      metric_date  DATE    NOT NULL,
      metric_name  TEXT    NOT NULL,
      value        NUMERIC NOT NULL,
      dimensions   JSONB   NULL
    );

    -- ── Tenant-scoped tables (RLS) ───────────────────────────────────────────────
    CREATE TABLE app_user (
      id                       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      cognito_sub              TEXT        NOT NULL,
      email                    TEXT        NOT NULL,
      role                     user_role   NOT NULL DEFAULT 'STANDARD',
      status                   user_status NOT NULL DEFAULT 'WAITLIST',
      country_code             CHAR(2)     NOT NULL DEFAULT 'NL',
      language                 CHAR(2)     NOT NULL DEFAULT 'nl',
      home_currency            CHAR(3)     NOT NULL DEFAULT 'EUR',
      region_code              TEXT        NOT NULL DEFAULT 'NL-NB',
      price_contribution_optout BOOL       NOT NULL DEFAULT false,
      stripe_customer_id       TEXT        NULL,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT app_user_cognito_sub_unique UNIQUE (cognito_sub)
    );

    -- ai_spend_ledger is global (no tenant-level RLS) but references tenant_id
    -- for per-tenant spend caps — exempt from RLS per §6.5 analogous rationale.
    CREATE TABLE ai_spend_ledger (
      id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id    UUID        NOT NULL,
      date         DATE        NOT NULL,
      model_role   TEXT        NOT NULL,
      input_tokens INT         NOT NULL,
      output_tokens INT        NOT NULL,
      est_cost     NUMERIC(10,6) NOT NULL
    );

    CREATE TABLE tenant_trust (
      tenant_id     UUID        PRIMARY KEY,
      trust_score   SMALLINT    NOT NULL DEFAULT 50,
      recomputed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE tenant_signature (
      tenant_id      UUID        NOT NULL,
      device_hash    TEXT        NOT NULL,
      ip_prefix_hash TEXT        NOT NULL,
      first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, device_hash)
    );

    CREATE TABLE household (
      id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      owner_user_id UUID        NOT NULL REFERENCES app_user(id),
      name          TEXT        NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE household_member (
      household_id UUID        NOT NULL REFERENCES household(id),
      user_id      UUID        NOT NULL REFERENCES app_user(id),
      joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (household_id, user_id)
    );

    CREATE TABLE invoice (
      id                   UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id            UUID           NOT NULL REFERENCES app_user(id),
      household_id         UUID           NULL REFERENCES household(id),
      uploaded_by_user_id  UUID           NOT NULL REFERENCES app_user(id),
      merchant_id          UUID           NULL REFERENCES merchant(id),
      branch_id            UUID           NULL REFERENCES merchant_branch(id),
      status               invoice_status NOT NULL DEFAULT 'PROCESSING',
      transaction_date     DATE           NULL,
      currency             CHAR(3)        NULL,
      total                NUMERIC(10,2)  NULL,
      total_home_currency  NUMERIC(10,2)  NULL,
      fx_rate_used         NUMERIC(18,8)  NULL,
      category_id          TEXT           NULL REFERENCES product_category(id),
      image_s3_key         TEXT           NOT NULL,
      image_sha256         TEXT           NOT NULL,
      search_tags          TEXT[]         NOT NULL DEFAULT '{}',
      created_at           TIMESTAMPTZ    NOT NULL DEFAULT now()
    );

    CREATE TABLE invoice_line (
      id                   UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
      invoice_id           UUID              NOT NULL REFERENCES invoice(id),
      raw_text             TEXT              NOT NULL,
      product_id           UUID              NULL REFERENCES product(id),
      category_id          TEXT              NULL REFERENCES product_category(id),
      quantity             NUMERIC(10,3)     NOT NULL DEFAULT 1,
      pack_quantity        NUMERIC(10,3)     NULL,
      base_unit            product_base_unit NULL,
      unit_price           NUMERIC(10,4)     NULL,
      normalized_unit_price NUMERIC(10,4)   NULL,
      line_total           NUMERIC(10,2)     NOT NULL,
      is_discount          BOOL              NOT NULL DEFAULT false,
      is_deposit_or_fee    BOOL              NOT NULL DEFAULT false,
      confidence           NUMERIC(4,3)      NOT NULL DEFAULT 1
    );

    CREATE TABLE shopping_list (
      id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id    UUID        NOT NULL REFERENCES app_user(id),
      name         TEXT        NOT NULL,
      is_active    BOOL        NOT NULL DEFAULT true,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ NULL
    );

    CREATE TABLE shopping_list_item (
      id         UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
      list_id    UUID     NOT NULL REFERENCES shopping_list(id),
      free_text  TEXT     NOT NULL,
      product_id UUID     NULL REFERENCES product(id),
      checked    BOOL     NOT NULL DEFAULT false,
      position   SMALLINT NOT NULL DEFAULT 0
    );

    CREATE TABLE budget (
      id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id        UUID         NOT NULL REFERENCES app_user(id),
      scope            budget_scope NOT NULL DEFAULT 'TOTAL',
      category_id      TEXT         NULL REFERENCES product_category(id),
      member_user_id   UUID         NULL REFERENCES app_user(id),
      amount           NUMERIC(10,2) NOT NULL,
      period           budget_period NOT NULL DEFAULT 'MONTH',
      accumulated      NUMERIC(10,2) NOT NULL DEFAULT 0,
      alert_85_fired   BOOL         NOT NULL DEFAULT false,
      alert_100_fired  BOOL         NOT NULL DEFAULT false,
      cycle_start      DATE         NOT NULL DEFAULT CURRENT_DATE
    );

    CREATE TABLE bill_split (
      id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      invoice_id UUID        NOT NULL REFERENCES invoice(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE bill_split_line (
      split_id             UUID         NOT NULL REFERENCES bill_split(id),
      line_id              UUID         NOT NULL REFERENCES invoice_line(id),
      participant_name_enc TEXT         NOT NULL,
      fraction             NUMERIC(5,4) NOT NULL,
      PRIMARY KEY (split_id, line_id)
    );

    CREATE TABLE quota_counter (
      tenant_id  UUID              NOT NULL REFERENCES app_user(id),
      counter    quota_counter_type NOT NULL,
      week_start DATE              NOT NULL,
      used       INT               NOT NULL DEFAULT 0,
      PRIMARY KEY (tenant_id, counter, week_start)
    );

    CREATE TABLE ingestion_ledger (
      s3_key        TEXT        PRIMARY KEY,
      tenant_id     UUID        NOT NULL REFERENCES app_user(id),
      status        TEXT        NOT NULL,
      attempt_count SMALLINT    NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE invoice_feedback (
      id                  UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
      invoice_id          UUID             NOT NULL REFERENCES invoice(id),
      tenant_id           UUID             NOT NULL REFERENCES app_user(id),
      verdict             invoice_verdict  NOT NULL,
      reason              verdict_reason   NULL,
      comment_enc         TEXT             NULL,
      model_ids_snapshot  JSONB            NULL,
      created_at          TIMESTAMPTZ      NOT NULL DEFAULT now()
    );

    CREATE TABLE data_request (
      id            UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id     UUID                NOT NULL REFERENCES app_user(id),
      kind          data_request_kind   NOT NULL,
      status        data_request_status NOT NULL DEFAULT 'PENDING',
      export_s3_key TEXT                NULL,
      requested_at  TIMESTAMPTZ         NOT NULL DEFAULT now(),
      completed_at  TIMESTAMPTZ         NULL
    );

    -- ── Row-Level Security ───────────────────────────────────────────────────────
    ALTER TABLE app_user         ENABLE ROW LEVEL SECURITY;
    ALTER TABLE household        ENABLE ROW LEVEL SECURITY;
    ALTER TABLE household_member ENABLE ROW LEVEL SECURITY;
    ALTER TABLE invoice          ENABLE ROW LEVEL SECURITY;
    ALTER TABLE invoice_line     ENABLE ROW LEVEL SECURITY;
    ALTER TABLE shopping_list    ENABLE ROW LEVEL SECURITY;
    ALTER TABLE shopping_list_item ENABLE ROW LEVEL SECURITY;
    ALTER TABLE budget           ENABLE ROW LEVEL SECURITY;
    ALTER TABLE bill_split       ENABLE ROW LEVEL SECURITY;
    ALTER TABLE bill_split_line  ENABLE ROW LEVEL SECURITY;
    ALTER TABLE quota_counter    ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ingestion_ledger ENABLE ROW LEVEL SECURITY;
    ALTER TABLE invoice_feedback ENABLE ROW LEVEL SECURITY;
    ALTER TABLE data_request     ENABLE ROW LEVEL SECURITY;

    -- current_setting(..., true) returns NULL (not error) when not set — safe for migrations/seeds
    CREATE POLICY tenant_isolation ON app_user
      USING (id = current_setting('app.current_tenant_id', true)::uuid);

    CREATE POLICY tenant_isolation ON household
      USING (
        owner_user_id = current_setting('app.current_tenant_id', true)::uuid
        OR id IN (
          SELECT household_id FROM household_member
          WHERE user_id = current_setting('app.current_tenant_id', true)::uuid
        )
      );

    CREATE POLICY tenant_isolation ON household_member
      USING (user_id = current_setting('app.current_tenant_id', true)::uuid);

    CREATE POLICY tenant_isolation ON invoice
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    CREATE POLICY tenant_isolation ON invoice_line
      USING (invoice_id IN (
        SELECT id FROM invoice
        WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
      ));

    CREATE POLICY tenant_isolation ON shopping_list
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    CREATE POLICY tenant_isolation ON shopping_list_item
      USING (list_id IN (
        SELECT id FROM shopping_list
        WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
      ));

    CREATE POLICY tenant_isolation ON budget
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    CREATE POLICY tenant_isolation ON bill_split
      USING (invoice_id IN (
        SELECT id FROM invoice
        WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
      ));

    CREATE POLICY tenant_isolation ON bill_split_line
      USING (split_id IN (
        SELECT bs.id FROM bill_split bs
        JOIN invoice i ON i.id = bs.invoice_id
        WHERE i.tenant_id = current_setting('app.current_tenant_id', true)::uuid
      ));

    CREATE POLICY tenant_isolation ON quota_counter
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    CREATE POLICY tenant_isolation ON ingestion_ledger
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    CREATE POLICY tenant_isolation ON invoice_feedback
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    CREATE POLICY tenant_isolation ON data_request
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

    -- ── Indexes ──────────────────────────────────────────────────────────────────
    -- merchant_alias: unique alias per country, fast trigram search
    CREATE UNIQUE INDEX merchant_alias_normalized_country_uidx
      ON merchant_alias (alias_normalized, country_code);
    CREATE INDEX merchant_alias_trgm_idx
      ON merchant_alias USING gin (alias_normalized gin_trgm_ops);

    -- product_alias: trigram search
    CREATE INDEX product_alias_trgm_idx
      ON product_alias USING gin (alias_normalized gin_trgm_ops);

    -- product: HNSW cosine index for embedding similarity search (512-dim, Titan V2)
    CREATE INDEX product_embedding_hnsw_idx
      ON product USING hnsw (embedding vector_cosine_ops);

    -- price_observation: serving cell queries
    CREATE INDEX price_observation_serving_idx
      ON price_observation (product_id, merchant_id, region_code, observed_on);

    -- invoice: tag search
    CREATE INDEX invoice_search_tags_gin_idx
      ON invoice USING gin (search_tags);

    -- payment_transaction: stripe idempotency
    CREATE UNIQUE INDEX payment_transaction_stripe_event_uidx
      ON payment_transaction (stripe_event_id);

    -- kpi_daily: unique metric rows (dimensions as text for JSONB comparison)
    CREATE UNIQUE INDEX kpi_daily_pk_idx
      ON kpi_daily (metric_date, metric_name, (COALESCE(dimensions::text, '')));

    -- ── Seed data ────────────────────────────────────────────────────────────────
    INSERT INTO system_counter (name, value) VALUES ('free_user_count', 0);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS data_request        CASCADE;
    DROP TABLE IF EXISTS invoice_feedback    CASCADE;
    DROP TABLE IF EXISTS ingestion_ledger    CASCADE;
    DROP TABLE IF EXISTS quota_counter       CASCADE;
    DROP TABLE IF EXISTS bill_split_line     CASCADE;
    DROP TABLE IF EXISTS bill_split          CASCADE;
    DROP TABLE IF EXISTS budget              CASCADE;
    DROP TABLE IF EXISTS shopping_list_item  CASCADE;
    DROP TABLE IF EXISTS shopping_list       CASCADE;
    DROP TABLE IF EXISTS invoice_line        CASCADE;
    DROP TABLE IF EXISTS invoice             CASCADE;
    DROP TABLE IF EXISTS household_member    CASCADE;
    DROP TABLE IF EXISTS household           CASCADE;
    DROP TABLE IF EXISTS data_request        CASCADE;
    DROP TABLE IF EXISTS ai_spend_ledger     CASCADE;
    DROP TABLE IF EXISTS tenant_signature    CASCADE;
    DROP TABLE IF EXISTS tenant_trust        CASCADE;
    DROP TABLE IF EXISTS app_user            CASCADE;
    DROP TABLE IF EXISTS payment_transaction CASCADE;
    DROP TABLE IF EXISTS kpi_daily           CASCADE;
    DROP TABLE IF EXISTS limits              CASCADE;
    DROP TABLE IF EXISTS system_counter      CASCADE;
    DROP TABLE IF EXISTS fx_rate             CASCADE;
    DROP TABLE IF EXISTS price_observation   CASCADE;
    DROP TABLE IF EXISTS product_alias       CASCADE;
    DROP TABLE IF EXISTS product             CASCADE;
    DROP TABLE IF EXISTS product_concept     CASCADE;
    DROP TABLE IF EXISTS product_category    CASCADE;
    DROP TABLE IF EXISTS merchant_alias      CASCADE;
    DROP TABLE IF EXISTS merchant_branch     CASCADE;
    DROP TABLE IF EXISTS merchant            CASCADE;

    DROP TYPE IF EXISTS catalog_status       CASCADE;
    DROP TYPE IF EXISTS catalog_created_via  CASCADE;
    DROP TYPE IF EXISTS price_obs_quality    CASCADE;
    DROP TYPE IF EXISTS product_base_unit    CASCADE;
    DROP TYPE IF EXISTS alias_source         CASCADE;
    DROP TYPE IF EXISTS verdict_reason       CASCADE;
    DROP TYPE IF EXISTS invoice_verdict      CASCADE;
    DROP TYPE IF EXISTS data_request_status  CASCADE;
    DROP TYPE IF EXISTS data_request_kind    CASCADE;
    DROP TYPE IF EXISTS quota_counter_type   CASCADE;
    DROP TYPE IF EXISTS budget_period        CASCADE;
    DROP TYPE IF EXISTS budget_scope         CASCADE;
    DROP TYPE IF EXISTS invoice_status       CASCADE;
    DROP TYPE IF EXISTS merchant_status      CASCADE;
    DROP TYPE IF EXISTS merchant_created_via CASCADE;
    DROP TYPE IF EXISTS user_status          CASCADE;
    DROP TYPE IF EXISTS user_role            CASCADE;
    DROP TYPE IF EXISTS payment_plan         CASCADE;
    DROP TYPE IF EXISTS payment_tx_type      CASCADE;
  `);
}
