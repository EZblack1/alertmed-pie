-- Garantir que todas as colunas necessárias existem na tabela profiles

-- Adicionar colunas se não existirem
DO $$ 
BEGIN
  -- Verificar e adicionar created_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'created_at') THEN
    ALTER TABLE profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
  
  -- Verificar e adicionar updated_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
  
  -- Verificar e adicionar user_type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'user_type') THEN
    ALTER TABLE profiles ADD COLUMN user_type TEXT CHECK (user_type IN ('patient', 'doctor', 'admin')) DEFAULT 'patient';
  END IF;
  
  -- Verificar e adicionar email se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'email') THEN
    ALTER TABLE profiles ADD COLUMN email TEXT;
  END IF;
END $$;

-- Atualizar registros existentes
UPDATE profiles SET 
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now()),
  user_type = COALESCE(user_type, 'patient')
WHERE created_at IS NULL OR updated_at IS NULL OR user_type IS NULL;

-- Verificar estrutura final
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
