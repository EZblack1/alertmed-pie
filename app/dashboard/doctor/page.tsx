import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Users, FileText, AlertCircle, Activity } from "lucide-react"
import Link from "next/link"

export default async function DoctorDashboard() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  // Verificar se o usuário é médico
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single()

  if (profileError || !profile || profile.user_type !== "doctor") {
    redirect("/dashboard")
  }

  // Buscar consultas do dia
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data: todayAppointments } = await supabase
    .from("appointments")
    .select(`
      *,
      patient:profiles!appointments_patient_id_fkey(full_name, email)
    `)
    .eq("doctor_id", session.user.id)
    .gte("appointment_date", today.toISOString())
    .lt("appointment_date", tomorrow.toISOString())
    .order("appointment_date")

  // Buscar pacientes ativos (usando appointments para simular relacionamento)
  const { data: patientAppointments } = await supabase
    .from("appointments")
    .select(`
      patient:profiles!appointments_patient_id_fkey(id, full_name, email)
    `)
    .eq("doctor_id", session.user.id)
    .not("patient", "is", null)

  // Extrair pacientes únicos
  const uniquePatients =
    patientAppointments?.reduce((acc, appointment) => {
      if (appointment.patient && !acc.find((p) => p.id === appointment.patient.id)) {
        acc.push(appointment.patient)
      }
      return acc
    }, [] as any[]) || []

  // Buscar exames pendentes
  const { data: pendingExams } = await supabase
    .from("exams")
    .select(`
      *,
      patient:profiles!exams_patient_id_fkey(full_name)
    `)
    .eq("doctor_id", session.user.id)
    .in("status", ["requested", "scheduled"])
    .order("created_at", { ascending: false })

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Médico</h1>
          <p className="text-gray-600">Bem-vindo, Dr(a). {profile.full_name}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Activity className="h-4 w-4" />
          <span>Sistema Online</span>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consultas Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayAppointments?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {todayAppointments?.length === 1 ? "consulta agendada" : "consultas agendadas"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pacientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniquePatients.length}</div>
            <p className="text-xs text-muted-foreground">pacientes em acompanhamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exames Pendentes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingExams?.length || 0}</div>
            <p className="text-xs text-muted-foreground">aguardando análise</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <AlertCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Online</div>
            <p className="text-xs text-muted-foreground">sistema funcionando</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="agenda" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agenda">Agenda do Dia</TabsTrigger>
          <TabsTrigger value="pacientes">Pacientes</TabsTrigger>
          <TabsTrigger value="exames">Exames</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Consultas de Hoje</CardTitle>
              <CardDescription>
                {new Date().toLocaleDateString("pt-BR", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {todayAppointments && todayAppointments.length > 0 ? (
                <div className="space-y-4">
                  {todayAppointments.map((appointment) => (
                    <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">
                            {new Date(appointment.appointment_date).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{appointment.patient?.full_name || "Paciente"}</p>
                          <p className="text-sm text-gray-500">{appointment.specialty || "Consulta Geral"}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            appointment.status === "scheduled"
                              ? "bg-blue-100 text-blue-800"
                              : appointment.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {appointment.status === "scheduled"
                            ? "Agendada"
                            : appointment.status === "completed"
                              ? "Concluída"
                              : appointment.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhuma consulta agendada para hoje</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pacientes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Meus Pacientes</CardTitle>
              <CardDescription>Pacientes em acompanhamento</CardDescription>
            </CardHeader>
            <CardContent>
              {uniquePatients.length > 0 ? (
                <div className="space-y-4">
                  {uniquePatients.map((patient) => (
                    <div key={patient.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{patient.full_name}</p>
                        <p className="text-sm text-gray-500">{patient.email}</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Ver Histórico
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum paciente em acompanhamento</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exames" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exames Pendentes</CardTitle>
              <CardDescription>Exames aguardando análise ou agendamento</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingExams && pendingExams.length > 0 ? (
                <div className="space-y-4">
                  {pendingExams.map((exam) => (
                    <div key={exam.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{exam.exam_type}</p>
                        <p className="text-sm text-gray-500">Paciente: {exam.patient?.full_name || "N/A"}</p>
                        <p className="text-xs text-gray-400">
                          Solicitado em: {new Date(exam.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            exam.status === "requested"
                              ? "bg-yellow-100 text-yellow-800"
                              : exam.status === "scheduled"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {exam.status === "requested"
                            ? "Solicitado"
                            : exam.status === "scheduled"
                              ? "Agendado"
                              : exam.status}
                        </span>
                        <Button variant="outline" size="sm">
                          Analisar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum exame pendente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Ações rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button asChild className="h-20 flex-col">
              <Link href="/dashboard/consultas">
                <Calendar className="h-6 w-6 mb-2" />
                <span>Gerenciar Agenda</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link href="/dashboard/doctor/patients">
                <Users className="h-6 w-6 mb-2" />
                <span>Ver Pacientes</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link href="/dashboard/exames">
                <FileText className="h-6 w-6 mb-2" />
                <span>Solicitar Exames</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
