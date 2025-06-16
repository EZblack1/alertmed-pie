"use server"

import { createClient } from "@/utils/supabase/server"
import { sendAppointmentConfirmationEmail } from "@/lib/email"

interface CreateAppointmentData {
  specialty: string
  doctor?: string
  appointmentDate: string
  appointmentTime: string
  appointmentType: string
  notes?: string
}

export async function createAppointment(data: CreateAppointmentData) {
  const supabase = createClient()

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw new Error("Usuário não autenticado")
    }

    const userId = session.user.id
    const userEmail = session.user.email

    if (!userEmail) {
      throw new Error("Email do usuário não encontrado")
    }

    console.log("🔍 Iniciando criação de consulta para usuário:", userId)

    // Usar apenas dados da sessão, sem acessar profiles
    const userProfile = {
      id: userId,
      email: userEmail,
      full_name: session.user.user_metadata?.full_name || userEmail.split("@")[0],
      user_type: "patient",
    }

    console.log("✅ Usando dados da sessão:", userProfile.full_name)

    // Combinar data e hora
    const appointmentDateTime = new Date(`${data.appointmentDate}T${data.appointmentTime}:00`)
    console.log("📅 Data/hora da consulta:", appointmentDateTime.toISOString())

    // Preparar dados para inserção
    const appointmentData = {
      patient_id: userId,
      appointment_date: appointmentDateTime.toISOString(),
      duration: 60,
      status: "scheduled",
      notes: data.notes || null,
      location: "Clínica AlertMed",
      confirmation_sent: false,
      specialty: data.specialty,
      appointment_type: data.appointmentType,
    }

    console.log("📋 Dados da consulta a serem inseridos:", appointmentData)

    // Criar consulta no banco de dados
    const { data: appointment, error } = await supabase.from("appointments").insert(appointmentData).select().single()

    if (error) {
      console.error("❌ Erro ao inserir consulta:", error)
      throw error
    }

    console.log("✅ Consulta criada com sucesso:", appointment.id)

    // Preparar dados para o email
    const emailData = {
      patientName: userProfile.full_name,
      patientEmail: userProfile.email,
      appointmentDate: appointmentDateTime.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      appointmentTime: appointmentDateTime.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      specialty: data.specialty,
      doctor: data.doctor,
      appointmentType: data.appointmentType,
      notes: data.notes,
    }

    console.log("📧 Enviando email de confirmação...")

    // Enviar email de confirmação
    const emailSent = await sendAppointmentConfirmationEmail(emailData)

    // Atualizar status de confirmação no banco
    if (emailSent) {
      console.log("✅ Email enviado, atualizando status...")
      await supabase
        .from("appointments")
        .update({
          confirmation_sent: true,
          confirmation_sent_at: new Date().toISOString(),
        })
        .eq("id", appointment.id)
    }

    console.log("🎉 Processo concluído com sucesso!")

    return {
      success: true,
      appointment,
      emailSent,
    }
  } catch (error: any) {
    console.error("❌ Erro ao criar consulta:", error)
    return {
      success: false,
      error: error.message || "Erro ao agendar consulta",
    }
  }
}

export async function createExamRequest(data: {
  examType: string
  urgency?: string
  preferredDate?: string
  notes?: string
}) {
  console.log("🔬 [INÍCIO] createExamRequest - Nova abordagem independente")
  console.log("📋 [DATA] Dados recebidos:", data)

  const supabase = createClient()

  try {
    // Verificar autenticação
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      console.error("❌ [AUTH] Usuário não autenticado")
      throw new Error("Usuário não autenticado")
    }

    const userId = session.user.id
    const userEmail = session.user.email
    const userName = session.user.user_metadata?.full_name || userEmail?.split("@")[0] || "Usuário"

    console.log("✅ [AUTH] Usuário autenticado:", { userId, userEmail, userName })

    if (!userEmail) {
      console.error("❌ [AUTH] Email do usuário não encontrado")
      throw new Error("Email do usuário não encontrado")
    }

    // Preparar dados do exame para a tabela independente
    const examData = {
      patient_id: userId,
      patient_email: userEmail,
      patient_name: userName,
      exam_type: data.examType,
      result_available: false,
      status: "requested",
      urgency: data.urgency || "media",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Adicionar campos opcionais
    if (data.notes) {
      examData.notes = data.notes
    }

    if (data.preferredDate) {
      examData.preferred_date = data.preferredDate
    }

    console.log("📋 [EXAM] Dados do exame preparados:", examData)

    // Inserir na tabela independente de exames
    console.log("🔄 [INSERT] Inserindo na tabela independente 'exams'...")

    const { data: exam, error: examError } = await supabase.from("exams").insert(examData).select().single()

    if (examError) {
      console.error("❌ [ERROR] Erro ao inserir exame:", {
        message: examError.message,
        details: examError.details,
        hint: examError.hint,
        code: examError.code,
      })
      throw new Error(`Erro ao inserir exame: ${examError.message}`)
    }

    console.log("✅ [SUCCESS] Exame inserido com sucesso:", exam)

    // Criar notificação na tabela independente
    try {
      console.log("📢 [NOTIFICATION] Criando notificação independente...")

      const notificationData = {
        user_id: userId,
        user_email: userEmail,
        type: "exam_request",
        title: "Nova Solicitação de Exame",
        message: `Solicitação de ${data.examType} - Urgência: ${data.urgency || "média"}`,
        exam_id: exam.id,
        read: false,
        priority: "normal",
        created_at: new Date().toISOString(),
      }

      const { error: notificationError } = await supabase.from("exam_notifications").insert(notificationData)

      if (notificationError) {
        console.log("⚠️ [WARNING] Erro ao criar notificação (continuando):", notificationError)
      } else {
        console.log("✅ [SUCCESS] Notificação criada com sucesso")
      }
    } catch (notificationError) {
      console.log("⚠️ [WARNING] Exceção ao criar notificação (continuando):", notificationError)
    }

    console.log("🎉 [FINAL] Processo concluído com sucesso!")

    return {
      success: true,
      exam,
      message: "Solicitação de exame enviada com sucesso!",
    }
  } catch (error: any) {
    console.error("❌ [FATAL] Erro completo:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })

    return {
      success: false,
      error: error.message || "Erro ao solicitar exame",
    }
  }
}
