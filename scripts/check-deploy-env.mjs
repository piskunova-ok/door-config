const url = process.env.VITE_SUPABASE_URL?.trim()
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

if (!url || !key) {
  console.error('Netlify build stopped: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the site build environment.')
  process.exit(1)
}

try {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') || parsed.pathname !== '/') throw new Error()
  let publicKey = key.startsWith('sb_publishable_')
  if (!publicKey && key.split('.').length === 3) {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'))
    publicKey = payload.role === 'anon'
  }
  if (!publicKey) throw new Error()
} catch {
  console.error('Netlify build stopped: check the DOOR CONFIG Supabase URL and use a public publishable key, never a service-role key.')
  process.exit(1)
}
