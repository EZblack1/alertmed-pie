-- ========================================
-- CORRIGIR POLÍTICAS RLS COM RECURSÃO INFINITA
-- ========================================

-- Remover todas as políticas existentes que causam recursão
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_doctor_patients" ON profiles;
DROP POLICY IF EXISTS "profiles_select_hospital_doctors" ON profiles;
DROP POLICY IF EXISTS "profiles_select_hospital_patients" ON profiles;

-- Remover políticas problemáticas de outras tabelas
DROP POLICY IF EXISTS "exams_select_doctor" ON exams;
DROP POLICY IF EXISTS "exams_select_hospital" ON exams;
DROP POLICY IF EXISTS "exams_insert_doctor" ON exams;
DROP POLICY IF EXISTS "exams_insert_hospital" ON exams;
DROP POLICY IF EXISTS "exams_update_doctor" ON exams;
DROP POLICY IF EXISTS "exams_update_hospital" ON exams;

DROP POLICY IF EXISTS "appointments_select_doctor" ON appointments;
DROP POLICY IF EXISTS "appointments_select_hospital" ON appointments;
DROP POLICY IF EXISTS "appointments_insert_doctor" ON appointments;
DROP POLICY IF EXISTS "appointments_insert_hospital" ON appointments;
DROP POLICY IF EXISTS "appointments_update_doctor" ON appointments;
DROP POLICY IF EXISTS "appointments_update_hospital" ON appointments;

DROP POLICY IF EXISTS "medications_select_doctor" ON medications;
DROP POLICY IF EXISTS "medications_insert_doctor" ON medications;
DROP POLICY IF EXISTS "medications_update_doctor" ON medications;

DROP POLICY IF EXISTS "medication_schedules_select_doctor" ON medication_schedules;
DROP POLICY IF EXISTS "medication_schedules_update_doctor" ON medication_schedules;

DROP POLICY IF EXISTS "doctor_patients_insert_doctor" ON doctor_patients;
DROP POLICY IF EXISTS "hospital_doctors_insert_hospital" ON hospital_doctors;

-- ========================================
-- CRIAR POLÍTICAS SIMPLES SEM RECURSÃO
-- ========================================

-- Políticas básicas para perfis (sem referência circular)
CREATE POLICY "profiles_select_own" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Política para permitir que usuários autenticados vejam perfis básicos
CREATE POLICY "profiles_select_authenticated" 
  ON profiles FOR SELECT 
  USING (auth.role() = 'authenticated');

-- ========================================
-- POLÍTICAS PARA EXAMES (SIMPLIFICADAS)
-- ========================================

CREATE POLICY "exams_select_patient" 
  ON exams FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "exams_select_doctor" 
  ON exams FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "exams_select_hospital" 
  ON exams FOR SELECT 
  USING (auth.uid() = hospital_id);

CREATE POLICY "exams_insert_patient" 
  ON exams FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "exams_insert_authenticated" 
  ON exams FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "exams_update_authenticated" 
  ON exams FOR UPDATE 
  USING (
    auth.uid() = patient_id 
    OR auth.uid() = doctor_id 
    OR auth.uid() = hospital_id
  );

-- ========================================
-- POLÍTICAS PARA CONSULTAS (SIMPLIFICADAS)
-- ========================================

CREATE POLICY "appointments_select_patient" 
  ON appointments FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "appointments_select_doctor" 
  ON appointments FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "appointments_select_hospital" 
  ON appointments FOR SELECT 
  USING (auth.uid() = hospital_id);

CREATE POLICY "appointments_insert_patient" 
  ON appointments FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "appointments_insert_authenticated" 
  ON appointments FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "appointments_update_authenticated" 
  ON appointments FOR UPDATE 
  USING (
    auth.uid() = patient_id 
    OR auth.uid() = doctor_id 
    OR auth.uid() = hospital_id
  );

-- ========================================
-- POLÍTICAS PARA MEDICAMENTOS (SIMPLIFICADAS)
-- ========================================

CREATE POLICY "medications_select_patient" 
  ON medications FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "medications_select_doctor" 
  ON medications FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "medications_insert_authenticated" 
  ON medications FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "medications_update_authenticated" 
  ON medications FOR UPDATE 
  USING (
    auth.uid() = patient_id 
    OR auth.uid() = doctor_id
  );

-- ========================================
-- POLÍTICAS PARA HORÁRIOS DE MEDICAMENTOS (SIMPLIFICADAS)
-- ========================================

CREATE POLICY "medication_schedules_select_patient" 
  ON medication_schedules FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM medications 
      WHERE medications.id = medication_schedules.medication_id 
      AND medications.patient_id = auth.uid()
    )
  );

CREATE POLICY "medication_schedules_select_doctor" 
  ON medication_schedules FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM medications 
      WHERE medications.id = medication_schedules.medication_id 
      AND medications.doctor_id = auth.uid()
    )
  );

CREATE POLICY "medication_schedules_update_patient" 
  ON medication_schedules FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM medications 
      WHERE medications.id = medication_schedules.medication_id 
      AND medications.patient_id = auth.uid()
    )
  );

CREATE POLICY "medication_schedules_update_doctor" 
  ON medication_schedules FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM medications 
      WHERE medications.id = medication_schedules.medication_id 
      AND medications.doctor_id = auth.uid()
    )
  );

-- ========================================
-- POLÍTICAS PARA RELACIONAMENTOS (SIMPLIFICADAS)
-- ========================================

CREATE POLICY "doctor_patients_select_doctor" 
  ON doctor_patients FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "doctor_patients_select_patient" 
  ON doctor_patients FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "doctor_patients_insert_authenticated" 
  ON doctor_patients FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "doctor_patients_update_doctor" 
  ON doctor_patients FOR UPDATE 
  USING (auth.uid() = doctor_id);

CREATE POLICY "hospital_doctors_select_hospital" 
  ON hospital_doctors FOR SELECT 
  USING (auth.uid() = hospital_id);

CREATE POLICY "hospital_doctors_select_doctor" 
  ON hospital_doctors FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "hospital_doctors_insert_authenticated" 
  ON hospital_doctors FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "hospital_doctors_update_hospital" 
  ON hospital_doctors FOR UPDATE 
  USING (auth.uid() = hospital_id);

-- ========================================
-- POLÍTICAS PARA NOTIFICAÇÕES E LOGS (MANTIDAS)
-- ========================================

-- Políticas para notificações (já estão corretas)
CREATE POLICY "notifications_select_own" 
  ON notifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" 
  ON notifications FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_authenticated" 
  ON notifications FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Políticas para logs de email (já estão corretas)
CREATE POLICY "email_logs_select_own" 
  ON email_logs FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "email_logs_insert_authenticated" 
  ON email_logs FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- ========================================
-- VERIFICAÇÃO DAS POLÍTICAS
-- ========================================

-- Verificar políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('profiles', 'exams', 'medications', 'medication_schedules', 'appointments', 'notifications', 'email_logs', 'doctor_patients', 'hospital_doctors')
ORDER BY tablename, policyname;

-- Mostrar mensagem de sucesso
SELECT 'Políticas RLS corrigidas com sucesso! Recursão infinita resolvida.' as status;
