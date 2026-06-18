import path from 'path';
import dotenv from 'dotenv';

// Integration tests run against the local Docker stack (LocalStack + Postgres),
// so the suite must be self-contained rather than depend on the developer's
// shell having exported AWS_ENDPOINT_URL et al. Load the same canonical env the
// local backend server uses (config/local.env). dotenv does not override
// variables already present, so direnv or an explicit override still wins.
if (process.env.STAGE === 'local') {
  dotenv.config({ path: path.resolve(__dirname, '../../../../../config/local.env') });
}
