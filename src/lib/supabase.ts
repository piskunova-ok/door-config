import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const supabaseConfigurationIncomplete = Boolean(url) !== Boolean(publishableKey)
export let supabaseConfigurationError: string | null = null

let client: ReturnType<typeof createClient<Database>> | null = null
if (url && publishableKey) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      throw new Error('Для удалённого проекта требуется HTTPS URL.')
    }
    client = createClient<Database>(url, publishableKey)
  } catch (error) {
    supabaseConfigurationError = error instanceof Error ? error.message : 'Некорректный адрес Supabase.'
  }
}

export const supabase = client
export const supabaseConfigured = client !== null
