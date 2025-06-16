import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, CheckCircle, XCircle, FileText } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { revalidatePath } from "next/cache"

export default async function DoctorAppointments() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  // Verificar se o usuário é médico
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

  if (!profile || profile.user_type !== "doctor") {
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
      patient:profiles!appointments_patient_id_fkey(id, full_name, email, phone, date_of_birth)
    `)
    .eq("doctor_id", session.user.id)
    .eq("status", "scheduled")
    .gte("appointment_date", today.toISOString())
    .lt("appointment_date", tomorrow.toISOString())
    .order("appointment_date")

  // Buscar próximas consultas
  const { data: upcomingAppointments } = await supabase
    .from("appointments")
    .select(`
      *,
      patient:profiles!appointments_patient_id_fkey(id, full_name, email, phone, date_of_birth)
    `)
    .eq("doctor_id", session.user.id)
    .eq("status", "scheduled")
    .gt("appointment_date", tomorrow.toISOString())
    .order("appointment_date")
    .limit(10)

  // Buscar histórico de consultas
  const { data: pastAppointments } = await supabase
    .from("appointments")
    .select(`
      *,
      patient:profiles!appointments_patient_id_fkey(id, full_name, email, phone, date_of_birth)
    `)
    .eq("doctor_id", session.user.id)
    .eq("status", "completed")
    .order("appointment_date", { ascending: false })
    .limit(10)

  // Função para marcar consulta como concluída
  async function completeAppointment(id: string) {
    "use server"

    const supabase = createClient()

    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (error) {
        console.error("Erro ao concluir consulta:", error)
        return { success: false, error: error.message }
      }

      // Buscar dados da consulta para notificação
      const { data: appointment } = await supabase
        .from("appointments")
        .select("patient_id, specialty")
        .eq("id", id)
        .single()

      if (appointment) {
        await supabase.from("notifications").insert({
          user_id: appointment.patient_id,
          type: "appointment_reminder",
          content: `Sua consulta de ${appointment.specialty || "consulta"} foi concluída com sucesso.`,
          related_id: id,
          read: false,
        })
      }

      revalidatePath("/dashboard/doctor/appointments")
      return { success: true, message: "Consulta concluída com sucesso" }
    } catch (error: any) {
      console.error("Erro ao concluir consulta:", error)
      return { success: false, error: error.message }
    }
  }

  // Função para cancelar consulta
  async function cancelAppointment(id: string) {
    "use server"

    const supabase = createClient()

    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (error) {
        console.error("Erro ao cancelar consulta:", error)
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
          content: `Sua consulta de ${appointment.specialty || "consulta"} para ${new Date(appointment.appointment_date).toLocaleDateString("pt-BR")} foi cancelada pelo médico.`,
          related_id: id,
          read: false,
        })
      }

      revalidatePath("/dashboard/doctor/appointments")
      return { success: true, message: "Consulta cancelada" }
    } catch (error: any) {
      console.error("Erro ao cancelar consulta:", error)
      return { success: false, error: error.message }
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Minha Agenda</h1>
          <p className="text-gray-600">Dr(a). {profile.full_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/doctor">
              <Calendar className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard/doctor/appointments/new">
              <Calendar className="h-4 w-4 mr-2" />
              Nova Consulta
            </Link>
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <CardTitle className="text-sm font-medium">Realizadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pastAppointments?.length || 0}</div>
            <p className="text-xs text-muted-foreground">consultas concluídas</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="today" className="space-y-4">
        <TabsList>
          <TabsTrigger value="today">
            Hoje
            {todayAppointments && todayAppointments.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {todayAppointments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming">Próximas</TabsTrigger>
          <TabsTrigger value="past">Histórico</TabsTrigger>
        </TabsList>

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
                          <span className="font-medium">
                            {new Date(appointment.appointment_date).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
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
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                          <p className="font-medium">{appointment.patient?.full_name}</p>
                          <p className="text-sm text-gray-500">{appointment.specialty || "Consulta Geral"}</p>
                        </div>
                        {appointment.notes && (
                          <p className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                            <span className="font-medium">Observações:</span> {appointment.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-4 md:mt-0">
                        <form action={completeAppointment.bind(null, appointment.id)}>
                          <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Concluir
                          </Button>
                        </form>
                        <form action={cancelAppointment.bind(null, appointment.id)}>
                          <Button type="submit" variant="destructive" size="sm">
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancelar
                          </Button>
                        </form>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/doctor/patients/${appointment.patient?.id}`}>
                            <FileText className="h-4 w-4 mr-1" />
                            Prontuário
                          </Link>
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
                          <span className="font-medium">
                            {new Date(appointment.appointment_date).toLocaleDateString("pt-BR")} às{" "}
                            {new Date(appointment.appointment_date).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
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
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                          <p className="font-medium">{appointment.patient?.full_name}</p>
                          <p className="text-sm text-gray-500">{appointment.specialty || "Consulta Geral"}</p>
                        </div>
                        {appointment.notes && (
                          <p className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                            <span className="font-medium">Observações:</span> {appointment.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-4 md:mt-0">
                        <form action={cancelAppointment.bind(null, appointment.id)}>
                          <Button type="submit" variant="destructive" size="sm">
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancelar
                          </Button>
                        </form>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/doctor/patients/${appointment.patient?.id}`}>
                            <FileText className="h-4 w-4 mr-1" />
                            Prontuário
                          </Link>
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

        <TabsContent value="past" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Consultas</CardTitle>
              <CardDescription>Consultas realizadas anteriormente</CardDescription>
            </CardHeader>
            <CardContent>
              {pastAppointments && pastAppointments.length > 0 ? (
                <div className="space-y-4">
                  {pastAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          <span className="font-medium">
                            {new Date(appointment.appointment_date).toLocaleDateString("pt-BR")} às{" "}
                            {new Date(appointment.appointment_date).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
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
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                          <p className="font-medium">{appointment.patient?.full_name}</p>
                          <p className="text-sm text-gray-500">{appointment.specialty || "Consulta Geral"}</p>
                        </div>
                        <p className="text-xs text-gray-400">
                          Concluída{" "}
                          {formatDistanceToNow(new Date(appointment.updated_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 mt-4 md:mt-0">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/doctor/patients/${appointment.patient?.id}`}>
                            <FileText className="h-4 w-4 mr-1" />
                            Prontuário
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Não há histórico de consultas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
