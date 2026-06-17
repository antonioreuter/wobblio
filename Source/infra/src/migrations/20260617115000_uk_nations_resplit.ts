import type { MigrationBuilder } from 'node-pg-migrate';

// Re-model the United Kingdom: instead of one `GB` country with 4 nation
// subdivisions, the four nations become separate top-level countries
// (EN/SC/WA/NI — project-local CHAR(2) codes, as no ISO 3166-1 alpha-2 exists),
// each carrying its own regions. The matching snapshot in
// 20260616100000_seed_reference_data.ts already reflects this for fresh DBs;
// this follow-up exists because that seed migration is idempotent and was
// already applied (with GB) on deployed/dev stages, so editing it does not
// re-run there. This migration is self-contained (inlines its own UK data so
// its behaviour is frozen) and idempotent.
//
// No table foreign-keys `country` or `country_subdivision` (the `country_code`/
// `region_code` columns on app_user, merchant, etc. are plain CHAR(2)/TEXT, not
// FK-constrained), so deletion can't cascade or be blocked — but that also means
// nothing repairs rows pointing at GB. We therefore re-home those rows onto the new
// nation-countries *before* deleting GB. The only inbound FK is
// country_subdivision.country_code -> country.code, satisfied by deleting
// subdivisions before the country.

interface CountryRow { code: string; name: string; }
interface SubdivisionRow { code: string; countryCode: string; name: string; }

// Exported so test/seed_reference_data.test.ts can assert this inlined copy stays
// in sync with the UK subset of the seed snapshot. The two cannot share imports
// (a migration's behaviour must be frozen and self-contained), so the parity test
// is the only thing preventing silent drift between the two copies.
export const UK_COUNTRIES: CountryRow[] = [
  { code: 'EN', name: 'England' },
  { code: 'SC', name: 'Scotland' },
  { code: 'WA', name: 'Wales' },
  { code: 'NI', name: 'Northern Ireland' },
];

