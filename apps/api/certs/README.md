# certs

`supabase-prod-ca-2021.crt` is the public root Supabase signs every project's Postgres
certificate with — "Supabase Root 2021 CA", valid until 2031-04-26, downloaded from
`https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`. It holds
no secret and is versioned so the image can verify the chain without a network fetch at boot.

The runtime `DATABASE_URL` points `sslrootcert` at where the Dockerfile lands this file. Without
it, `sslmode=verify-full` checks the pooler against the public trust store, which does not carry
this root, and every query fails with `self-signed certificate in certificate chain`.

`prisma migrate deploy` does not use this file: its schema engine ignores `sslmode=verify-full`
and cannot load a custom root, so the migration string stays on `sslmode=require` — encrypted,
unverified, with `[remotes.<name>.db.ssl_enforcement]` guaranteeing the encryption.
