// Arquivo para garantir que as variáveis de ambiente estejam disponíveis
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ankvvivavgghzjpqqmnk.supabase.co"
export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFua3Z2aXZhdmdnaHpqcHFxbW5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4NzgzMzIsImV4cCI6MjA2MjQ1NDMzMn0.PNjVuLg5lixqK8aSC_mTZOTmoMI3vJYn_s2CRPamoKo"
