import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Info, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function ExecutionLogs() {
  const params = useParams();
  const sessionId = params.sessionId ? parseInt(params.sessionId) : 0;

  const { data: logs, isLoading } = trpc.analysis.getExecutionLogs.useQuery(
    { sessionId },
    { enabled: sessionId > 0, refetchInterval: 5000 }
  );

  const { data: session } = trpc.analysis.getById.useQuery(
    { sessionId },
    { enabled: sessionId > 0 }
  );

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "info":
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "error":
        return <Badge variant="destructive">錯誤</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">警告</Badge>;
      case "info":
      default:
        return <Badge variant="secondary">資訊</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-6">
        <Link href={`/analysis/${sessionId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回分析結果
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>執行日誌</CardTitle>
          <CardDescription>
            分析 Session #{sessionId} 的詳細執行記錄
            {session && (
              <span className="ml-2">
                - 狀態: <Badge>{session.status}</Badge>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!logs || logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              尚無執行日誌
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getLevelIcon(log.level)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getLevelBadge(log.level)}
                        <span className="text-sm text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString("zh-TW", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-medium mb-2">{log.message}</p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            查看詳細資訊
                          </summary>
                          <pre className="mt-2 p-3 bg-muted rounded-md overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 text-sm text-muted-foreground text-center">
        <p>日誌每 5 秒自動更新</p>
      </div>
    </div>
  );
}
