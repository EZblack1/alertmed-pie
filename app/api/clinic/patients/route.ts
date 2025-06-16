import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Listar todos os pacientes da clínica
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

    // Verificar se é admin/clínica
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "admin") {
      return NextResponse.json({ error: "Acesso negado - apenas administradores" }, { status: 403 })
    }

    // Parâmetros de filtro
    const search = searchParams.get("search")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const include_stats = searchParams.get("include_stats") === "true"

    // Construir query base
    let query = supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        phone,
        date_of_birth,
        created_at,
        updated_at
      `)
      .eq("user_type", "patient")
      .order("full_name", { ascending: true })
      .range(offset, offset + limit - 1)

    // Aplicar filtro de busca
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    const { data: patients, error } = await query

    if (error) {
      throw error
    }

    // Se solicitado, incluir estatísticas de cada paciente
    let processedPatients = patients
    if (include_stats && patients) {
      const patientIds = patients.map((p) => p.id)

      // Buscar consultas
      const { data: appointments } = await supabase
        .from("appointments")
        .select("patient_id, status, appointment_date")
        .in("patient_id", patientIds)

      // Buscar exames
      const { data: exams } = await supabase
        .from("exams")
        .select("patient_id, status, result_available")
        .in("patient_id", patientIds)

      // Processar estatísticas
      processedPatients = patients.map((patient) => {
        const patientAppointments = appointments?.filter((a) => a.patient_id === patient.id) || []
        const patientExams = exams?.filter((e) => e.patient_id === patient.id) || []

        return {
          ...patient,
          stats: {
            total_appointments: patientAppointments.length,
            completed_appointments: patientAppointments.filter((a) => a.status === "completed").length,
            cancelled_appointments: patientAppointments.filter((a) => a.status === "cancelled").length,
            total_exams: patientExams.length,
            pending_exams: patientExams.filter((e) => !e.result_available).length,
            last_appointment:
              patientAppointments.sort(
                (a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime(),
              )[0]?.appointment_date || null,
          },
        }
      })
    }

    // Buscar total para paginação
    const { count: totalCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("user_type", "patient")

    return NextResponse.json({
      success: true,
      data: processedPatients,
      pagination: {
        limit,
        offset,
        total: totalCount || 0,
        has_more: offset + limit < (totalCount || 0),
      },
    })
  } catch (error: any) {
    console.error("Erro ao buscar pacientes:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}

// POST - Cadastrar novo paciente
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

    // Verificar se é admin/clínica
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", session.user.id).single()

    if (profile?.user_type !== "admin") {
      return NextResponse.json({ error: "Acesso negado - apenas administradores" }, { status: 403 })
    }

    // Validar dados obrigatórios
    const { full_name, email, phone, date_of_birth } = body

    if (!full_name || !email) {
      return NextResponse.json({ error: "full_name e email são obrigatórios" }, { status: 400 })
    }

    // Verificar se email já existe
    const { data: existingUser } = await supabase.from("profiles").select("id").eq("email", email).single()

    if (existingUser) {
      return NextResponse.json({ error: "Email já cadastrado no sistema" }, { status: 409 })
    }

    // Criar paciente (sem autenticação - apenas registro administrativo)
    const { data: patient, error } = await supabase
      .from("profiles")
      .insert({
        full_name,
        email,
        phone,
        date_of_birth: date_of_birth ? new Date(date_of_birth).toISOString().split("T")[0] : null,
        user_type: "patient",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(
      {
        success: true,
        message: "Paciente cadastrado com sucesso",
        data: patient,
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error("Erro ao cadastrar paciente:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
