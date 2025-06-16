"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { AlertCircle, Calendar, CheckCircle, Clock, XCircle } from "lucide-react"

interface AppointmentActionsProps {
  appointmentId: string
  currentStatus: string
}

export default function AppointmentActions({ appointmentId, currentStatus }: AppointmentActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [showCancelForm, setShowCancelForm] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const updateStatus = async (status: string, reason?: string) => {
    setIsLoading(true)
    try {
      // Atualizar status da consulta
      const { error } = await supabase
        .from("appointments")
        .update({
          status,
          ...(reason ? { cancellation_reason: reason } : {}),
        })
        .eq("id", appointmentId)

      if (error) throw error

      // Registrar no histórico
      await supabase.from("appointment_history").insert({
        appointment_id: appointmentId,
        status,
        notes: reason || `Status alterado para ${status}`,
      })

      toast({
        title: "Status atualizado",
        description: `A consulta foi ${status === "cancelled" ? "cancelada" : "atualizada"} com sucesso.`,
      })

      router.refresh()
    } catch (error) {
      console.error("Erro ao atualizar status:", error)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status da consulta.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setShowCancelForm(false)
    }
  }

  const handleCancel = () => {
    if (!cancelReason.trim()) {
      toast({
        title: "Atenção",
        description: "Por favor, informe o motivo do cancelamento.",
        variant: "destructive",
      })
      return
    }
    updateStatus("cancelled", cancelReason)
  }

  return (
    <div className="space-y-4">
      {currentStatus === "pending" && (
        <Button className="w-full" onClick={() => updateStatus("confirmed")} disabled={isLoading}>
          <CheckCircle className="mr-2 h-4 w-4" />
          Confirmar Consulta
        </Button>
      )}

      {currentStatus === "confirmed" && (
        <Button className="w-full" onClick={() => updateStatus("completed")} disabled={isLoading}>
          <CheckCircle className="mr-2 h-4 w-4" />
          Marcar como Concluída
        </Button>
      )}

      {(currentStatus === "pending" || currentStatus === "confirmed") && (
        <>
          {!showCancelForm ? (
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => setShowCancelForm(true)}
              disabled={isLoading}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancelar Consulta
            </Button>
          ) : (
            <Card className="p-4 border-red-200">
              <Textarea
                placeholder="Motivo do cancelamento"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="mb-2"
              />
              <div className="flex justify-between">
                <Button variant="outline" size="sm" onClick={() => setShowCancelForm(false)} disabled={isLoading}>
                  Voltar
                </Button>
                <Button variant="destructive" size="sm" onClick={handleCancel} disabled={isLoading}>
                  Confirmar Cancelamento
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      {(currentStatus === "pending" || currentStatus === "confirmed") && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push(`/dashboard/doctor/appointments/${appointmentId}/reschedule`)}
          disabled={isLoading}
        >
          <Calendar className="mr-2 h-4 w-4" />
          Reagendar
        </Button>
      )}

      <Button
        variant="outline"
        className="w-full"
        onClick={() => router.push(`/dashboard/doctor/prescriptions/new?appointment=${appointmentId}`)}
        disabled={isLoading || currentStatus === "cancelled"}
      >
        <AlertCircle className="mr-2 h-4 w-4" />
        Nova Prescrição
      </Button>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => router.push(`/dashboard/doctor/exams/request?patient=${appointmentId}`)}
        disabled={isLoading || currentStatus === "cancelled"}
      >
        <Clock className="mr-2 h-4 w-4" />
        Solicitar Exame
      </Button>
    </div>
  )
}
