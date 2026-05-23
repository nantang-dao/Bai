import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import pg from 'pg'

const client = new pg.Client({
  connectionString: 'postgresql://postgres:liushuting++951@db.vjjehnjdfvifaazqtmqf.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

const migrationsDir = join(process.cwd(), 'mycoseed-backend', 'db', 'migrations')

const files = readdirSync(migrationsDir)
  .filter(f => /^\d{3}_.*\.sql$/.test(f))
  .sort()

console.log(`Found ${files.length} migration files`)

await client.connect()
console.log('Connected to database\n')

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), 'utf-8')
  process.stdout.write(`Running: ${file} ... `)

  try {
    await client.query(sql)
    console.log('✓')
  } catch (err) {
    console.log(`✗ ${err.message}`)
  }
}

await client.end()
console.log('\nDone!')
