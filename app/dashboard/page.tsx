import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Calendar, FileText, Pill, Bell, AlertTriangle } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"

export default async function Dashboard() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  const userId = session.user.id

  // Verificar se as tabelas existem
  let tablesExist = true
  let errorMessage = ""

  try {
    // Tentar buscar o perfil do usuário
    const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", userId).single()

    if (profileError) {
      if (profileError.message.includes("does not exist")) {
        tablesExist = false
        errorMessage = "A tabela 'profiles' não existe no banco de dados."
      }
    }

    // Se a tabela profiles existe, verificar as outras tabelas
    if (tablesExist) {
      // Verificar tabela de notificações
      const { error: notificationsError } = await supabase
        .from("notifications")
        .select("count", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false)

      if (notificationsError && notificationsError.message.includes("does not exist")) {
        tablesExist = false
        errorMessage = "A tabela 'notifications' não existe no banco de dados."
      }

      // Verificar tabela de consultas
      const { error: appointmentsError } = await supabase
        .from("appointments")
        .select("count", { count: "exact", head: true })
        .eq("patient_id", userId)

      if (appointmentsError && appointmentsError.message.includes("does not exist")) {
        tablesExist = false
        errorMessage = "A tabela 'appointments' não existe no banco de dados."
      }

      // Verificar tabela de exames
      const { error: examsError } = await supabase
        .from("exams")
        .select("count", { count: "exact", head: true })
        .eq("patient_id", userId)

      if (examsError && examsError.message.includes("does not exist")) {
        tablesExist = false
        errorMessage = "A tabela 'exams' não existe no banco de dados."
      }

      // Verificar tabela de medicamentos
      const { error: medicationsError } = await supabase
        .from("medications")
        .select("count", { count: "exact", head: true })
        .eq("patient_id", userId)

      if (medicationsError && medicationsError.message.includes("does not exist")) {
        tablesExist = false
        errorMessage = "A tabela 'medications' não existe no banco de dados."
      }
    }
  } catch (error: any) {
    console.error("Erro ao verificar tabelas:", error)
    tablesExist = false
    errorMessage = error.message || "Erro ao verificar as tabelas no banco de dados."
  }

  // Se as tabelas não existem, mostrar mensagem de erro
  if (!tablesExist) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Bem-vindo ao AlertMed</p>
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro no banco de dados</AlertTitle>
          <AlertDescription>
            {errorMessage} Execute o script SQL para criar as tabelas necessárias.
            <div className="mt-4">
              <p className="font-medium">Para resolver este problema:</p>
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>Acesse o painel do Supabase</li>
                <li>Vá para a seção "SQL Editor"</li>
                <li>Execute o script SQL fornecido para criar as tabelas necessárias</li>
                <li>Recarregue esta página</li>
              </ol>
            </div>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Script SQL</CardTitle>
            <CardDescription>
              Execute este script no SQL Editor do Supabase para criar as tabelas necessárias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
              {`-- Habilitar a extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de perfis (complementa a tabela auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  user_type TEXT CHECK (user_type IN ('patient', 'doctor', 'admin')),
  date_of_birth DATE
);

-- Tabela de exames
CREATE TABLE IF NOT EXISTS exams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES profiles(id),
  exam_type TEXT NOT NULL,
  exam_date TIMESTAMP WITH TIME ZONE,
  result_available BOOLEAN DEFAULT FALSE,
  result_date TIMESTAMP WITH TIME ZONE,
  result_details TEXT,
  result_file_url TEXT,
  notes TEXT
);

-- Tabela de medicamentos
CREATE TABLE IF NOT EXISTS medications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES profiles(id),
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  instructions TEXT,
  active BOOLEAN DEFAULT TRUE
);

-- Tabela de horários de medicamentos
CREATE TABLE IF NOT EXISTS medication_schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  medication_id UUID REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  taken BOOLEAN DEFAULT FALSE,
  taken_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de consultas
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES profiles(id),
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL, -- duração em minutos
  status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')) DEFAULT 'scheduled',
  notes TEXT,
  location TEXT
);

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('exam_result', 'medication_reminder', 'appointment_reminder')),
  content TEXT NOT NULL,
  related_id UUID, -- ID do exame, medicamento ou consulta relacionado
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Configurar Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para perfis
CREATE POLICY "Usuários podem ver seus próprios perfis" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seus próprios perfis" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Políticas para exames
CREATE POLICY "Pacientes podem ver seus próprios exames" 
  ON exams FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "Médicos podem ver exames de seus pacientes" 
  ON exams FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem inserir exames" 
  ON exams FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'doctor'));

CREATE POLICY "Médicos podem atualizar exames" 
  ON exams FOR UPDATE 
  USING (auth.uid() = doctor_id);

-- Políticas para medicamentos
CREATE POLICY "Pacientes podem ver seus próprios medicamentos" 
  ON medications FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "Médicos podem ver medicamentos de seus pacientes" 
  ON medications FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem inserir medicamentos" 
  ON medications FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'doctor'));

CREATE POLICY "Médicos podem atualizar medicamentos" 
  ON medications FOR UPDATE 
  USING (auth.uid() = doctor_id);

-- Políticas para horários de medicamentos
CREATE POLICY "Pacientes podem ver seus próprios horários de medicamentos" 
  ON medication_schedules FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM medications 
    WHERE medications.id = medication_schedules.medication_id 
    AND medications.patient_id = auth.uid()
  ));

CREATE POLICY "Pacientes podem atualizar seus próprios horários de medicamentos" 
  ON medication_schedules FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM medications 
    WHERE medications.id = medication_schedules.medication_id 
    AND medications.patient_id = auth.uid()
  ));

-- Políticas para consultas
CREATE POLICY "Pacientes podem ver suas próprias consultas" 
  ON appointments FOR SELECT 
  USING (auth.uid() = patient_id);

CREATE POLICY "Médicos podem ver consultas de seus pacientes" 
  ON appointments FOR SELECT 
  USING (auth.uid() = doctor_id);

CREATE POLICY "Médicos podem inserir consultas" 
  ON appointments FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'doctor'));

CREATE POLICY "Médicos podem atualizar consultas" 
  ON appointments FOR UPDATE 
  USING (auth.uid() = doctor_id);

-- Políticas para notificações
CREATE POLICY "Usuários podem ver suas próprias notificações" 
  ON notifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias notificações" 
  ON notifications FOR UPDATE 
  USING (auth.uid() = user_id);

-- Trigger para criar perfil automaticamente após cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email, user_type)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', new.email, 'patient');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();`}
            </pre>
          </CardContent>
          <CardFooter>
            <form
              action={async () => {
                "use server"
                // Esta é uma Server Action que permite recarregar a página
                // Não faz nada além de forçar um recarregamento
              }}
            >
              <Button type="submit" className="w-full">
                Recarregar após executar o script
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Buscar dados do usuário
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single()

  // Buscar próximas consultas
  const { data: upcomingAppointments } = await supabase
    .from("appointments")
    .select("*")
    .eq("patient_id", userId)
    .eq("status", "scheduled")
    .gte("appointment_date", new Date().toISOString())
    .order("appointment_date", { ascending: true })
    .limit(3)

  // Buscar exames pendentes
  const { data: pendingExams } = await supabase
    .from("exams")
    .select("*")
    .eq("patient_id", userId)
    .eq("result_available", false)
    .order("exam_date", { ascending: true })
    .limit(3)

  // Buscar medicamentos ativos
  const { data: activeMedications } = await supabase
    .from("medications")
    .select("*")
    .eq("patient_id", userId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(3)

  // Buscar notificações não lidas
  const { data: unreadNotifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("read", false)
    .order("created_at", { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Olá, {profile?.full_name || "Paciente"}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consultas Agendadas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingAppointments?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {upcomingAppointments && upcomingAppointments.length > 0
                ? `Próxima: ${new Date(upcomingAppointments[0].appointment_date).toLocaleDateString("pt-BR")}`
                : "Nenhuma consulta agendada"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exames Pendentes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingExams?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {pendingExams && pendingExams.length > 0
                ? `Próximo: ${pendingExams[0].exam_type}`
                : "Nenhum exame pendente"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medicamentos Ativos</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeMedications?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {activeMedications && activeMedications.length > 0
                ? `${activeMedications[0].medication_name} e outros`
                : "Nenhum medicamento ativo"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notificações</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadNotifications?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {unreadNotifications && unreadNotifications.length > 0
                ? "Você tem notificações não lidas"
                : "Nenhuma notificação não lida"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Próximas Consultas</CardTitle>
            <CardDescription>Suas consultas agendadas para os próximos dias</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingAppointments && upcomingAppointments.length > 0 ? (
              <div className="space-y-4">
                {upcomingAppointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center">
                    <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-4">
                      <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {new Date(appointment.appointment_date).toLocaleDateString("pt-BR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(appointment.appointment_date).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" - "}
                        {appointment.location || "Local não especificado"}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/consultas/${appointment.id}`}>Ver detalhes</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Nenhuma consulta agendada</p>
                <Button className="mt-4" asChild>
                  <Link href="/dashboard/consultas">Agendar Consulta</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Notificações Recentes</CardTitle>
            <CardDescription>Suas notificações não lidas</CardDescription>
          </CardHeader>
          <CardContent>
            {unreadNotifications && unreadNotifications.length > 0 ? (
              <div className="space-y-4">
                {unreadNotifications.map((notification) => {
                  let icon = <Bell className="h-5 w-5" />

                  if (notification.type === "exam_result") {
                    icon = <FileText className="h-5 w-5" />
                  } else if (notification.type === "medication_reminder") {
                    icon = <Pill className="h-5 w-5" />
                  } else if (notification.type === "appointment_reminder") {
                    icon = <Calendar className="h-5 w-5" />
                  }

                  return (
                    <div key={notification.id} className="flex items-start space-x-4">
                      <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">{icon}</div>
                      <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium">{notification.content}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(notification.created_at).toLocaleString("pt-BR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Bell className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Nenhuma notificação não lida</p>
                <Button className="mt-4" variant="outline" asChild>
                  <Link href="/dashboard/notificacoes">Ver Todas</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Exames Pendentes</CardTitle>
            <CardDescription>Exames agendados ou aguardando resultados</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingExams && pendingExams.length > 0 ? (
              <div className="space-y-4">
                {pendingExams.map((exam) => (
                  <div key={exam.id} className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-4">
                      <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{exam.exam_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {exam.exam_date
                          ? `Data: ${new Date(exam.exam_date).toLocaleDateString("pt-BR")}`
                          : "Data não agendada"}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/exames/${exam.id}`}>Detalhes</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <FileText className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Nenhum exame pendente</p>
                <Button className="mt-4" variant="outline" asChild>
                  <Link href="/dashboard/exames">Ver Todos</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medicamentos Ativos</CardTitle>
            <CardDescription>Medicamentos que você está tomando atualmente</CardDescription>
          </CardHeader>
          <CardContent>
            {activeMedications && activeMedications.length > 0 ? (
              <div className="space-y-4">
                {activeMedications.map((medication) => (
                  <div key={medication.id} className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-4">
                      <Pill className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{medication.medication_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {medication.dosage} - {medication.frequency}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/medicamentos/${medication.id}`}>Detalhes</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Pill className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Nenhum medicamento ativo</p>
                <Button className="mt-4" variant="outline" asChild>
                  <Link href="/dashboard/medicamentos">Ver Todos</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
