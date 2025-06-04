-- Corrigir políticas RLS para permitir inserção de perfis

-- Remover política existente se houver
DROP POLICY IF EXISTS "Usuários podem inserir seus próprios perfis" ON profiles;

-- Adicionar política para permitir inserção de perfis
CREATE POLICY "Usuários podem inserir seus próprios perfis" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Verificar se a política de atualização existe
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios perfis" ON profiles;

CREATE POLICY "Usuários podem atualizar seus próprios perfis" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Verificar se a política de seleção existe
DROP POLICY IF EXISTS "Usuários podem ver seus próprios perfis" ON profiles;

CREATE POLICY "Usuários podem ver seus próprios perfis" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

-- Garantir que as colunas necessárias existem na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_type TEXT CHECK (user_type IN ('patient', 'doctor', 'admin')) DEFAULT 'patient';

-- Atualizar a função de criação automática de perfil
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email, user_type)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 
    new.raw_user_meta_data->>'avatar_url', 
    new.email, 
    'patient'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar o trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
