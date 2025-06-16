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

    // Verificar se é médico
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "doctor") {
      return NextResponse.json({ error: "Acesso negado - apenas médicos" }, { status: 403 })
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
        )
      `)
      .eq("id", appointmentId)
      .eq("doctor_id", session.user.id)
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

    // Verificar se é médico
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "doctor") {
      return NextResponse.json({ error: "Acesso negado - apenas médicos" }, { status: 403 })
    }

    // Verificar se a consulta existe e pertence ao médico
    const { data: existingAppointment } = await supabase
      .from("appointments")
      .select("id, status")
      .eq("id", appointmentId)
      .eq("doctor_id", session.user.id)
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
    ]

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    })

    // Se mudando data, verificar conflitos
    if (body.appointment_date) {
      const appointmentDateTime = new Date(body.appointment_date)
      const duration = body.duration || 60
      const endTime = new Date(appointmentDateTime.getTime() + duration * 60000)

      const { data: conflicts } = await supabase
        .from("appointments")
        .select("id")
        .eq("doctor_id", session.user.id)
        .eq("status", "scheduled")
        .neq("id", appointmentId) // Excluir a própria consulta
        .gte("appointment_date", appointmentDateTime.toISOString())
        .lt("appointment_date", endTime.toISOString())

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json(
          { error: "Conflito de horário - já existe consulta agendada neste período" },
          { status: 409 },
        )
      }
    }

    // Atualizar consulta
    const { data: appointment, error } = await supabase
      .from("appointments")
      .update(updateData)
      .eq("id", appointmentId)
      .eq("doctor_id", session.user.id)
      .select(`
        *,
        patient:profiles!appointments_patient_id_fkey(
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

    // Verificar se é médico
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "doctor") {
      return NextResponse.json({ error: "Acesso negado - apenas médicos" }, { status: 403 })
    }

    // Cancelar consulta (não deletar, apenas marcar como cancelada)
    const { data: appointment, error } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId)
      .eq("doctor_id", session.user.id)
      .select()
      .single()

    if (error || !appointment) {
      return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 })
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
