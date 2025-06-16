import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Users, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { revalidatePath } from "next/cache"

export default async function HospitalAppointments() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  // Verificar se o usuário é hospital/admin
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

  if (!profile || !["hospital", "admin"].includes(profile.user_type)) {
    redirect("/dashboard")
  }

  // Buscar consultas pendentes de aprovação
  const { data: pendingAppointments } = await supabase
    .from("appointments")
    .select(`
      *,
      patient:profiles!appointments_patient_id_fkey(id, full_name, email, phone),
      doctor:profiles!appointments_doctor_id_fkey(id, full_name, email, specialties)
    `)
    .eq("approval_status", "pending")
    .order("created_at", { ascending: false })

  // Buscar consultas agendadas para hoje
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data: todayAppointments } = await supabase
    .from("appointments")
    .select(`
      *,
      patient:profiles!appointments_patient_id_fkey(id, full_name, email, phone),
      doctor:profiles!appointments_doctor_id_fkey(id, full_name, email, specialties)
    `)
    .eq("status", "scheduled")
    .gte("appointment_date", today.toISOString())
    .lt("appointment_date", tomorrow.toISOString())
    .order("appointment_date")

  // Buscar consultas futuras
  const { data: upcomingAppointments } = await supabase
    .from("appointments")
    .select(`
      *,
      patient:profiles!appointments_patient_id_fkey(id, full_name, email, phone),
      doctor:profiles!appointments_doctor_id_fkey(id, full_name, email, specialties)
    `)
    .eq("status", "scheduled")
    .gt("appointment_date", tomorrow.toISOString())
    .order("appointment_date")
    .limit(10)

  // Função para aprovar consulta
  async function approveAppointment(id: string) {
    "use server"

    const supabase = createClient()

    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          approval_status: "approved",
          status: "scheduled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (error) {
        console.error("Erro ao aprovar consulta:", error)
        return { success: false, error: error.message }
      }

      // Buscar dados da consulta para notificação
      const { data: appointment } = await supabase
        .from("appointments")
        .select("patient_id, appointment_date, specialty")
        .eq("id", id)
        .single()

      if (appointment) {
        await supabase.from("notifications").insert({
          user_id: appointment.patient_id,
          type: "appointment_reminder",
          content: `Sua consulta de ${appointment.specialty || "consulta"} para ${new Date(appointment.appointment_date).toLocaleDateString("pt-BR")} foi aprovada!`,
          related_id: id,
          read: false,
        })
      }

      revalidatePath("/dashboard/hospital/appointments")
      return { success: true, message: "Consulta aprovada com sucesso" }
    } catch (error: any) {
      console.error("Erro ao aprovar consulta:", error)
      return { success: false, error: error.message }
    }
  }

  // Função para rejeitar consulta
  async function rejectAppointment(id: string) {
    "use server"

    const supabase = createClient()

    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          approval_status: "rejected",
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (error) {
        console.error("Erro ao rejeitar consulta:", error)
        return { success: false, error: error.message }
      }

      // Buscar dados da consulta para notificação
      const { data: appointment } = await supabase
        .from("appointments")
        .select("patient_id, appointment_date, specialty")
        .eq("id", id)
        .single()

      if (appointment) {
        await supabase.from("notifications").insert({
          user_id: appointment.patient_id,
          type: "appointment_reminder",
          content: `Sua solicitação de consulta de ${appointment.specialty || "consulta"} para ${new Date(appointment.appointment_date).toLocaleDateString("pt-BR")} foi rejeitada.`,
          related_id: id,
          read: false,
        })
      }

      revalidatePath("/dashboard/hospital/appointments")
      return { success: true, message: "Consulta rejeitada" }
    } catch (error: any) {
      console.error("Erro ao rejeitar consulta:", error)
      return { success: false, error: error.message }
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Consultas</h1>
          <p className="text-gray-600">{profile.hospital_name || profile.full_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/hospital">
              <Calendar className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard/hospital/appointments/new">
              <Calendar className="h-4 w-4 mr-2" />
              Nova Consulta
            </Link>
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingAppointments?.length || 0}</div>
            <p className="text-xs text-muted-foreground">aguardando aprovação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayAppointments?.length || 0}</div>
            <p className="text-xs text-muted-foreground">consultas para hoje</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximas</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingAppointments?.length || 0}</div>
            <p className="text-xs text-muted-foreground">consultas agendadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Aprovação</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-muted-foreground">consultas aprovadas</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pendentes
            {pendingAppointments && pendingAppointments.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingAppointments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="today">Hoje</TabsTrigger>
          <TabsTrigger value="upcoming">Próximas</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Consultas Pendentes de Aprovação</CardTitle>
              <CardDescription>Solicitações que precisam de sua aprovação</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingAppointments && pendingAppointments.length > 0 ? (
                <div className="space-y-4">
                  {pendingAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <AlertCircle className="h-4 w-4 text-yellow-500 mr-2" />
                          <p className="font-medium">{appointment.patient?.full_name}</p>
                          <Badge variant="outline" className="ml-2">
                            {appointment.appointment_type === "primeira-consulta"
                              ? "Primeira Consulta"
                              : appointment.appointment_type === "retorno"
                                ? "Retorno"
                                : appointment.appointment_type === "urgencia"
                                  ? "Urgência"
                                  : "Check-up"}
                          </Badge>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            <span>
                              {new Date(appointment.appointment_date).toLocaleDateString("pt-BR")} às{" "}
                              {new Date(appointment.appointment_date).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            <span>
                              {appointment.doctor?.full_name || "Médico não especificado"} -{" "}
                              {appointment.specialty || "Especialidade não especificada"}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400">
                          Solicitado{" "}
                          {formatDistanceToNow(new Date(appointment.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                        {appointment.notes && (
                          <p className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                            <span className="font-medium">Observações:</span> {appointment.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-4 md:mt-0">
                        <form action={approveAppointment.bind(null, appointment.id)}>
                          <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                        </form>
                        <form action={rejectAppointment.bind(null, appointment.id)}>
                          <Button type="submit" variant="destructive" size="sm">
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-300" />
                  <p>Não há consultas pendentes de aprovação</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="today" className="space-y-4">
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
                    <div
                      key={appointment.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 text-blue-500 mr-2" />
                          <p className="font-medium">{appointment.patient?.full_name}</p>
                          <Badge variant="outline" className="ml-2">
                            {appointment.appointment_type === "primeira-consulta"
                              ? "Primeira Consulta"
                              : appointment.appointment_type === "retorno"
                                ? "Retorno"
                                : appointment.appointment_type === "urgencia"
                                  ? "Urgência"
                                  : "Check-up"}
                          </Badge>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            <span>
                              {new Date(appointment.appointment_date).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            <span>
                              {appointment.doctor?.full_name || "Médico não especificado"} -{" "}
                              {appointment.specialty || "Especialidade não especificada"}
                            </span>
                          </div>
                        </div>
                        {appointment.notes && (
                          <p className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                            <span className="font-medium">Observações:</span> {appointment.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-4 md:mt-0">
                        <Button variant="outline" size="sm">
                          <Calendar className="h-4 w-4 mr-1" />
                          Detalhes
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Não há consultas agendadas para hoje</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Próximas Consultas</CardTitle>
              <CardDescription>Consultas agendadas para os próximos dias</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingAppointments && upcomingAppointments.length > 0 ? (
                <div className="space-y-4">
                  {upcomingAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-green-500 mr-2" />
                          <p className="font-medium">{appointment.patient?.full_name}</p>
                          <Badge variant="outline" className="ml-2">
                            {appointment.appointment_type === "primeira-consulta"
                              ? "Primeira Consulta"
                              : appointment.appointment_type === "retorno"
                                ? "Retorno"
                                : appointment.appointment_type === "urgencia"
                                  ? "Urgência"
                                  : "Check-up"}
                          </Badge>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            <span>
                              {new Date(appointment.appointment_date).toLocaleDateString("pt-BR")} às{" "}
                              {new Date(appointment.appointment_date).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            <span>
                              {appointment.doctor?.full_name || "Médico não especificado"} -{" "}
                              {appointment.specialty || "Especialidade não especificada"}
                            </span>
                          </div>
                        </div>
                        {appointment.notes && (
                          <p className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                            <span className="font-medium">Observações:</span> {appointment.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-4 md:mt-0">
                        <Button variant="outline" size="sm">
                          <Calendar className="h-4 w-4 mr-1" />
                          Detalhes
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Não há consultas agendadas para os próximos dias</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
