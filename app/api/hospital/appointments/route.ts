import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Listar consultas do hospital
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

    // Verificar se é hospital
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "hospital") {
      return NextResponse.json({ error: "Acesso negado - apenas hospitais" }, { status: 403 })
    }

    // Parâmetros de filtro
    const status = searchParams.get("status")
    const doctor_id = searchParams.get("doctor_id")
    const patient_id = searchParams.get("patient_id")
    const specialty = searchParams.get("specialty")
    const date_from = searchParams.get("date_from")
    const date_to = searchParams.get("date_to")
    const approval_status = searchParams.get("approval_status")
    const limit = Number.parseInt(searchParams.get("limit") || "100")
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
        ),
        doctor:profiles!appointments_doctor_id_fkey(
          id,
          full_name,
          email,
          phone
        )
      `)
      .eq("hospital_id", session.user.id)
      .order("appointment_date", { ascending: true })
      .range(offset, offset + limit - 1)

    // Aplicar filtros
    if (status) {
      query = query.eq("status", status)
    }
    if (doctor_id) {
      query = query.eq("doctor_id", doctor_id)
    }
    if (patient_id) {
      query = query.eq("patient_id", patient_id)
    }
    if (specialty) {
      query = query.eq("specialty", specialty)
    }
    if (approval_status) {
      query = query.eq("approval_status", approval_status)
    }
    if (date_from) {
      query = query.gte("appointment_date", new Date(date_from).toISOString())
    }
    if (date_to) {
      const endDate = new Date(date_to)
      endDate.setDate(endDate.getDate() + 1)
      query = query.lt("appointment_date", endDate.toISOString())
    }

    const { data: appointments, error } = await query

    if (error) {
      throw error
    }

    // Buscar estatísticas
    const { data: stats } = await supabase
      .from("appointments")
      .select("status, approval_status")
      .eq("hospital_id", session.user.id)

    const statistics = {
      total: stats?.length || 0,
      by_status: {
        scheduled: stats?.filter((a) => a.status === "scheduled").length || 0,
        completed: stats?.filter((a) => a.status === "completed").length || 0,
        cancelled: stats?.filter((a) => a.status === "cancelled").length || 0,
        rescheduled: stats?.filter((a) => a.status === "rescheduled").length || 0,
      },
      by_approval: {
        pending: stats?.filter((a) => a.approval_status === "pending").length || 0,
        approved: stats?.filter((a) => a.approval_status === "approved").length || 0,
        rejected: stats?.filter((a) => a.approval_status === "rejected").length || 0,
      },
    }

    return NextResponse.json({
      success: true,
      data: appointments,
      statistics,
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

// POST - Agendar consulta como hospital
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

    // Verificar se é hospital
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "hospital") {
      return NextResponse.json({ error: "Acesso negado - apenas hospitais" }, { status: 403 })
    }

    // Validar dados obrigatórios
    const {
      patient_id,
      doctor_id,
      appointment_date,
      duration = 60,
      specialty,
      appointment_type,
      notes,
      location,
      requested_by,
    } = body

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

    // Verificar se o médico existe (se especificado)
    if (doctor_id) {
      const { data: doctor } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", doctor_id)
        .eq("user_type", "doctor")
        .single()

      if (!doctor) {
        return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 })
      }

      // Verificar se o médico trabalha neste hospital
      const { data: doctorHospital } = await supabase
        .from("doctor_hospital")
        .select("id")
        .eq("doctor_id", doctor_id)
        .eq("hospital_id", session.user.id)
        .eq("status", "active")
        .single()

      if (!doctorHospital) {
        return NextResponse.json({ error: "Médico não está associado a este hospital" }, { status: 400 })
      }

      // Verificar conflito de horário do médico
      const appointmentDateTime = new Date(appointment_date)
      const endTime = new Date(appointmentDateTime.getTime() + duration * 60000)

      const { data: conflicts } = await supabase
        .from("appointments")
        .select("id")
        .eq("doctor_id", doctor_id)
        .eq("status", "scheduled")
        .gte("appointment_date", appointmentDateTime.toISOString())
        .lt("appointment_date", endTime.toISOString())

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json(
          { error: "Conflito de horário - médico já possui consulta agendada neste período" },
          { status: 409 },
        )
      }
    }

    // Criar consulta
    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        patient_id,
        doctor_id: doctor_id || null,
        hospital_id: session.user.id,
        appointment_date: new Date(appointment_date).toISOString(),
        duration,
        status: "scheduled",
        specialty,
        appointment_type: appointment_type || "primeira-consulta",
        notes,
        location: location || profile.hospital_name || "Hospital",
        confirmation_sent: false,
        requested_by: requested_by || session.user.id,
        approval_status: "approved", // Hospitais aprovam automaticamente
      })
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

    // Criar notificação para o paciente
    await supabase.from("notifications").insert({
      user_id: patient_id,
      type: "appointment_reminder",
      content: `Nova consulta agendada para ${new Date(appointment_date).toLocaleDateString()} às ${new Date(
        appointment_date,
      ).toLocaleTimeString()}`,
      related_id: appointment?.id,
      read: false,
    })

    // Se tiver médico, notificar também
    if (doctor_id) {
      await supabase.from("notifications").insert({
        user_id: doctor_id,
        type: "appointment_reminder",
        content: `Nova consulta agendada com ${patient.full_name} para ${new Date(
          appointment_date,
        ).toLocaleDateString()} às ${new Date(appointment_date).toLocaleTimeString()}`,
        related_id: appointment?.id,
        read: false,
      })
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
