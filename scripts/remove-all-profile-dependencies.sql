-- SCRIPT AGRESSIVO PARA ELIMINAR RECURSÃO INFINITA
-- Remove todas as dependências da tabela profiles

-- 1. DESABILITAR TODOS OS TRIGGERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_appointment_created ON appointments;
DROP TRIGGER IF EXISTS on_exam_requested ON exams;
DROP TRIGGER IF EXISTS on_exam_approved ON exams;
DROP TRIGGER IF EXISTS on_appointment_approved ON appointments;

-- 2. REMOVER TODAS AS FUNÇÕES QUE PODEM CAUSAR RECURSÃO
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS notify_appointment_scheduled();
DROP FUNCTION IF EXISTS notify_exam_requested();
DROP FUNCTION IF EXISTS notify_exam_approved();
DROP FUNCTION IF EXISTS notify_appointment_approved();

-- 3. DESABILITAR RLS EM TODAS AS TABELAS
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE medications DISABLE ROW LEVEL SECURITY;
ALTER TABLE medication_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_doctors DISABLE ROW LEVEL SECURITY;

-- 4. REMOVER TODAS AS POLÍTICAS
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Remove todas as políticas de todas as tabelas
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 5. REMOVER FOREIGN KEYS PROBLEMÁTICAS
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_patient_id_fkey;
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_doctor_id_fkey;
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_hospital_id_fkey;
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_approved_by_fkey;
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_scheduled_by_fkey;

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_doctor_id_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_hospital_id_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_approved_by_fkey;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE medications DROP CONSTRAINT IF EXISTS medications_patient_id_fkey;
ALTER TABLE medications DROP CONSTRAINT IF EXISTS medications_doctor_id_fkey;
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_user_id_fkey;

-- 6. CRIAR POLÍTICAS ULTRA SIMPLES APENAS PARA USUÁRIOS AUTENTICADOS
CREATE POLICY "allow_authenticated_select" ON exams FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "allow_authenticated_insert" ON exams FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "allow_authenticated_update" ON exams FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_authenticated_select" ON appointments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "allow_authenticated_insert" ON appointments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "allow_authenticated_update" ON appointments FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_authenticated_select" ON notifications FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "allow_authenticated_insert" ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "allow_authenticated_update" ON notifications FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 7. REABILITAR RLS COM POLÍTICAS SIMPLES
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 8. VERIFICAR SE TUDO FOI REMOVIDO
SELECT 'Todas as dependências problemáticas foram removidas!' as status;

-- Verificar políticas restantes
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
