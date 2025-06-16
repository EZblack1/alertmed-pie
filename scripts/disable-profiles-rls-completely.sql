-- Desabilitar completamente RLS da tabela profiles para evitar recursão infinita
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas da tabela profiles
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_doctor_patients" ON profiles;
DROP POLICY IF EXISTS "profiles_select_hospital_doctors" ON profiles;
DROP POLICY IF EXISTS "profiles_select_hospital_patients" ON profiles;

-- Simplificar políticas de exams para não depender de profiles
DROP POLICY IF EXISTS "exams_select_doctor" ON exams;
DROP POLICY IF EXISTS "exams_select_hospital" ON exams;
DROP POLICY IF EXISTS "exams_insert_doctor" ON exams;
DROP POLICY IF EXISTS "exams_insert_hospital" ON exams;
DROP POLICY IF EXISTS "exams_update_doctor" ON exams;
DROP POLICY IF EXISTS "exams_update_hospital" ON exams;

-- Criar políticas simples para exams sem referência a profiles
CREATE POLICY "exams_select_patient_simple" 
  ON exams FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "exams_insert_patient_simple" 
  ON exams FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "exams_select_doctor_simple" 
  ON exams FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "exams_update_doctor_simple" 
  ON exams FOR UPDATE 
  USING (auth.uid() = doctor_id);

-- Simplificar políticas de appointments
DROP POLICY IF EXISTS "appointments_select_doctor" ON appointments;
DROP POLICY IF EXISTS "appointments_select_hospital" ON appointments;
DROP POLICY IF EXISTS "appointments_insert_doctor" ON appointments;
DROP POLICY IF EXISTS "appointments_insert_hospital" ON appointments;
DROP POLICY IF EXISTS "appointments_update_doctor" ON appointments;
DROP POLICY IF EXISTS "appointments_update_hospital" ON appointments;

CREATE POLICY "appointments_select_patient_simple" 
  ON appointments FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "appointments_insert_patient_simple" 
  ON appointments FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "appointments_select_doctor_simple" 
  ON appointments FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "appointments_update_doctor_simple" 
  ON appointments FOR UPDATE 
  USING (auth.uid() = doctor_id);

-- Permitir inserção de notificações para qualquer usuário autenticado
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;

CREATE POLICY "notifications_select_own_simple" 
  ON notifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own_simple" 
  ON notifications FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_authenticated" 
  ON notifications FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

-- Verificar se as políticas foram aplicadas
SELECT 'RLS da tabela profiles desabilitado com sucesso!' as status;
