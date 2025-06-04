"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import Link from "next/link"
import { Calendar, Clock, MapPin, User, AlertTriangle, Plus, RefreshCw } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AppointmentModal } from "@/components/modals/appointment-modal"
import { useToast } from "@/hooks/use-toast"

export default function AppointmentsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<any[]>([])
  const [tableExists, setTableExists] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const supabase = createClient()

  const fetchAppointments = async () => {
    try {
      setLoading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/")
        return
      }

      const userId = session.user.id

      // Tentar buscar consultas
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("patient_id", userId)
        .order("appointment_date", { ascending: true })

      if (error) {
        if (error.message.includes("does not exist")) {
          setTableExists(false)
          setErrorMessage("A tabela 'appointments' não existe no banco de dados.")
        } else {
          throw error
        }
      } else {
        setAppointments(data || [])
        setTableExists(true)
      }
    } catch (error: any) {
      console.error("Erro ao buscar consultas:", error)
      if (error.message.includes("does not exist")) {
        setTableExists(false)
        setErrorMessage("A tabela 'appointments' não existe no banco de dados.")
      } else {
        toast({
          title: "Erro ao carregar consultas",
          description: error.message,
          variant: "destructive",
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments()
  }, [])

  const handleAppointmentSuccess = () => {
    // Recarregar a lista de consultas após agendar uma nova
    fetchAppointments()
    toast({
      title: "Lista atualizada",
      description: "Sua nova consulta aparece na lista abaixo.",
    })
  }

  if (!tableExists) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Minhas Consultas</h1>
          <p className="text-muted-foreground">Visualize e gerencie suas consultas médicas</p>
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro no banco de dados</AlertTitle>
          <AlertDescription>{errorMessage} Execute o script SQL para criar as tabelas necessárias.</AlertDescription>
        </Alert>
      </div>
    )
  }

  // Separar consultas por status
  const now = new Date()
  const upcomingAppointments = appointments.filter(
    (app) => new Date(app.appointment_date) > now && app.status === "scheduled",
  )
  const pastAppointments = appointments.filter(
    (app) => new Date(app.appointment_date) < now || app.status !== "scheduled",
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Minhas Consultas</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAppointments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <AppointmentModal onSuccess={handleAppointmentSuccess}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Agendar Consulta
            </Button>
          </AppointmentModal>
        </div>
      </div>

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming">
            Próximas
            {upcomingAppointments.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {upcomingAppointments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="past">Anteriores</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : upcomingAppointments.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {upcomingAppointments.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          ) : (
            <EmptyState onSuccess={handleAppointmentSuccess} />
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : pastAppointments.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {pastAppointments.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} isPast />
              ))}
            </div>
          ) : (
            <EmptyState message="Nenhuma consulta anterior encontrada" onSuccess={handleAppointmentSuccess} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AppointmentCard({ appointment, isPast = false }: { appointment: any; isPast?: boolean }) {
  const appointmentDate = new Date(appointment.appointment_date)
  const endTime = new Date(appointmentDate.getTime() + appointment.duration * 60000)

  const statusMap: Record<string, { label: string; variant: "default" | "outline" | "secondary" | "destructive" }> = {
    scheduled: { label: "Agendada", variant: "default" },
    completed: { label: "Concluída", variant: "secondary" },
    cancelled: { label: "Cancelada", variant: "destructive" },
    rescheduled: { label: "Reagendada", variant: "outline" },
  }

  const status = statusMap[appointment.status] || statusMap.scheduled

  return (
    <Card className={appointment.confirmation_sent ? "border-green-200 bg-green-50/50" : ""}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              {appointment.specialty || "Consulta Médica"}
              {appointment.confirmation_sent && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  ✓ Confirmada
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {appointmentDate.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </CardDescription>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {appointmentDate.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" - "}
              {endTime.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {appointment.appointment_type && (
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm capitalize">{appointment.appointment_type.replace("-", " ")}</span>
            </div>
          )}
        </div>

        {appointment.location && (
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{appointment.location}</span>
          </div>
        )}

        {appointment.notes && (
          <div>
            <p className="text-sm font-medium">Observações:</p>
            <p className="text-sm text-muted-foreground">{appointment.notes}</p>
          </div>
        )}

        {appointment.confirmation_sent && (
          <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
            📧 Email de confirmação enviado
            {appointment.confirmation_sent_at && (
              <span className="block">em {new Date(appointment.confirmation_sent_at).toLocaleString("pt-BR")}</span>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <div className="flex space-x-2 w-full">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={`/dashboard/consultas/${appointment.id}`}>Ver Detalhes</Link>
          </Button>

          {!isPast && appointment.status === "scheduled" && (
            <Button variant="destructive" size="sm" className="flex-1">
              Cancelar
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}

function EmptyState({
  message = "Nenhuma consulta agendada",
  onSuccess,
}: {
  message?: string
  onSuccess?: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <Calendar className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">{message}</p>
        <AppointmentModal onSuccess={onSuccess}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Agendar Consulta
          </Button>
        </AppointmentModal>
      </CardContent>
    </Card>
  )
}
