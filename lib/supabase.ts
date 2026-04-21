import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase環境変数が設定されていません', { supabaseUrl, supabaseAnonKey })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function testConnection() {
  const { data, error } = await supabase.from('menus').select('count')
  if (error) {
    console.error('Supabase接続エラー:', error)
    return false
  }
  console.log('Supabase接続成功:', data)
  return true
}