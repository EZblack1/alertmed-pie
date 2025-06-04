import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import {
  Bell,
  Shield,
  Palette,
  User,
  Database,
  Download,
  Trash2,
  Moon,
  Sun,
  Monitor,
  AlertTriangle,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function ConfiguracoesPage() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  const userId = session.user.id

  // Verificar se as tabelas existem
  let tablesExist = true
  let errorMessage = ""

  try {
    const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

    if (error && error.message.includes("does not exist")) {
      tablesExist = false
      errorMessage = "As tabelas do banco de dados não existem."
    }
  } catch (error: any) {
    console.error("Erro ao verificar tabelas:", error)
    tablesExist = false
    errorMessage = "Erro ao verificar as tabelas no banco de dados."
  }

  if (!tablesExist) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">Gerencie suas preferências e configurações</p>
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro no banco de dados</AlertTitle>
          <AlertDescription>{errorMessage} Execute o script SQL para criar as tabelas necessárias.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas preferências e configurações do sistema</p>
      </div>

      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="privacy">Privacidade</TabsTrigger>
          <TabsTrigger value="appearance">Aparência</TabsTrigger>
          <TabsTrigger value="data">Dados</TabsTrigger>
          <TabsTrigger value="account">Conta</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Preferências de Notificação
              </CardTitle>
              <CardDescription>Configure como e quando você deseja receber notificações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="exam-notifications">Resultados de Exames</Label>
                    <p className="text-sm text-muted-foreground">
                      Receber notificações quando resultados de exames estiverem disponíveis
                    </p>
                  </div>
                  <Switch id="exam-notifications" defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="medication-reminders">Lembretes de Medicamentos</Label>
                    <p className="text-sm text-muted-foreground">
                      Receber lembretes para tomar medicamentos nos horários programados
                    </p>
                  </div>
                  <Switch id="medication-reminders" defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="appointment-reminders">Lembretes de Consultas</Label>
                    <p className="text-sm text-muted-foreground">Receber lembretes sobre consultas agendadas</p>
                  </div>
                  <Switch id="appointment-reminders" defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notifications">Notificações por Email</Label>
                    <p className="text-sm text-muted-foreground">Receber notificações importantes por email</p>
                  </div>
                  <Switch id="email-notifications" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="sms-notifications">Notificações por SMS</Label>
                    <p className="text-sm text-muted-foreground">Receber notificações urgentes por SMS</p>
                  </div>
                  <Switch id="sms-notifications" />
                </div>
              </div>

              <div className="pt-4">
                <Button>Salvar Preferências</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacidade e Segurança
              </CardTitle>
              <CardDescription>Controle quem pode ver suas informações e como elas são usadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="profile-visibility">Perfil Público</Label>
                    <p className="text-sm text-muted-foreground">
                      Permitir que outros usuários vejam seu perfil básico
                    </p>
                  </div>
                  <Switch id="profile-visibility" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="data-sharing">Compartilhamento de Dados</Label>
                    <p className="text-sm text-muted-foreground">
                      Permitir compartilhamento de dados anônimos para pesquisa médica
                    </p>
                  </div>
                  <Switch id="data-sharing" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="analytics">Análises de Uso</Label>
                    <p className="text-sm text-muted-foreground">
                      Permitir coleta de dados de uso para melhorar o sistema
                    </p>
                  </div>
                  <Switch id="analytics" defaultChecked />
                </div>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Seus dados estão seguros</AlertTitle>
                <AlertDescription>
                  Todas as informações são criptografadas e seguem as normas da LGPD. Você pode solicitar a exclusão de
                  seus dados a qualquer momento.
                </AlertDescription>
              </Alert>

              <div className="pt-4">
                <Button>Salvar Configurações</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Aparência
              </CardTitle>
              <CardDescription>Personalize a aparência do sistema de acordo com suas preferências</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-base">Tema</Label>
                  <p className="text-sm text-muted-foreground mb-3">Escolha como o sistema deve aparecer para você</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col items-center space-y-2 p-4 border rounded-lg cursor-pointer hover:bg-accent">
                      <Sun className="h-6 w-6" />
                      <span className="text-sm">Claro</span>
                    </div>
                    <div className="flex flex-col items-center space-y-2 p-4 border rounded-lg cursor-pointer hover:bg-accent bg-accent">
                      <Moon className="h-6 w-6" />
                      <span className="text-sm">Escuro</span>
                    </div>
                    <div className="flex flex-col items-center space-y-2 p-4 border rounded-lg cursor-pointer hover:bg-accent">
                      <Monitor className="h-6 w-6" />
                      <span className="text-sm">Sistema</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="compact-mode">Modo Compacto</Label>
                    <p className="text-sm text-muted-foreground">Reduzir espaçamento para mostrar mais informações</p>
                  </div>
                  <Switch id="compact-mode" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="animations">Animações</Label>
                    <p className="text-sm text-muted-foreground">Habilitar animações e transições suaves</p>
                  </div>
                  <Switch id="animations" defaultChecked />
                </div>
              </div>

              <div className="pt-4">
                <Button>Salvar Aparência</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Gerenciamento de Dados
              </CardTitle>
              <CardDescription>Exporte, importe ou gerencie seus dados pessoais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <h3 className="font-medium">Exportar Dados</h3>
                    <p className="text-sm text-muted-foreground">
                      Baixe uma cópia de todos os seus dados em formato JSON
                    </p>
                  </div>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <h3 className="font-medium">Relatório de Atividades</h3>
                    <p className="text-sm text-muted-foreground">
                      Visualize um resumo de todas as suas atividades no sistema
                    </p>
                  </div>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Gerar Relatório
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <h3 className="font-medium">Backup Automático</h3>
                    <p className="text-sm text-muted-foreground">Configurar backup automático dos seus dados</p>
                    <Badge variant="secondary">Ativo</Badge>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <Alert>
                <Database className="h-4 w-4" />
                <AlertTitle>Backup Seguro</AlertTitle>
                <AlertDescription>
                  Seus dados são automaticamente salvos em backup criptografado a cada 24 horas.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Configurações da Conta
              </CardTitle>
              <CardDescription>Gerencie sua conta e configurações de segurança</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <h3 className="font-medium">Alterar Senha</h3>
                    <p className="text-sm text-muted-foreground">Atualize sua senha para manter sua conta segura</p>
                  </div>
                  <Button variant="outline">Alterar</Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <h3 className="font-medium">Autenticação de Dois Fatores</h3>
                    <p className="text-sm text-muted-foreground">Adicione uma camada extra de segurança à sua conta</p>
                    <Badge variant="outline">Não configurado</Badge>
                  </div>
                  <Button variant="outline">Configurar</Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <h3 className="font-medium">Sessões Ativas</h3>
                    <p className="text-sm text-muted-foreground">Gerencie os dispositivos conectados à sua conta</p>
                  </div>
                  <Button variant="outline">Gerenciar</Button>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-destructive">Zona de Perigo</h3>

                  <div className="flex items-center justify-between p-4 border border-destructive rounded-lg">
                    <div className="space-y-1">
                      <h4 className="font-medium">Desativar Conta</h4>
                      <p className="text-sm text-muted-foreground">
                        Desative temporariamente sua conta. Você pode reativá-la a qualquer momento.
                      </p>
                    </div>
                    <Button variant="outline">Desativar</Button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-destructive rounded-lg">
                    <div className="space-y-1">
                      <h4 className="font-medium">Excluir Conta</h4>
                      <p className="text-sm text-muted-foreground">
                        Exclua permanentemente sua conta e todos os dados associados.
                      </p>
                    </div>
                    <Button variant="destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
