"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function completeAppointment(id: string, diagnosis?: string, prescription?: string, notes?: string) {
  const supabase = createClient()

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: "Usuário não autenticado" }
    }

    const { error } = await supabase
      .from("appointments")
      .update({
        status: "completed",
        diagnosis,
        prescription,
        medical_notes: notes,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("doctor_id", session.user.id)

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
        type: "appointment_completed",
        content: `Sua consulta de ${appointment.specialty || "consulta"} foi concluída. ${diagnosis ? "Diagnóstico e prescrição disponíveis." : ""}`,
        related_id: id,
        read: false,
      })
    }

    revalidatePath("/dashboard/doctor/appointments")
    revalidatePath("/dashboard/doctor")

    return { success: true, message: "Consulta concluída com sucesso" }
  } catch (error: any) {
    console.error("Erro ao concluir consulta:", error)
    return { success: false, error: error.message }
  }
}

export async function addExamResult(id: string, result: string, attachments?: string[]) {
  const supabase = createClient()

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: "Usuário não autenticado" }
    }

    const { error } = await supabase
      .from("exams")
      .update({
        result,
        result_available: true,
        status: "completed",
        result_attachments: attachments,
        result_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("doctor_id", session.user.id)

    if (error) {
      console.error("Erro ao adicionar resultado:", error)
      return { success: false, error: error.message }
    }

    // Buscar dados do exame para notificação
    const { data: exam } = await supabase.from("exams").select("patient_id, exam_type").eq("id", id).single()

    if (exam) {
      await supabase.from("notifications").insert({
        user_id: exam.patient_id,
        type: "exam_result_available",
        content: `O resultado do seu exame ${exam.exam_type} está disponível!`,
        related_id: id,
        read: false,
      })
    }

    revalidatePath("/dashboard/doctor/exams")
    revalidatePath("/dashboard/doctor")

    return { success: true, message: "Resultado adicionado com sucesso" }
  } catch (error: any) {
    console.error("Erro ao adicionar resultado:", error)
    return { success: false, error: error.message }
  }
}

export async function updateAppointmentNotes(id: string, notes: string) {
  const supabase = createClient()

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: "Usuário não autenticado" }
    }

    const { error } = await supabase
      .from("appointments")
      .update({
        medical_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("doctor_id", session.user.id)

    if (error) {
      console.error("Erro ao atualizar notas:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/dashboard/doctor/appointments")

    return { success: true, message: "Notas atualizadas com sucesso" }
  } catch (error: any) {
    console.error("Erro ao atualizar notas:", error)
    return { success: false, error: error.message }
  }
}

export async function rescheduleAppointment(id: string, newDate: string, newTime: string, reason?: string) {
  const supabase = createClient()

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: "Usuário não autenticado" }
    }

    const newDateTime = new Date(`${newDate}T${newTime}:00`)

    const { error } = await supabase
      .from("appointments")
      .update({
        appointment_date: newDateTime.toISOString(),
        status: "rescheduled",
        reschedule_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("doctor_id", session.user.id)

    if (error) {
      console.error("Erro ao reagendar consulta:", error)
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
        type: "appointment_rescheduled",
        content: `Sua consulta de ${appointment.specialty || "consulta"} foi reagendada para ${newDateTime.toLocaleDateString("pt-BR")} às ${newDateTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.${reason ? ` Motivo: ${reason}` : ""}`,
        related_id: id,
        read: false,
      })
    }

    revalidatePath("/dashboard/doctor/appointments")
    revalidatePath("/dashboard/doctor")

    return { success: true, message: "Consulta reagendada com sucesso" }
  } catch (error: any) {
    console.error("Erro ao reagendar consulta:", error)
    return { success: false, error: error.message }
  }
}