export const UK_SUBDIVISIONS: SubdivisionRow[] = [
  { code: 'EN-NE', countryCode: 'EN', name: 'North East' },
  { code: 'EN-NW', countryCode: 'EN', name: 'North West' },
  { code: 'EN-YH', countryCode: 'EN', name: 'Yorkshire and the Humber' },
  { code: 'EN-EM', countryCode: 'EN', name: 'East Midlands' },
  { code: 'EN-WM', countryCode: 'EN', name: 'West Midlands' },
  { code: 'EN-EE', countryCode: 'EN', name: 'East of England' },
  { code: 'EN-LDN', countryCode: 'EN', name: 'London' },
  { code: 'EN-SE', countryCode: 'EN', name: 'South East' },
  { code: 'EN-SW', countryCode: 'EN', name: 'South West' },
  { code: 'SC-ABE', countryCode: 'SC', name: 'Aberdeen City' },
  { code: 'SC-ABD', countryCode: 'SC', name: 'Aberdeenshire' },
  { code: 'SC-ANS', countryCode: 'SC', name: 'Angus' },
  { code: 'SC-AGB', countryCode: 'SC', name: 'Argyll and Bute' },
  { code: 'SC-CLK', countryCode: 'SC', name: 'Clackmannanshire' },
  { code: 'SC-DGY', countryCode: 'SC', name: 'Dumfries and Galloway' },
  { code: 'SC-DND', countryCode: 'SC', name: 'Dundee City' },
  { code: 'SC-EAY', countryCode: 'SC', name: 'East Ayrshire' },
  { code: 'SC-EDU', countryCode: 'SC', name: 'East Dunbartonshire' },
  { code: 'SC-ELN', countryCode: 'SC', name: 'East Lothian' },
  { code: 'SC-ERW', countryCode: 'SC', name: 'East Renfrewshire' },
  { code: 'SC-EDH', countryCode: 'SC', name: 'City of Edinburgh' },
  { code: 'SC-ELS', countryCode: 'SC', name: 'Na h-Eileanan Siar' },
  { code: 'SC-FAL', countryCode: 'SC', name: 'Falkirk' },
  { code: 'SC-FIF', countryCode: 'SC', name: 'Fife' },
  { code: 'SC-GLG', countryCode: 'SC', name: 'Glasgow City' },
  { code: 'SC-HLD', countryCode: 'SC', name: 'Highland' },
  { code: 'SC-IVC', countryCode: 'SC', name: 'Inverclyde' },
  { code: 'SC-MLN', countryCode: 'SC', name: 'Midlothian' },
  { code: 'SC-MRY', countryCode: 'SC', name: 'Moray' },
  { code: 'SC-NAY', countryCode: 'SC', name: 'North Ayrshire' },
  { code: 'SC-NLK', countryCode: 'SC', name: 'North Lanarkshire' },
  { code: 'SC-ORK', countryCode: 'SC', name: 'Orkney Islands' },
  { code: 'SC-PKN', countryCode: 'SC', name: 'Perth and Kinross' },
  { code: 'SC-RFW', countryCode: 'SC', name: 'Renfrewshire' },
  { code: 'SC-SCB', countryCode: 'SC', name: 'Scottish Borders' },
  { code: 'SC-ZET', countryCode: 'SC', name: 'Shetland Islands' },
  { code: 'SC-SAY', countryCode: 'SC', name: 'South Ayrshire' },
  { code: 'SC-SLK', countryCode: 'SC', name: 'South Lanarkshire' },
  { code: 'SC-STG', countryCode: 'SC', name: 'Stirling' },
  { code: 'SC-WDU', countryCode: 'SC', name: 'West Dunbartonshire' },
  { code: 'SC-WLN', countryCode: 'SC', name: 'West Lothian' },
  { code: 'WA-BGW', countryCode: 'WA', name: 'Blaenau Gwent' },
  { code: 'WA-BGE', countryCode: 'WA', name: 'Bridgend' },
  { code: 'WA-CAY', countryCode: 'WA', name: 'Caerphilly' },
  { code: 'WA-CRF', countryCode: 'WA', name: 'Cardiff' },
  { code: 'WA-CMN', countryCode: 'WA', name: 'Carmarthenshire' },
  { code: 'WA-CGN', countryCode: 'WA', name: 'Ceredigion' },
  { code: 'WA-CWY', countryCode: 'WA', name: 'Conwy' },
  { code: 'WA-DEN', countryCode: 'WA', name: 'Denbighshire' },
  { code: 'WA-FLN', countryCode: 'WA', name: 'Flintshire' },
  { code: 'WA-GWN', countryCode: 'WA', name: 'Gwynedd' },
  { code: 'WA-AGY', countryCode: 'WA', name: 'Isle of Anglesey' },
  { code: 'WA-MTY', countryCode: 'WA', name: 'Merthyr Tydfil' },
  { code: 'WA-MON', countryCode: 'WA', name: 'Monmouthshire' },
  { code: 'WA-NTL', countryCode: 'WA', name: 'Neath Port Talbot' },
  { code: 'WA-NWP', countryCode: 'WA', name: 'Newport' },
  { code: 'WA-PEM', countryCode: 'WA', name: 'Pembrokeshire' },
  { code: 'WA-POW', countryCode: 'WA', name: 'Powys' },
  { code: 'WA-RCT', countryCode: 'WA', name: 'Rhondda Cynon Taf' },
  { code: 'WA-SWA', countryCode: 'WA', name: 'Swansea' },
  { code: 'WA-TOF', countryCode: 'WA', name: 'Torfaen' },
  { code: 'WA-VGL', countryCode: 'WA', name: 'Vale of Glamorgan' },
  { code: 'WA-WRX', countryCode: 'WA', name: 'Wrexham' },
  { code: 'NI-ANN', countryCode: 'NI', name: 'Antrim and Newtownabbey' },
  { code: 'NI-AND', countryCode: 'NI', name: 'Ards and North Down' },
  { code: 'NI-ABC', countryCode: 'NI', name: 'Armagh City, Banbridge and Craigavon' },
  { code: 'NI-BFS', countryCode: 'NI', name: 'Belfast' },
  { code: 'NI-CCG', countryCode: 'NI', name: 'Causeway Coast and Glens' },
  { code: 'NI-DRS', countryCode: 'NI', name: 'Derry City and Strabane' },
  { code: 'NI-FMO', countryCode: 'NI', name: 'Fermanagh and Omagh' },
  { code: 'NI-LBC', countryCode: 'NI', name: 'Lisburn and Castlereagh' },
  { code: 'NI-MEA', countryCode: 'NI', name: 'Mid and East Antrim' },
  { code: 'NI-MUL', countryCode: 'NI', name: 'Mid Ulster' },
  { code: 'NI-NMD', countryCode: 'NI', name: 'Newry, Mourne and Down' },
];

const sqlLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  const countries = UK_COUNTRIES
    .map((c) => `(${sqlLiteral(c.code)}, ${sqlLiteral(c.name)})`)
    .join(',\n    ');
  pgm.sql(`
    INSERT INTO country (code, name) VALUES
    ${countries}
    ON CONFLICT (code) DO NOTHING;
  `);

  const subdivisions = UK_SUBDIVISIONS
    .map((s) => `(${sqlLiteral(s.code)}, ${sqlLiteral(s.countryCode)}, ${sqlLiteral(s.name)})`)
    .join(',\n    ');
  pgm.sql(`
    INSERT INTO country_subdivision (code, country_code, name) VALUES
    ${subdivisions}
    ON CONFLICT (code) DO NOTHING;
  `);

  // Re-home rows that referenced the old GB modelling before deleting it, so no user,
  // merchant, or invoice is stranded on a country/region that no longer exists. The old
  // nation-level subdivisions (GB-ENG/SCT/WLS/NIR) map onto the new nation-countries; the
  // new nations carry finer regions, so the user's specific region is cleared (they pick a
  // real one on their next invoice). app_user.region_code is NOT NULL, so "cleared" means
  // the country-code fallback (the same convention onboarding uses when no region is set).
  const NATION_BY_GB_REGION: Record<string, string> = {
    'GB-ENG': 'EN', 'GB-SCT': 'SC', 'GB-WLS': 'WA', 'GB-NIR': 'NI',
  };
  for (const [gbRegion, nation] of Object.entries(NATION_BY_GB_REGION)) {
    pgm.sql(`
      UPDATE app_user SET country_code = ${sqlLiteral(nation)}, region_code = ${sqlLiteral(nation)}
      WHERE country_code = 'GB' AND region_code = ${sqlLiteral(gbRegion)};`);
    pgm.sql(`
      UPDATE invoice SET location_country_code = ${sqlLiteral(nation)}, location_region_code = NULL
      WHERE location_country_code = 'GB' AND location_region_code = ${sqlLiteral(gbRegion)};`);
  }

  // Any GB rows whose nation can't be inferred (no/unknown region) default to England —
  // the largest nation — and get re-prompted for a region. merchant/merchant_alias are
  // the country-level catalog and carry no nation, so all GB entries fold into England.
  pgm.sql(`UPDATE app_user SET country_code = 'EN', region_code = 'EN' WHERE country_code = 'GB';`);
  pgm.sql(`UPDATE invoice SET location_country_code = 'EN', location_region_code = NULL WHERE location_country_code = 'GB';`);
  pgm.sql(`UPDATE merchant SET country_code = 'EN' WHERE country_code = 'GB';`);
  pgm.sql(`UPDATE merchant_alias SET country_code = 'EN' WHERE country_code = 'GB';`);

  // Retire the old GB modelling. Subdivisions first (FK to country).
  pgm.sql(`DELETE FROM country_subdivision WHERE country_code = 'GB';`);
  pgm.sql(`DELETE FROM country WHERE code = 'GB';`);
}

// Irreversible by design: re-inserting GB would not restore which nation a user
// had picked, and the EN/SC/WA/NI rows are harmless to retain. Tearing the
// schema down drops the tables (CASCADE) via the migration that created them.
export async function down(): Promise<void> {}
