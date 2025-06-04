import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Bypass para rotas públicas
  if (pathname === "/" || pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  try {
    // Criar cliente do Supabase
    const supabase = createClient()

    // Verificar se o usuário está autenticado
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Se não estiver autenticado e tentar acessar uma rota protegida, redirecionar para login
    if (!session && !pathname.startsWith("/auth/")) {
      return NextResponse.redirect(new URL("/", request.url))
    }

    // Se estiver autenticado e tentar acessar a página de login, redirecionar para dashboard
    if (session && pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    return NextResponse.next()
  } catch (error) {
    // Em caso de erro, redirecionar para login
    return NextResponse.redirect(new URL("/", request.url))
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
