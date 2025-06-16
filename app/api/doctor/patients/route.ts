import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET - Listar pacientes do médico
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
    const search = searchParams.get("search")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Buscar pacientes que já tiveram consultas ou exames com este médico
    let query = supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        phone,
        date_of_birth,
        appointments:appointments!appointments_patient_id_fkey(
          id,
          appointment_date,
          status,
          specialty
        ),
        exams:exams!exams_patient_id_fkey(
          id,
          exam_type,
          exam_date,
          status
        )
      `)
      .eq("user_type", "patient")
      .or(`appointments.doctor_id.eq.${session.user.id},exams.doctor_id.eq.${session.user.id}`)
      .order("full_name", { ascending: true })
      .range(offset, offset + limit - 1)

    // Aplicar filtro de busca
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data: patients, error } = await query

    if (error) {
      throw error
    }

    // Processar dados para incluir estatísticas
    const processedPatients = patients?.map((patient) => ({
      ...patient,
      stats: {
        total_appointments: patient.appointments?.length || 0,
        total_exams: patient.exams?.length || 0,
        last_appointment: patient.appointments?.[0]?.appointment_date || null,
        pending_exams: patient.exams?.filter((exam) => !exam.result_available).length || 0,
      },
    }))

    return NextResponse.json({
      success: true,
      data: processedPatients,
      pagination: {
        limit,
        offset,
        total: patients?.length || 0,
      },
    })
  } catch (error: any) {
    console.error("Erro ao buscar pacientes:", error)
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
