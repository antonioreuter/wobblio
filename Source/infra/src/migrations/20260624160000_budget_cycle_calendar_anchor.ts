import type { MigrationBuilder } from 'node-pg-migrate';

// Re-anchor existing budgets' cycle_start to the start of the calendar period that
// contains today. Until now cycle_start defaulted to the creation day (CURRENT_DATE),
// so a budget made mid-period had a window of [creation_day, creation_day + period)
// that silently excluded every receipt issue-dated earlier in the period — the
// recurring "uploaded invoices not computed in the budget" defect. The live window
// always rolls to today, so snapping to the current calendar period start fixes the
// active window and keeps future rollovers aligned. date_trunc('week') is Monday-based.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    UPDATE budget SET cycle_start = CASE period
      WHEN 'DAY'   THEN CURRENT_DATE
      WHEN 'WEEK'  THEN date_trunc('week',  CURRENT_DATE)::date
      WHEN 'MONTH' THEN date_trunc('month', CURRENT_DATE)::date
    END;
  `);
}

// The original creation-day anchors are not recoverable; restore the pre-fix default
// behaviour by collapsing every cycle_start back to today.
export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`UPDATE budget SET cycle_start = CURRENT_DATE;`);
}
