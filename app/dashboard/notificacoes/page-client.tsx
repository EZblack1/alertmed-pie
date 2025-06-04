"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Calendar, FileText, Pill, CheckCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { markNotificationAsRead, markAllNotificationsAsRead } from "@/app/actions/notifications"

interface NotificationsClientProps {
  initialNotifications: any[]
  userId: string
}

export default function NotificationsClient({ initialNotifications, userId }: NotificationsClientProps) {
  const [activeTab, setActiveTab] = useState("unread")
  const router = useRouter()

  const unreadNotifications = initialNotifications.filter((notification) => !notification.read)
  const readNotifications = initialNotifications.filter((notification) => notification.read)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
        {unreadNotifications.length > 0 && (
          <form action={() => markAllNotificationsAsRead(userId)}>
            <Button variant="outline" type="submit">
              Marcar todas como lidas
            </Button>
          </form>
        )}
      </div>

      <Tabs defaultValue="unread" className="space-y-4" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="unread">
            Não lidas
            {unreadNotifications.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unreadNotifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="read">Lidas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>

        <TabsContent value="unread" className="space-y-4">
          {unreadNotifications.length > 0 ? (
            unreadNotifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))
          ) : (
            <EmptyState message="Nenhuma notificação não lida" />
          )}
        </TabsContent>

        <TabsContent value="read" className="space-y-4">
          {readNotifications.length > 0 ? (
            readNotifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))
          ) : (
            <EmptyState message="Nenhuma notificação lida" />
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {initialNotifications.length > 0 ? (
            initialNotifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))
          ) : (
            <EmptyState />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function NotificationCard({ notification }: { notification: any }) {
  let icon = <Bell className="h-5 w-5" />

  if (notification.type === "exam_result") {
    icon = <FileText className="h-5 w-5" />
  } else if (notification.type === "medication_reminder") {
    icon = <Pill className="h-5 w-5" />
  } else if (notification.type === "appointment_reminder") {
    icon = <Calendar className="h-5 w-5" />
  }

  return (
    <Card className={notification.read ? "opacity-75" : ""}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-start space-x-4">
            <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">{icon}</div>
            <div>
              <CardTitle className="text-base">{notification.content}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(notification.created_at).toLocaleString("pt-BR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {!notification.read && (
            <form action={() => markNotificationAsRead(notification.id)}>
              <Button variant="ghost" size="icon" type="submit">
                <CheckCircle className="h-5 w-5" />
                <span className="sr-only">Marcar como lida</span>
              </Button>
            </form>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {notification.read && (
          <p className="text-xs text-muted-foreground">
            Lida em:{" "}
            {notification.read_at
              ? new Date(notification.read_at).toLocaleString("pt-BR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "N/A"}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyState({ message = "Nenhuma notificação encontrada" }: { message?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <Bell className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}
