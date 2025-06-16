import { notFound } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import PatientInfo from "../../../doctor/appointments/[id]/patient-info"
import AppointmentHistory from "../../../doctor/appointments/[id]/appointment-history"

export default async function HospitalAppointmentDetailsPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies })

  // Verificar autenticação
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    return notFound()
  }

  // Verificar se o usuário é do tipo hospital
  if (session.user.user_metadata?.role !== "hospital") {
    return notFound()
  }

  // Buscar detalhes da consulta
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(`
      *,
      profiles:profile_id(id, full_name, email, phone, birth_date, gender, blood_type, allergies, chronic_conditions),
      doctors:doctor_id(id, name, specialty, crm)
    `)
    .eq("id", params.id)
    .single()

  if (error || !appointment) {
    console.error("Erro ao buscar consulta:", error)
    return notFound()
  }

  // Buscar histórico de alterações
  const { data: history } = await supabase
    .from("appointment_history")
    .select("*")
    .eq("appointment_id", params.id)
    .order("created_at", { ascending: false })

  // Formatar data e hora
  const appointmentDate = new Date(appointment.appointment_date)
  const formattedDate = format(appointmentDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  const formattedTime = format(appointmentDate, "HH:mm", { locale: ptBR })

  // Mapear status para cores de badge
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    confirmed: "bg-green-100 text-green-800 hover:bg-green-100",
    completed: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    cancelled: "bg-red-100 text-red-800 hover:bg-red-100",
    rescheduled: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  }

  // Mapear status para texto em português
  const statusText: Record<string, string> = {
    pending: "Pendente",
    confirmed: "Confirmada",
    completed: "Concluída",
    cancelled: "Cancelada",
    rescheduled: "Reagendada",
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Detalhes da Consulta</h1>
          <p className="text-muted-foreground">
            Consulta de {appointment.profiles?.full_name || "Paciente"} em {formattedDate}
          </p>
        </div>
        <Badge className={statusColors[appointment.status] || "bg-gray-100 text-gray-800"}>
          {statusText[appointment.status] || appointment.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Tabs defaultValue="details">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="patient">Paciente</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informações da Consulta</CardTitle>
                  <CardDescription>Detalhes completos sobre esta consulta</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Data</p>
                      <p>{formattedDate}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Horário</p>
                      <p>{formattedTime}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Especialidade</p>
                      <p>{appointment.doctors?.specialty || appointment.specialty || "Não especificada"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Médico</p>
                      <p>{appointment.doctors?.name || "Não atribuído"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Tipo</p>
                      <p>{appointment.appointment_type || "Consulta regular"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Motivo</p>
                      <p>{appointment.reason || "Não especificado"}</p>
                    </div>
                  </div>

                  {appointment.symptoms && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Sintomas Relatados</p>
                        <p>{appointment.symptoms}</p>
                      </div>
                    </>
                  )}

                  {appointment.notes && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Observações</p>
                        <p>{appointment.notes}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="patient">
              {appointment.profiles ? (
                <PatientInfo patient={appointment.profiles} />
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <p className="text-muted-foreground">Informações do paciente não disponíveis</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history">
              <AppointmentHistory history={history || []} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Ações disponíveis para esta consulta serão implementadas em breve.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
