-- Adicionar colunas que estão faltando na tabela appointments

-- Adicionar coluna appointment_type se não existir
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_type TEXT CHECK (appointment_type IN ('primeira-consulta', 'retorno', 'urgencia', 'check-up')) DEFAULT 'primeira-consulta';

-- Adicionar coluna specialty se não existir
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS specialty TEXT;

-- Adicionar colunas de confirmação se não existirem
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMP WITH TIME ZONE;

-- Verificar se todas as colunas necessárias existem
DO $$
BEGIN
    -- Verificar se a coluna location existe, se não, adicionar
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'location') THEN
        ALTER TABLE appointments ADD COLUMN location TEXT;
    END IF;
    
    -- Verificar se a coluna notes existe, se não, adicionar
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'notes') THEN
        ALTER TABLE appointments ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Atualizar registros existentes que podem ter valores NULL
UPDATE appointments 
SET appointment_type = 'primeira-consulta' 
WHERE appointment_type IS NULL;

UPDATE appointments 
SET confirmation_sent = FALSE 
WHERE confirmation_sent IS NULL;

-- Mostrar estrutura atual da tabela para verificação
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'appointments' 
ORDER BY ordinal_position;
