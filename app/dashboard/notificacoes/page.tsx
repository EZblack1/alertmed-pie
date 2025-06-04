import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Bell, Calendar, FileText, Pill, CheckCircle, AlertTriangle } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default async function NotificationsPage() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  const userId = session.user.id

  // Verificar se a tabela existe
  let tableExists = true
  let errorMessage = ""
  let notifications: any[] = []

  try {
    // Tentar buscar notificações
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      if (error.message.includes("does not exist")) {
        tableExists = false
        errorMessage = "A tabela 'notifications' não existe no banco de dados."
      } else {
        throw error
      }
    } else {
      notifications = data || []
    }
  } catch (error: any) {
    console.error("Erro ao buscar notificações:", error)
    if (error.message.includes("does not exist")) {
      tableExists = false
      errorMessage = "A tabela 'notifications' não existe no banco de dados."
    }
  }

  // Se a tabela não existe, mostrar mensagem de erro
  if (!tableExists) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
          <p className="text-muted-foreground">Gerencie suas notificações</p>
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro no banco de dados</AlertTitle>
          <AlertDescription>
            {errorMessage}
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

  const unreadNotifications = notifications.filter((notification) => !notification.read)
  const readNotifications = notifications.filter((notification) => notification.read)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
        {unreadNotifications.length > 0 && (
          <form
            action={async () => {
              "use server"
              const unreadIds = notifications
                .filter((notification) => !notification.read)
                .map((notification) => notification.id)

              if (unreadIds.length === 0) return

              await supabase
                .from("notifications")
                .update({ read: true, read_at: new Date().toISOString() })
                .in("id", unreadIds)

              // Redirecionar para a mesma página para atualizar os dados
              redirect("/dashboard/notificacoes")
            }}
          >
            <Button variant="outline" type="submit">
              Marcar todas como lidas
            </Button>
          </form>
        )}
      </div>

      <Tabs defaultValue="unread" className="space-y-4">
        <TabsList>
          <TabsTrigger value="unread">
            Não lidas
            {unreadNotifications.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unreadNotifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="read">Lidas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>

        <TabsContent value="unread" className="space-y-4">
          {unreadNotifications.length > 0 ? (
            unreadNotifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))
          ) : (
            <EmptyState message="Nenhuma notificação não lida" />
          )}
        </TabsContent>

        <TabsContent value="read" className="space-y-4">
          {readNotifications.length > 0 ? (
            readNotifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))
          ) : (
            <EmptyState message="Nenhuma notificação lida" />
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {notifications.length > 0 ? (
            notifications.map((notification) => <NotificationCard key={notification.id} notification={notification} />)
          ) : (
            <EmptyState />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function NotificationCard({ notification }: { notification: any }) {
  let icon = <Bell className="h-5 w-5" />

  if (notification.type === "exam_result") {
    icon = <FileText className="h-5 w-5" />
  } else if (notification.type === "medication_reminder") {
    icon = <Pill className="h-5 w-5" />
  } else if (notification.type === "appointment_reminder") {
    icon = <Calendar className="h-5 w-5" />
  }

  return (
    <Card className={notification.read ? "opacity-75" : ""}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-start space-x-4">
            <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">{icon}</div>
            <div>
              <CardTitle className="text-base">{notification.content}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(notification.created_at).toLocaleString("pt-BR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {!notification.read && (
            <form
              action={async () => {
                "use server"
                const supabase = createClient()
                await supabase
                  .from("notifications")
                  .update({ read: true, read_at: new Date().toISOString() })
                  .eq("id", notification.id)

                redirect("/dashboard/notificacoes")
              }}
            >
              <Button variant="ghost" size="icon" type="submit">
                <CheckCircle className="h-5 w-5" />
                <span className="sr-only">Marcar como lida</span>
              </Button>
            </form>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {notification.read && (
          <p className="text-xs text-muted-foreground">
            Lida em:{" "}
            {notification.read_at
              ? new Date(notification.read_at).toLocaleString("pt-BR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "N/A"}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyState({ message = "Nenhuma notificação encontrada" }: { message?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <Bell className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}
