import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Buscar consulta específica
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const appointmentId = params.id

    // Verificar autenticação
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Verificar se é hospital
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "hospital") {
      return NextResponse.json({ error: "Acesso negado - apenas hospitais" }, { status: 403 })
    }

    // Buscar consulta
    const { data: appointment, error } = await supabase
      .from("appointments")
      .select(`
        *,
        patient:profiles!appointments_patient_id_fkey(
          id,
          full_name,
          email,
          phone,
          date_of_birth
        ),
        doctor:profiles!appointments_doctor_id_fkey(
          id,
          full_name,
          email,
          phone
        )
      `)
      .eq("id", appointmentId)
      .eq("hospital_id", session.user.id)
      .single()

    if (error || !appointment) {
      return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: appointment,
    })
  } catch (error: any) {
    console.error("Erro ao buscar consulta:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}

// PUT - Atualizar consulta
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const appointmentId = params.id
    const body = await request.json()

    // Verificar autenticação
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Verificar se é hospital
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "hospital") {
      return NextResponse.json({ error: "Acesso negado - apenas hospitais" }, { status: 403 })
    }

    // Verificar se a consulta existe e pertence ao hospital
    const { data: existingAppointment } = await supabase
      .from("appointments")
      .select("id, status, doctor_id")
      .eq("id", appointmentId)
      .eq("hospital_id", session.user.id)
      .single()

    if (!existingAppointment) {
      return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 })
    }

    // Preparar dados para atualização
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    // Campos permitidos para atualização
    const allowedFields = [
      "appointment_date",
      "duration",
      "status",
      "notes",
      "location",
      "specialty",
      "appointment_type",
      "doctor_id",
      "approval_status",
    ]

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    })

    // Se mudando médico, verificar se ele trabalha no hospital
    if (body.doctor_id && body.doctor_id !== existingAppointment.doctor_id) {
      const { data: doctorHospital } = await supabase
        .from("doctor_hospital")
        .select("id")
        .eq("doctor_id", body.doctor_id)
        .eq("hospital_id", session.user.id)
        .eq("status", "active")
        .single()

      if (!doctorHospital) {
        return NextResponse.json({ error: "Médico não está associado a este hospital" }, { status: 400 })
      }
    }

    // Se mudando data, verificar conflitos
    if (body.appointment_date) {
      const appointmentDateTime = new Date(body.appointment_date)
      const duration = body.duration || 60
      const endTime = new Date(appointmentDateTime.getTime() + duration * 60000)
      const doctorId = body.doctor_id || existingAppointment.doctor_id

      if (doctorId) {
        const { data: conflicts } = await supabase
          .from("appointments")
          .select("id")
          .eq("doctor_id", doctorId)
          .eq("status", "scheduled")
          .neq("id", appointmentId) // Excluir a própria consulta
          .gte("appointment_date", appointmentDateTime.toISOString())
          .lt("appointment_date", endTime.toISOString())

        if (conflicts && conflicts.length > 0) {
          return NextResponse.json(
            { error: "Conflito de horário - médico já possui consulta agendada neste período" },
            { status: 409 },
          )
        }
      }
    }

    // Atualizar consulta
    const { data: appointment, error } = await supabase
      .from("appointments")
      .update(updateData)
      .eq("id", appointmentId)
      .eq("hospital_id", session.user.id)
      .select(`
        *,
        patient:profiles!appointments_patient_id_fkey(
          id,
          full_name,
          email,
          phone
        ),
        doctor:profiles!appointments_doctor_id_fkey(
          id,
          full_name,
          email,
          phone
        )
      `)
      .single()

    if (error) {
      throw error
    }

    // Se status mudou para cancelado, notificar paciente e médico
    if (body.status === "cancelled" && existingAppointment.status !== "cancelled") {
      // Notificar paciente
      await supabase.from("notifications").insert({
        user_id: appointment.patient_id,
        type: "appointment_reminder",
        content: `Sua consulta de ${new Date(appointment.appointment_date).toLocaleDateString()} foi cancelada`,
        related_id: appointment.id,
        read: false,
      })

      // Notificar médico se houver
      if (appointment.doctor_id) {
        await supabase.from("notifications").insert({
          user_id: appointment.doctor_id,
          type: "appointment_reminder",
          content: `A consulta com ${appointment.patient.full_name} de ${new Date(
            appointment.appointment_date,
          ).toLocaleDateString()} foi cancelada`,
          related_id: appointment.id,
          read: false,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: "Consulta atualizada com sucesso",
      data: appointment,
    })
  } catch (error: any) {
    console.error("Erro ao atualizar consulta:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}

// DELETE - Cancelar consulta
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const appointmentId = params.id

    // Verificar autenticação
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Verificar se é hospital
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "hospital") {
      return NextResponse.json({ error: "Acesso negado - apenas hospitais" }, { status: 403 })
    }

    // Buscar informações da consulta antes de cancelar
    const { data: appointmentInfo } = await supabase
      .from("appointments")
      .select("patient_id, doctor_id, appointment_date")
      .eq("id", appointmentId)
      .eq("hospital_id", session.user.id)
      .single()

    if (!appointmentInfo) {
      return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 })
    }

    // Cancelar consulta (não deletar, apenas marcar como cancelada)
    const { data: appointment, error } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId)
      .eq("hospital_id", session.user.id)
      .select()
      .single()

    if (error || !appointment) {
      return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 })
    }

    // Notificar paciente
    await supabase.from("notifications").insert({
      user_id: appointmentInfo.patient_id,
      type: "appointment_reminder",
      content: `Sua consulta de ${new Date(appointmentInfo.appointment_date).toLocaleDateString()} foi cancelada`,
      related_id: appointmentId,
      read: false,
    })

    // Notificar médico se houver
    if (appointmentInfo.doctor_id) {
      await supabase.from("notifications").insert({
        user_id: appointmentInfo.doctor_id,
        type: "appointment_reminder",
        content: `A consulta de ${new Date(appointmentInfo.appointment_date).toLocaleDateString()} foi cancelada`,
        related_id: appointmentId,
        read: false,
      })
    }

    return NextResponse.json({
      success: true,
      message: "Consulta cancelada com sucesso",
      data: appointment,
    })
  } catch (error: any) {
    console.error("Erro ao cancelar consulta:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
