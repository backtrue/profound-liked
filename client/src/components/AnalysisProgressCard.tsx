import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, Bell, BellOff } from "lucide-react";
import { useAnalysisProgress } from "@/hooks/useAnalysisProgress";
import { useBrowserNotification } from "@/hooks/useBrowserNotification";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";

interface AnalysisProgressCardProps {
  sessionId: number;
}

export function AnalysisProgressCard({ sessionId }: AnalysisProgressCardProps) {
  const { progress, error, isConnected } = useAnalysisProgress(sessionId);
  const { isSupported, permission, requestPermission, showNotification } = useBrowserNotification();
  const previousStatusRef = useRef<string | null>(null);
  
  // Show notification when analysis completes or fails
  useEffect(() => {
    if (!progress) return;
    
    // Only trigger notification on status change
    if (previousStatusRef.current === progress.status) return;
    previousStatusRef.current = progress.status;
    
    if (progress.status === "completed") {
      showNotification("🎉 分析完成！", {
        body: `成功 ${progress.successCount} 筆，失敗 ${progress.failedCount} 筆。點擊查看詳細結果。`,
        tag: `analysis-${sessionId}`,
      });
    } else if (progress.status === "failed") {
      showNotification("⚠️ 分析失敗", {
        body: "分析執行過程中發生錯誤，請查看執行日誌。",
        tag: `analysis-${sessionId}`,
      });
    }
  }, [progress, sessionId, showNotification]);

  if (!progress && !error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isConnected ? "等待分析開始..." : "連接中..."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">分析失敗</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!progress) return null;

  const progressPercentage = progress.totalQueries > 0 
    ? Math.round((progress.currentQuery / progress.totalQueries) * 100) 
    : 0;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds} 秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} 分 ${remainingSeconds} 秒`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSupported && permission === "default" && (
              <Button
                variant="outline"
                size="sm"
                onClick={requestPermission}
                className="gap-2"
              >
                <Bell className="h-4 w-4" />
                啟用通知
              </Button>
            )}
            {isSupported && permission === "granted" && (
              <Badge variant="secondary" className="gap-1">
                <Bell className="h-3 w-3" />
                通知已啟用
              </Badge>
            )}
            {isSupported && permission === "denied" && (
              <Badge variant="outline" className="gap-1">
                <BellOff className="h-3 w-3" />
                通知已關閉
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {progress.status === "running" && (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <CardTitle>分析進行中</CardTitle>
              </>
            )}
            {progress.status === "completed" && (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <CardTitle className="text-green-600">分析完成</CardTitle>
              </>
            )}
            {progress.status === "failed" && (
              <>
                <XCircle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">分析失敗</CardTitle>
              </>
            )}
          </div>
          <Badge variant={progress.status === "completed" ? "default" : "secondary"}>
            {progress.currentQuery} / {progress.totalQueries}
          </Badge>
        </div>
        <CardDescription>{progress.message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">進度</span>
            <span className="font-medium">{progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {progress.status === "running" && (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">當前引擎</div>
                <div className="font-medium">{progress.currentEngine}</div>
              </div>
              {progress.estimatedTimeRemaining !== undefined && (
                <div className="space-y-1">
                  <div className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    預估剩餘時間
                  </div>
                  <div className="font-medium">{formatTime(progress.estimatedTimeRemaining)}</div>
                </div>
              )}
            </div>
            
            {progress.rateLimit && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{progress.rateLimit}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  為了遵守 API 配額限制，每個問句之間會有延遲。請耐心等候，系統正在穩定執行中...
                </p>
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">成功</div>
            <div className="text-2xl font-bold text-green-600">{progress.successCount}</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">失敗</div>
            <div className="text-2xl font-bold text-destructive">{progress.failedCount}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
