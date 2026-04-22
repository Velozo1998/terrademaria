import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mjttwalhvseuxeoyivre.supabase.co'
const supabaseKey = 'sb_publishable_-ZW4htliwBkZHcf_HX4dLA_iZgDqgQH'

export const supabase = createClient(supabaseUrl, supabaseKey)
