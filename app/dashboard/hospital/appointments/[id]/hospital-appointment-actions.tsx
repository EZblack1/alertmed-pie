"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, Calendar, AlertTriangle, Phone, Mail } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface HospitalAppointmentActionsProps {
  appointment: any
}

export default function HospitalAppointmentActions({ appointment }: HospitalAppointmentActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleAction = async (action: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/hospital/appointments/${appointment.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      })

      if (!response.ok) {
        throw new Error("Erro ao atualizar consulta")
      }

      const result = await response.json()

      toast({
        title: "Sucesso",
        description: result.message || "Consulta atualizada com sucesso",
      })

      router.refresh()
    } catch (error) {
      console.error("Erro:", error)
      toast({
        title: "Erro",
        description: "Erro ao atualizar consulta. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const canApprove = appointment.status === "pending"
  const canReject = appointment.status === "pending"
  const canReschedule = ["pending", "confirmed"].includes(appointment.status)
  const canCancel = ["pending", "confirmed"].includes(appointment.status)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ações da Consulta</CardTitle>
        <CardDescription>Gerencie o status e as ações desta consulta</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canApprove && (
          <Button onClick={() => handleAction("approve")} disabled={isLoading} className="w-full" variant="default">
            <CheckCircle className="w-4 h-4 mr-2" />
            Aprovar Consulta
          </Button>
        )}

        {canReject && (
          <Button onClick={() => handleAction("reject")} disabled={isLoading} className="w-full" variant="destructive">
            <XCircle className="w-4 h-4 mr-2" />
            Rejeitar Consulta
          </Button>
        )}

        {canReschedule && (
          <Button onClick={() => handleAction("reschedule")} disabled={isLoading} className="w-full" variant="outline">
            <Calendar className="w-4 h-4 mr-2" />
            Reagendar
          </Button>
        )}

        {canCancel && (
          <Button onClick={() => handleAction("cancel")} disabled={isLoading} className="w-full" variant="outline">
            <XCircle className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        )}

        <div className="pt-3 border-t space-y-2">
          <Button
            onClick={() => window.open(`tel:${appointment.profiles.phone}`)}
            className="w-full"
            variant="outline"
            size="sm"
          >
            <Phone className="w-4 h-4 mr-2" />
            Ligar para Paciente
          </Button>

          <Button
            onClick={() => window.open(`mailto:${appointment.profiles.email}`)}
            className="w-full"
            variant="outline"
            size="sm"
          >
            <Mail className="w-4 h-4 mr-2" />
            Enviar Email
          </Button>
        </div>

        {appointment.status === "pending" && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">Esta consulta aguarda aprovação</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
