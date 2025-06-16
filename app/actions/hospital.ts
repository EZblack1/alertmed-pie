"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function approveAppointment(id: string, notes?: string) {
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
        approval_status: "approved",
        status: "scheduled",
        approval_notes: notes,
        approved_by: session.user.id,
        approved_at: new Date().toISOString(),
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
      .select("patient_id, appointment_date, specialty, doctor_id")
      .eq("id", id)
      .single()

    if (appointment) {
      // Notificar paciente
      await supabase.from("notifications").insert({
        user_id: appointment.patient_id,
        type: "appointment_approved",
        content: `Sua consulta de ${appointment.specialty || "consulta"} para ${new Date(appointment.appointment_date).toLocaleDateString("pt-BR")} foi aprovada!`,
        related_id: id,
        read: false,
      })

      // Notificar médico se houver
      if (appointment.doctor_id) {
        await supabase.from("notifications").insert({
          user_id: appointment.doctor_id,
          type: "appointment_approved",
          content: `Consulta de ${appointment.specialty || "consulta"} aprovada para ${new Date(appointment.appointment_date).toLocaleDateString("pt-BR")}`,
          related_id: id,
          read: false,
        })
      }
    }

    revalidatePath("/dashboard/hospital/appointments")
    revalidatePath("/dashboard/hospital")

    return { success: true, message: "Consulta aprovada com sucesso" }
  } catch (error: any) {
    console.error("Erro ao aprovar consulta:", error)
    return { success: false, error: error.message }
  }
}

export async function rejectAppointment(id: string, reason?: string) {
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
        approval_status: "rejected",
        status: "cancelled",
        rejection_reason: reason,
        approved_by: session.user.id,
        approved_at: new Date().toISOString(),
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
        type: "appointment_rejected",
        content: `Sua solicitação de consulta de ${appointment.specialty || "consulta"} para ${new Date(appointment.appointment_date).toLocaleDateString("pt-BR")} foi rejeitada.${reason ? ` Motivo: ${reason}` : ""}`,
        related_id: id,
        read: false,
      })
    }

    revalidatePath("/dashboard/hospital/appointments")
    revalidatePath("/dashboard/hospital")

    return { success: true, message: "Consulta rejeitada" }
  } catch (error: any) {
    console.error("Erro ao rejeitar consulta:", error)
    return { success: false, error: error.message }
  }
}

export async function approveExam(id: string, notes?: string) {
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
        approval_status: "approved",
        status: "scheduled",
        approval_notes: notes,
        approved_by: session.user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      console.error("Erro ao aprovar exame:", error)
      return { success: false, error: error.message }
    }

    // Buscar dados do exame para notificação
    const { data: exam } = await supabase.from("exams").select("patient_id, exam_type, doctor_id").eq("id", id).single()

    if (exam) {
      // Notificar paciente
      await supabase.from("notifications").insert({
        user_id: exam.patient_id,
        type: "exam_approved",
        content: `Sua solicitação de exame ${exam.exam_type} foi aprovada!`,
        related_id: id,
        read: false,
      })

      // Notificar médico se houver
      if (exam.doctor_id) {
        await supabase.from("notifications").insert({
          user_id: exam.doctor_id,
          type: "exam_approved",
          content: `Exame ${exam.exam_type} aprovado`,
          related_id: id,
          read: false,
        })
      }
    }

    revalidatePath("/dashboard/hospital/exams")
    revalidatePath("/dashboard/hospital")

    return { success: true, message: "Exame aprovado com sucesso" }
  } catch (error: any) {
    console.error("Erro ao aprovar exame:", error)
    return { success: false, error: error.message }
  }
}

export async function rejectExam(id: string, reason?: string) {
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
        approval_status: "rejected",
        status: "cancelled",
        rejection_reason: reason,
        approved_by: session.user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      console.error("Erro ao rejeitar exame:", error)
      return { success: false, error: error.message }
    }

    // Buscar dados do exame para notificação
    const { data: exam } = await supabase.from("exams").select("patient_id, exam_type").eq("id", id).single()

    if (exam) {
      await supabase.from("notifications").insert({
        user_id: exam.patient_id,
        type: "exam_rejected",
        content: `Sua solicitação de exame ${exam.exam_type} foi rejeitada.${reason ? ` Motivo: ${reason}` : ""}`,
        related_id: id,
        read: false,
      })
    }

    revalidatePath("/dashboard/hospital/exams")
    revalidatePath("/dashboard/hospital")

    return { success: true, message: "Exame rejeitado" }
  } catch (error: any) {
    console.error("Erro ao rejeitar exame:", error)
    return { success: false, error: error.message }
  }
}
