"use server"

import { createClient } from "@/utils/supabase/server"
import { sendAppointmentConfirmationEmail, logEmailSent } from "@/lib/email"

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

    // Buscar dados do usuário
    const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", userId).single()

    // Se o perfil não existe, tentar criar um básico
    let userProfile = profile
    if (!profile) {
      console.log("📝 Perfil não encontrado, tentando criar perfil básico...")

      // Usar upsert para evitar conflitos de RLS
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            email: userEmail,
            full_name: session.user.user_metadata?.full_name || userEmail.split("@")[0],
            user_type: "patient",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "id",
          },
        )
        .select()
        .single()

      if (createError) {
        console.error("⚠️ Erro ao criar perfil:", createError)
        // Se não conseguir criar o perfil, usar dados da sessão como fallback
        userProfile = {
          id: userId,
          email: userEmail,
          full_name: session.user.user_metadata?.full_name || userEmail.split("@")[0],
          user_type: "patient",
        }
        console.log("📋 Usando dados da sessão como fallback")
      } else {
        console.log("✅ Perfil criado com sucesso")
        userProfile = newProfile
      }
    } else {
      console.log("✅ Perfil encontrado:", profile.full_name)
    }

    // Combinar data e hora
    const appointmentDateTime = new Date(`${data.appointmentDate}T${data.appointmentTime}:00`)
    console.log("📅 Data/hora da consulta:", appointmentDateTime.toISOString())

    // Preparar dados para inserção
    const appointmentData = {
      patient_id: userId,
      appointment_date: appointmentDateTime.toISOString(),
      duration: 60, // 60 minutos por padrão
      status: "scheduled",
      notes: data.notes || null,
      location: "Clínica AlertMed", // Local padrão
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
      patientName: userProfile?.full_name || userEmail.split("@")[0] || "Paciente",
      patientEmail: userProfile?.email || userEmail,
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

    // Log do email
    await logEmailSent(
      userId,
      "appointment_confirmation",
      emailData.patientEmail,
      "Confirmação de Agendamento - AlertMed",
      `Consulta agendada para ${emailData.appointmentDate} às ${emailData.appointmentTime}`,
      emailSent,
      appointment.id,
      emailSent ? undefined : "Erro ao enviar email",
    )

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

    console.log("🔬 Iniciando solicitação de exame para usuário:", userId)

    // Verificar se o perfil existe, se não, tentar criar um básico
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single()

    if (!profile) {
      console.log("📝 Perfil não encontrado para exame, tentando criar perfil básico...")

      // Usar upsert para evitar conflitos de RLS
      await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            email: userEmail,
            full_name: session.user.user_metadata?.full_name || userEmail.split("@")[0],
            user_type: "patient",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "id",
          },
        )
        .select()
        .single()
    }

    // Preparar dados do exame
    const examData = {
      patient_id: userId,
      exam_type: data.examType,
      result_available: false,
      notes: data.notes || null,
      status: "requested",
      urgency: data.urgency || "media",
      preferred_date: data.preferredDate || null,
    }

    console.log("📋 Dados do exame a serem inseridos:", examData)

    // Criar solicitação de exame no banco de dados
    const { data: exam, error } = await supabase.from("exams").insert(examData).select().single()

    if (error) {
      console.error("❌ Erro ao inserir exame:", error)
      throw error
    }

    console.log("✅ Exame solicitado com sucesso:", exam.id)

    return {
      success: true,
      exam,
    }
  } catch (error: any) {
    console.error("❌ Erro ao solicitar exame:", error)
    return {
      success: false,
      error: error.message || "Erro ao solicitar exame",
    }
  }
}
