import 'dotenv/config'
import path from 'node:path'

import { defineConfig } from 'prisma/config'

const databaseUrl = process.env.DATABASE_URL

export default defineConfig({
  schema: path.join('prisma', 'schema'),
  migrations: { path: path.join('prisma', 'migrations') },
  ...(databaseUrl === undefined ? {} : { datasource: { url: databaseUrl } }),
})
