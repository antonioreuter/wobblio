import { Pool } from 'pg'

// Singleton pool — reused across requests in the same Lambda container / dev server process
let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL is not set')
    pool = new Pool({ connectionString, ssl: process.env.DB_SSL === 'true' })
  }
  return pool
}
