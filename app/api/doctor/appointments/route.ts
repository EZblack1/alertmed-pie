import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Listar consultas do médico
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

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

    // Parâmetros de filtro
    const status = searchParams.get("status")
    const date = searchParams.get("date")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Construir query
    let query = supabase
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
      .eq("doctor_id", session.user.id)
      .order("appointment_date", { ascending: true })
      .range(offset, offset + limit - 1)

    // Aplicar filtros
    if (status) {
      query = query.eq("status", status)
    }
    if (date) {
      const startDate = new Date(date)
      const endDate = new Date(date)
      endDate.setDate(endDate.getDate() + 1)
      query = query.gte("appointment_date", startDate.toISOString()).lt("appointment_date", endDate.toISOString())
    }

    const { data: appointments, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: appointments,
      pagination: {
        limit,
        offset,
        total: appointments?.length || 0,
      },
    })
  } catch (error: any) {
    console.error("Erro ao buscar consultas:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}

// POST - Agendar consulta como médico
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
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

    // Validar dados obrigatórios
    const { patient_id, appointment_date, duration = 60, specialty, appointment_type, notes, location } = body

    if (!patient_id || !appointment_date) {
      return NextResponse.json({ error: "patient_id e appointment_date são obrigatórios" }, { status: 400 })
    }

    // Verificar se o paciente existe
    const { data: patient } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", patient_id)
      .eq("user_type", "patient")
      .single()

    if (!patient) {
      return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 })
    }

    // Verificar conflito de horário
    const appointmentDateTime = new Date(appointment_date)
    const endTime = new Date(appointmentDateTime.getTime() + duration * 60000)

    const { data: conflicts } = await supabase
      .from("appointments")
      .select("id")
      .eq("doctor_id", session.user.id)
      .eq("status", "scheduled")
      .gte("appointment_date", appointmentDateTime.toISOString())
      .lt("appointment_date", endTime.toISOString())

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        { error: "Conflito de horário - já existe consulta agendada neste período" },
        { status: 409 },
      )
    }

    // Criar consulta
    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        patient_id,
        doctor_id: session.user.id,
        appointment_date: appointmentDateTime.toISOString(),
        duration,
        status: "scheduled",
        specialty,
        appointment_type: appointment_type || "primeira-consulta",
        notes,
        location: location || "Consultório Médico",
        confirmation_sent: false,
      })
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

    return NextResponse.json(
      {
        success: true,
        message: "Consulta agendada com sucesso",
        data: appointment,
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error("Erro ao agendar consulta:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
