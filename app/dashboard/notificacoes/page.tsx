import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { Bell, Calendar, FileText, Pill, CheckCircle, AlertTriangle } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default async function NotificationsPage() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
          <p className="text-muted-foreground">Você precisa estar logado para ver suas notificações</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Bell className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Faça login para ver suas notificações</p>
            <Button className="mt-4" asChild>
              <a href="/">Ir para login</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const userId = session.user.id

  // Verificar se a tabela existe e buscar notificações
  let tableExists = true
  let errorMessage = ""
  let notifications: any[] = []

  try {
    // Primeiro, verificar se a tabela existe fazendo uma query simples
    const { data, error, count } = await supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)

    if (error) {
      console.error("Erro detalhado:", error)

      // Verificar diferentes tipos de erro
      if (error.message?.includes("does not exist") || error.message?.includes("relation") || error.code === "42P01") {
        tableExists = false
        errorMessage = "A tabela 'notifications' não existe no banco de dados."
      } else if (error.message?.includes("Too Many Requests") || error.message?.includes("rate limit")) {
        errorMessage = "Muitas requisições. Tente novamente em alguns segundos."
      } else {
        errorMessage = `Erro ao acessar notificações: ${error.message}`
      }
    } else {
      // Se a primeira query funcionou, buscar todas as notificações
      const { data: allNotifications, error: allError } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (allError) {
        console.error("Erro ao buscar todas as notificações:", allError)
        errorMessage = `Erro ao carregar notificações: ${allError.message}`
      } else {
        notifications = allNotifications || []
      }
    }
  } catch (error: any) {
    console.error("Erro inesperado:", error)
    tableExists = false
    errorMessage = `Erro inesperado: ${error.message || "Erro desconhecido"}`
  }

  // Se houver erro, mostrar mensagem de erro
  if (!tableExists || errorMessage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
          <p className="text-muted-foreground">Gerencie suas notificações</p>
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro no sistema</AlertTitle>
          <AlertDescription>
            {errorMessage}
            <div className="mt-4">
              <p className="font-medium">Para resolver este problema:</p>
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>Verifique se as tabelas do banco de dados foram criadas</li>
                <li>Execute os scripts SQL necessários no Supabase</li>
                <li>Aguarde alguns segundos se for erro de rate limit</li>
                <li>Recarregue esta página</li>
              </ol>
            </div>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Ações de Recuperação</CardTitle>
            <CardDescription>Tente uma das opções abaixo para resolver o problema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              action={async () => {
                "use server"
                revalidatePath("/dashboard/notificacoes")
              }}
            >
              <Button type="submit" className="w-full">
                🔄 Recarregar Página
              </Button>
            </form>

            <Button variant="outline" className="w-full" asChild>
              <a href="/dashboard">🏠 Voltar ao Dashboard</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const unreadNotifications = notifications.filter((notification) => !notification.read)
  const readNotifications = notifications.filter((notification) => notification.read)

  async function markAsRead(id: string) {
    "use server"
    try {
      const supabase = createClient()
      await supabase.from("notifications").update({ read: true, read_at: new Date().toISOString() }).eq("id", id)

      revalidatePath("/dashboard/notificacoes")
    } catch (error) {
      console.error("Erro ao marcar como lida:", error)
    }
  }

  async function markAllAsRead() {
    "use server"
    try {
      const supabase = createClient()
      const unreadIds = unreadNotifications.map((notification) => notification.id)

      if (unreadIds.length === 0) return

      await supabase.from("notifications").update({ read: true, read_at: new Date().toISOString() }).in("id", unreadIds)

      revalidatePath("/dashboard/notificacoes")
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
          <p className="text-muted-foreground">
            {notifications.length === 0
              ? "Nenhuma notificação encontrada"
              : `${notifications.length} notificação${notifications.length !== 1 ? "ões" : ""} encontrada${notifications.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {unreadNotifications.length > 0 && (
          <form action={markAllAsRead}>
            <Button variant="outline" type="submit">
              ✅ Marcar todas como lidas
            </Button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState />
      ) : (
        <Tabs defaultValue="unread" className="space-y-4">
          <TabsList>
            <TabsTrigger value="unread">
              Não lidas
              {unreadNotifications.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {unreadNotifications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="read">
              Lidas
              {readNotifications.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {readNotifications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">
              Todas
              <Badge variant="outline" className="ml-2">
                {notifications.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unread" className="space-y-4">
            {unreadNotifications.length > 0 ? (
              unreadNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} markAsRead={markAsRead} />
              ))
            ) : (
              <EmptyState message="Nenhuma notificação não lida" />
            )}
          </TabsContent>

          <TabsContent value="read" className="space-y-4">
            {readNotifications.length > 0 ? (
              readNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} markAsRead={markAsRead} />
              ))
            ) : (
              <EmptyState message="Nenhuma notificação lida" />
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {notifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} markAsRead={markAsRead} />
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function NotificationCard({
  notification,
  markAsRead,
}: { notification: any; markAsRead: (id: string) => Promise<void> }) {
  let icon = <Bell className="h-5 w-5" />
  let iconBg = "bg-blue-100 dark:bg-blue-900"

  if (notification.type === "exam_result") {
    icon = <FileText className="h-5 w-5" />
    iconBg = "bg-green-100 dark:bg-green-900"
  } else if (notification.type === "medication_reminder") {
    icon = <Pill className="h-5 w-5" />
    iconBg = "bg-orange-100 dark:bg-orange-900"
  } else if (notification.type === "appointment_reminder") {
    icon = <Calendar className="h-5 w-5" />
    iconBg = "bg-purple-100 dark:bg-purple-900"
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString("pt-BR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "Data inválida"
    }
  }

  return (
    <Card className={`transition-opacity ${notification.read ? "opacity-75" : "border-l-4 border-l-blue-500"}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-start space-x-4">
            <div className={`${iconBg} p-2 rounded-full flex-shrink-0`}>{icon}</div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base leading-tight">
                {notification.content || "Notificação sem conteúdo"}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">📅 {formatDate(notification.created_at)}</p>
              {notification.type && (
                <Badge variant="outline" className="mt-2 text-xs">
                  {notification.type === "exam_result" && "🔬 Resultado de Exame"}
                  {notification.type === "medication_reminder" && "💊 Lembrete de Medicamento"}
                  {notification.type === "appointment_reminder" && "📅 Lembrete de Consulta"}
                  {!["exam_result", "medication_reminder", "appointment_reminder"].includes(notification.type) &&
                    `📢 ${notification.type}`}
                </Badge>
              )}
            </div>
          </div>

          {!notification.read && (
            <form action={() => markAsRead(notification.id)}>
              <Button variant="ghost" size="icon" type="submit" className="flex-shrink-0">
                <CheckCircle className="h-5 w-5" />
                <span className="sr-only">Marcar como lida</span>
              </Button>
            </form>
          )}
        </div>
      </CardHeader>
      {notification.read && notification.read_at && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">✅ Lida em: {formatDate(notification.read_at)}</p>
        </CardContent>
      )}
    </Card>
  )
}

function EmptyState({ message = "Nenhuma notificação encontrada" }: { message?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-muted rounded-full p-4 mb-4">
          <Bell className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">Sem notificações</h3>
        <p className="text-muted-foreground mb-4">{message}</p>
        <Button variant="outline" asChild>
          <a href="/dashboard">🏠 Voltar ao Dashboard</a>
        </Button>
      </CardContent>
    </Card>
  )
}
