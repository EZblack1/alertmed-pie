"use client"

import type React from "react"

import { useState } from "react"
import { Calendar, Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createAppointment } from "@/app/actions/appointments"

interface AppointmentModalProps {
  children: React.ReactNode
  onSuccess?: () => void
}

export function AppointmentModal({ children, onSuccess }: AppointmentModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Form state
  const [specialty, setSpecialty] = useState("")
  const [doctor, setDoctor] = useState("")
  const [appointmentDate, setAppointmentDate] = useState("")
  const [appointmentTime, setAppointmentTime] = useState("")
  const [appointmentType, setAppointmentType] = useState("primeira-consulta") // Valor padrão
  const [notes, setNotes] = useState("")

  const specialties = [
    "Clínica Geral",
    "Cardiologia",
    "Dermatologia",
    "Endocrinologia",
    "Gastroenterologia",
    "Ginecologia",
    "Neurologia",
    "Oftalmologia",
    "Ortopedia",
    "Otorrinolaringologia",
    "Pediatria",
    "Psiquiatria",
    "Urologia",
  ]

  const doctors = [
    "Dr. João Silva - Cardiologia",
    "Dra. Maria Santos - Clínica Geral",
    "Dr. Pedro Oliveira - Dermatologia",
    "Dra. Ana Costa - Ginecologia",
    "Dr. Carlos Ferreira - Ortopedia",
  ]

  const timeSlots = [
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validar campos obrigatórios
      if (!specialty || !appointmentDate || !appointmentTime) {
        throw new Error("Por favor, preencha todos os campos obrigatórios")
      }

      const formData = {
        specialty,
        doctor: doctor || undefined,
        appointmentDate,
        appointmentTime,
        appointmentType: appointmentType || "primeira-consulta",
        notes: notes || undefined,
      }

      console.log("📋 Enviando dados da consulta:", formData)

      const result = await createAppointment(formData)

      console.log("📊 Resultado do agendamento:", result)

      if (result.success) {
        toast({
          title: "Consulta agendada com sucesso! 🎉",
          description: result.emailSent
            ? "Você receberá um email de confirmação em breve."
            : "Consulta agendada, mas houve um problema ao enviar o email de confirmação.",
        })

        // Reset form
        setSpecialty("")
        setDoctor("")
        setAppointmentDate("")
        setAppointmentTime("")
        setAppointmentType("primeira-consulta")
        setNotes("")
        setOpen(false)

        // Callback para atualizar a página
        if (onSuccess) {
          setTimeout(() => {
            onSuccess()
          }, 500) // Pequeno delay para garantir que o banco foi atualizado
        }
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      console.error("❌ Erro no modal:", error)
      toast({
        title: "Erro ao agendar consulta",
        description: error.message || "Ocorreu um erro ao agendar sua consulta. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Agendar Consulta
          </DialogTitle>
          <DialogDescription>Preencha as informações abaixo para agendar uma nova consulta.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="specialty">Especialidade *</Label>
            <Select value={specialty} onValueChange={setSpecialty} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a especialidade" />
              </SelectTrigger>
              <SelectContent>
                {specialties.map((spec) => (
                  <SelectItem key={spec} value={spec}>
                    {spec}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doctor">Médico (Opcional)</Label>
            <Select value={doctor} onValueChange={setDoctor}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um médico específico" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doc) => (
                  <SelectItem key={doc} value={doc}>
                    {doc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointment-type">Tipo de Consulta *</Label>
            <Select value={appointmentType} onValueChange={setAppointmentType} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de consulta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primeira-consulta">Primeira Consulta</SelectItem>
                <SelectItem value="retorno">Retorno</SelectItem>
                <SelectItem value="urgencia">Urgência</SelectItem>
                <SelectItem value="check-up">Check-up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appointment-date">Data *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="appointment-date"
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="pl-10"
                  min={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appointment-time">Horário *</Label>
              <Select value={appointmentTime} onValueChange={setAppointmentTime} required>
                <SelectTrigger>
                  <SelectValue placeholder="Horário" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Motivo da Consulta / Observações</Label>
            <Textarea
              id="notes"
              placeholder="Descreva brevemente o motivo da consulta ou adicione observações importantes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !specialty || !appointmentDate || !appointmentTime}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Agendando...
                </>
              ) : (
                "Agendar Consulta"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
