import type { MigrationBuilder } from 'node-pg-migrate';

// Fix 09/03 — legacy cross-merchant split migration. Products that accreted data from multiple
// merchants (via the removed cross-merchant embedding acceptance) are SPLIT per merchant, not
// grandfathered (DEC-4; data manipulation authorized 2026-07-12). Merchant evidence already exists
// on every dependent row (price_observation.merchant_id, invoice_line→invoice.merchant_id,
// product_alias.merchant_id), so the split is deterministic and fully logged for the first time.
//
// Environment gate: dev first, verified end-to-end. Production is a separately-approved runbook step
// (NON-NEGOTIABLE) — nothing here licenses touching prod.
//
// Runs in one transaction (node-pg-migrate default), and is additionally idempotent: a product
// already present in product_split_log as a parent is skipped, so re-running is a no-op. Must run as
// the object owner (wobblio_dev_app), which bypasses RLS so the SPLIT_SEED comparison sets can be
// written with each tenant's tenant_id derived only from that tenant's own invoice lines (invariant #1).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Provenance / audit (not tenant data): RLS-exempt reference table, admin-read only.
    CREATE TABLE product_split_log (
      id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      parent_product_id UUID        NOT NULL,
      new_product_id    UUID        NOT NULL,
      merchant_id       UUID        NOT NULL,
      observation_rows  INT         NOT NULL,
      invoice_line_rows INT         NOT NULL,
      alias_rows        INT         NOT NULL,
      executed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Step 1a: products with exactly one merchant of evidence are simply stamped (no split).
    -- Products with zero merchant evidence (merchant-agnostic seeds/orphans) stay NULL.
    UPDATE product p SET merchant_id = ev.m
    FROM (
      SELECT product_id, (array_agg(m))[1] AS m
      FROM (
        SELECT DISTINCT product_id, m FROM (
          SELECT product_id, merchant_id AS m FROM price_observation WHERE merchant_id IS NOT NULL
          UNION
          SELECT product_id, merchant_id FROM product_alias WHERE merchant_id IS NOT NULL
          UNION
          SELECT l.product_id, i.merchant_id FROM invoice_line l JOIN invoice i ON i.id = l.invoice_id
            WHERE l.product_id IS NOT NULL AND i.merchant_id IS NOT NULL
        ) e
      ) d
      GROUP BY product_id
      HAVING COUNT(*) = 1
    ) ev
    WHERE p.id = ev.product_id AND p.merchant_id IS NULL;

    DO $split$
    DECLARE
      fam            RECORD;
      merchants      UUID[];
      home_merchant  UUID;
      extra          UUID;
      new_pid        UUID;
      fam_pids       UUID[];
      obs_n          INT;
      line_n         INT;
      alias_n        INT;
      t              UUID;
      best_pid       UUID;
      member_pids    UUID[];
      new_set_id     UUID;
      mpid           UUID;
      parent_name    TEXT;
    BEGIN
      FOR fam IN
        SELECT p.id AS product_id
        FROM product p
        WHERE (
          SELECT COUNT(*) FROM (
            SELECT merchant_id AS m FROM price_observation WHERE product_id = p.id
            UNION
            SELECT merchant_id FROM product_alias WHERE product_id = p.id AND merchant_id IS NOT NULL
            UNION
            SELECT i.merchant_id FROM invoice_line l JOIN invoice i ON i.id = l.invoice_id
              WHERE l.product_id = p.id AND i.merchant_id IS NOT NULL
          ) mm WHERE m IS NOT NULL
        ) > 1
        AND NOT EXISTS (SELECT 1 FROM product_split_log WHERE parent_product_id = p.id)
      LOOP
        -- Distinct merchants with evidence for this product.
        SELECT array_agg(m) INTO merchants FROM (
          SELECT DISTINCT m FROM (
            SELECT merchant_id AS m FROM price_observation WHERE product_id = fam.product_id
            UNION
            SELECT merchant_id FROM product_alias WHERE product_id = fam.product_id AND merchant_id IS NOT NULL
            UNION
            SELECT i.merchant_id FROM invoice_line l JOIN invoice i ON i.id = l.invoice_id
              WHERE l.product_id = fam.product_id AND i.merchant_id IS NOT NULL
          ) u WHERE m IS NOT NULL
        ) d;

        -- Home merchant: most price_observation rows, tie-break most invoice_line rows,
        -- then earliest alias id. Deterministic.
        SELECT m INTO home_merchant FROM (
          SELECT mm.m,
            (SELECT COUNT(*) FROM price_observation WHERE product_id = fam.product_id AND merchant_id = mm.m) AS obs_c,
            (SELECT COUNT(*) FROM invoice_line l JOIN invoice i ON i.id = l.invoice_id
               WHERE l.product_id = fam.product_id AND i.merchant_id = mm.m) AS line_c,
            (SELECT MIN(id::text) FROM product_alias WHERE product_id = fam.product_id AND merchant_id = mm.m) AS min_alias
          FROM unnest(merchants) AS mm(m)
        ) ranked
        ORDER BY obs_c DESC, line_c DESC, min_alias ASC NULLS LAST
        LIMIT 1;

        -- The original row keeps its UUID and is stamped with the home merchant.
        UPDATE product SET merchant_id = home_merchant WHERE id = fam.product_id;
        SELECT display_name INTO parent_name FROM product WHERE id = fam.product_id;
        fam_pids := ARRAY[fam.product_id];

        -- Clone per extra merchant and reassign that merchant's dependents onto the clone.
        FOREACH extra IN ARRAY merchants LOOP
          IF extra = home_merchant THEN CONTINUE; END IF;

          INSERT INTO product (category_id, country_code, merchant_id, brand,
                               display_name, base_unit, pack_size_base_units, embedding,
                               created_via, status)
          SELECT category_id, country_code, extra, brand,
                 display_name, base_unit, pack_size_base_units, embedding,
                 'AUTO', status
          FROM product WHERE id = fam.product_id
          RETURNING id INTO new_pid;

          UPDATE price_observation SET product_id = new_pid
            WHERE product_id = fam.product_id AND merchant_id = extra;
          GET DIAGNOSTICS obs_n = ROW_COUNT;

          UPDATE invoice_line SET product_id = new_pid
            WHERE product_id = fam.product_id
              AND invoice_id IN (SELECT id FROM invoice WHERE merchant_id = extra);
          GET DIAGNOSTICS line_n = ROW_COUNT;

          UPDATE product_alias SET product_id = new_pid
            WHERE product_id = fam.product_id AND merchant_id = extra;
          GET DIAGNOSTICS alias_n = ROW_COUNT;

          INSERT INTO product_split_log
            (parent_product_id, new_product_id, merchant_id, observation_rows, invoice_line_rows, alias_rows)
          VALUES (fam.product_id, new_pid, extra, obs_n, line_n, alias_n);

          fam_pids := array_append(fam_pids, new_pid);
        END LOOP;

        -- Repoint each tenant's shopping_list_item (no merchant context on the row) to the clone
        -- that tenant purchased most; tenants with no purchase signal keep the home product.
        FOR t IN
          SELECT DISTINCT sl.tenant_id
          FROM shopping_list_item si JOIN shopping_list sl ON sl.id = si.list_id
          WHERE si.product_id = fam.product_id
        LOOP
          SELECT l.product_id INTO best_pid
          FROM invoice_line l JOIN invoice i ON i.id = l.invoice_id
          WHERE i.tenant_id = t AND l.product_id = ANY(fam_pids)
          GROUP BY l.product_id
          ORDER BY COUNT(*) DESC, l.product_id
          LIMIT 1;

          IF best_pid IS NOT NULL AND best_pid <> fam.product_id THEN
            UPDATE shopping_list_item SET product_id = best_pid
            WHERE product_id = fam.product_id
              AND list_id IN (SELECT id FROM shopping_list WHERE tenant_id = t);
          END IF;
        END LOOP;

        -- Seed a watch-only comparison set for each tenant whose own history now spans ≥2 clones,
        -- preserving their pre-split cross-merchant view as an explicit, user-editable link.
        FOR t IN
          SELECT i.tenant_id
          FROM invoice_line l JOIN invoice i ON i.id = l.invoice_id
          WHERE l.product_id = ANY(fam_pids)
          GROUP BY i.tenant_id
          HAVING COUNT(DISTINCT l.product_id) >= 2
        LOOP
          SELECT array_agg(DISTINCT l.product_id) INTO member_pids
          FROM invoice_line l JOIN invoice i ON i.id = l.invoice_id
          WHERE i.tenant_id = t AND l.product_id = ANY(fam_pids);

          INSERT INTO product_comparison_set (tenant_id, name)
          VALUES (t, parent_name)
          RETURNING id INTO new_set_id;

          FOREACH mpid IN ARRAY member_pids LOOP
            INSERT INTO product_comparison_set_member
              (set_id, tenant_id, product_id, source, size_equivalent)
            VALUES (new_set_id, t, mpid, 'SPLIT_SEED', false);
          END LOOP;
        END LOOP;
      END LOOP;
    END $split$;
  `);
}

// Down drops only the provenance table. The split itself is not auto-reversed here (it is
// mechanically reversible from product_split_log, but a blind down could clobber post-split data);
// reversal is an explicit operator step using the log. Documented lossy.
export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS product_split_log;`);
}
