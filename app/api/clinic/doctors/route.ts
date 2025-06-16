import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Listar médicos da clínica
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
    const include_stats = searchParams.get("include_stats") === "true"
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Construir query
    let query = supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        phone,
        created_at,
        updated_at
      `)
      .eq("user_type", "doctor")
      .order("full_name", { ascending: true })
      .range(offset, offset + limit - 1)

    // Aplicar filtro de busca
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data: doctors, error } = await query

    if (error) {
      throw error
    }

    // Se solicitado, incluir estatísticas
    let processedDoctors = doctors
    if (include_stats && doctors) {
      const doctorIds = doctors.map((d) => d.id)

      // Buscar consultas
      const { data: appointments } = await supabase
        .from("appointments")
        .select("doctor_id, status, appointment_date")
        .in("doctor_id", doctorIds)

      // Buscar exames
      const { data: exams } = await supabase.from("exams").select("doctor_id, status").in("doctor_id", doctorIds)

      // Processar estatísticas
      processedDoctors = doctors.map((doctor) => {
        const doctorAppointments = appointments?.filter((a) => a.doctor_id === doctor.id) || []
        const doctorExams = exams?.filter((e) => e.doctor_id === doctor.id) || []

        // Consultas do mês atual
        const currentMonth = new Date()
        currentMonth.setDate(1)
        const appointmentsThisMonth = doctorAppointments.filter((a) => new Date(a.appointment_date) >= currentMonth)

        return {
          ...doctor,
          stats: {
            total_appointments: doctorAppointments.length,
            completed_appointments: doctorAppointments.filter((a) => a.status === "completed").length,
            appointments_this_month: appointmentsThisMonth.length,
            total_exams: doctorExams.length,
            pending_exams: doctorExams.filter((e) => e.status !== "completed").length,
            last_appointment:
              doctorAppointments.sort(
                (a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime(),
              )[0]?.appointment_date || null,
          },
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: processedDoctors,
      pagination: {
        limit,
        offset,
        total: doctors?.length || 0,
      },
    })
  } catch (error: any) {
    console.error("Erro ao buscar médicos:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}

// POST - Cadastrar novo médico
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
    const { full_name, email, phone, specialty } = body

    if (!full_name || !email) {
      return NextResponse.json({ error: "full_name e email são obrigatórios" }, { status: 400 })
    }

    // Verificar se email já existe
    const { data: existingUser } = await supabase.from("profiles").select("id").eq("email", email).single()

    if (existingUser) {
      return NextResponse.json({ error: "Email já cadastrado no sistema" }, { status: 409 })
    }

    // Criar médico
    const { data: doctor, error } = await supabase
      .from("profiles")
      .insert({
        full_name,
        email,
        phone,
        user_type: "doctor",
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
        message: "Médico cadastrado com sucesso",
        data: doctor,
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error("Erro ao cadastrar médico:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
