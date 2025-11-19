import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, TrendingUp, MessageSquare, Link as LinkIcon, AlertTriangle, CheckCircle2, Clock, Loader2, FileText } from "lucide-react";
import { AnalysisProgressCard } from "@/components/AnalysisProgressCard";

export default function AnalysisResult() {
  const [, params] = useRoute("/analysis/:id");
  const sessionId = params?.id ? parseInt(params.id) : 0;

  const { data: session, isLoading: sessionLoading } = trpc.analysis.getById.useQuery(
    { sessionId },
    { enabled: sessionId > 0 }
  );
  const { data: metrics, isLoading: metricsLoading } = trpc.analysis.getMetrics.useQuery(
    { sessionId },
    { enabled: sessionId > 0 }
  );

  // Validate sessionId
  if (sessionId === 0) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-center space-y-4">
              <div className="text-muted-foreground">無效的分析 ID</div>
              <Link href="/projects">
                <Button variant="outline">返回專案列表</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sessionLoading || metricsLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!session || !metrics) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-center space-y-4">
              <div className="text-muted-foreground">分析結果不存在</div>
              <Link href="/projects">
                <Button variant="outline">返回專案列表</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summaryMetrics, citationAnalysis, actionPlan } = metrics;
  const totalSentiment =
    summaryMetrics.sentimentBreakdown.positive +
    summaryMetrics.sentimentBreakdown.neutral +
    summaryMetrics.sentimentBreakdown.negative +
    summaryMetrics.sentimentBreakdown.sarcastic;

  return (
    <div className="container py-8">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">分析結果 #{sessionId}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge
              variant={
                session.status === "completed"
                  ? "default"
                  : session.status === "failed"
                  ? "destructive"
                  : "secondary"
              }
            >
              {session.status === "completed"
                ? "已完成"
                : session.status === "failed"
                ? "失敗"
                : session.status === "running"
                ? "執行中"
                : "待處理"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {new Date(session.startedAt).toLocaleString("zh-TW")}
            </span>
          </div>
        </div>

        {/* Real-time progress for running sessions */}
        {(session.status === "running" || session.status === "pending") && (
          <AnalysisProgressCard sessionId={sessionId} />
        )}

        {/* Generate Report Button for completed sessions */}
        {session.status === "completed" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                LLM 深度分析報告
              </CardTitle>
              <CardDescription>
                使用 LLM 生成包含執行摘要、關鍵發現和戰略建議的完整分析報告
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/analysis/${sessionId}/report`}>
                <Button size="lg">
                  <FileText className="mr-2 h-5 w-5" />
                  查看/生成報告
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Summary Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI 聲量佔有率</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryMetrics.shareOfVoiceFrequency}</div>
              <p className="text-xs text-muted-foreground">絕對提及次數</p>
              <div className="mt-2">
                <div className="text-sm font-medium">加權分數：{summaryMetrics.shareOfVoiceWeighted}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">正面評價</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {summaryMetrics.sentimentBreakdown.positive}
              </div>
              <p className="text-xs text-muted-foreground">
                {totalSentiment > 0
                  ? `${((summaryMetrics.sentimentBreakdown.positive / totalSentiment) * 100).toFixed(1)}%`
                  : "0%"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">負面評價</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {summaryMetrics.sentimentBreakdown.negative}
              </div>
              <p className="text-xs text-muted-foreground">
                {totalSentiment > 0
                  ? `${((summaryMetrics.sentimentBreakdown.negative / totalSentiment) * 100).toFixed(1)}%`
                  : "0%"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">反串/酸文</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {summaryMetrics.sentimentBreakdown.sarcastic}
              </div>
              <p className="text-xs text-muted-foreground">
                {totalSentiment > 0
                  ? `${((summaryMetrics.sentimentBreakdown.sarcastic / totalSentiment) * 100).toFixed(1)}%`
                  : "0%"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sentiment Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>情感分析分佈</CardTitle>
            <CardDescription>品牌提及的情感傾向統計</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-600">正面評價</span>
                <span className="font-medium">{summaryMetrics.sentimentBreakdown.positive}</span>
              </div>
              <Progress
                value={totalSentiment > 0 ? (summaryMetrics.sentimentBreakdown.positive / totalSentiment) * 100 : 0}
                className="h-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">中性</span>
                <span className="font-medium">{summaryMetrics.sentimentBreakdown.neutral}</span>
              </div>
              <Progress
                value={totalSentiment > 0 ? (summaryMetrics.sentimentBreakdown.neutral / totalSentiment) * 100 : 0}
                className="h-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-red-600">負面評價</span>
                <span className="font-medium">{summaryMetrics.sentimentBreakdown.negative}</span>
              </div>
              <Progress
                value={totalSentiment > 0 ? (summaryMetrics.sentimentBreakdown.negative / totalSentiment) * 100 : 0}
                className="h-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-orange-600">反串/酸文</span>
                <span className="font-medium">{summaryMetrics.sentimentBreakdown.sarcastic}</span>
              </div>
              <Progress
                value={totalSentiment > 0 ? (summaryMetrics.sentimentBreakdown.sarcastic / totalSentiment) * 100 : 0}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Hallucination Stats Card */}
        {metrics.hallucinationStats && metrics.hallucinationStats.totalAnalyzed > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                AI 幻覺指數
              </CardTitle>
              <CardDescription>
                檢測 AI 回應中的事實準確性與可信度
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.hallucinationStats.averageScore !== null && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>平均幻覺指數</span>
                      <span className="font-medium">
                        {metrics.hallucinationStats.averageScore}/100
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          metrics.hallucinationStats.averageScore >= 70
                            ? "bg-red-500"
                            : metrics.hallucinationStats.averageScore >= 40
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                        style={{ width: `${metrics.hallucinationStats.averageScore}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {metrics.hallucinationStats.averageScore < 40
                        ? "低風險：回應具有高可信度"
                        : metrics.hallucinationStats.averageScore < 70
                        ? "中風險：建議交叉驗證資訊"
                        : "高風險：需要謹慎查證事實"}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {metrics.hallucinationStats.lowRiskCount}
                    </div>
                    <div className="text-xs text-gray-600">低風險</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {metrics.hallucinationStats.mediumRiskCount}
                    </div>
                    <div className="text-xs text-gray-600">中風險</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {metrics.hallucinationStats.highRiskCount}
                    </div>
                    <div className="text-xs text-gray-600">高風險</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 text-center">
                  共分析 {metrics.hallucinationStats.totalAnalyzed} 筆回應
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Citation Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              引用來源分析
            </CardTitle>
            <CardDescription>AI 回答引用的來源類型分佈</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(citationAnalysis).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-4 border rounded-lg">
                  <span className="text-sm font-medium capitalize">
                    {type === "ecommerce"
                      ? "電商"
                      : type === "forum"
                      ? "論壇"
                      : type === "media"
                      ? "媒體"
                      : type === "video"
                      ? "影片"
                      : type === "competitor"
                      ? "競品"
                      : type === "official"
                      ? "官網"
                      : "其他"}
                  </span>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Plan */}
        <Card>
          <CardHeader>
            <CardTitle>戰略行動建議</CardTitle>
            <CardDescription>基於分析結果的具體改善建議</CardDescription>
          </CardHeader>
          <CardContent>
            {!actionPlan || actionPlan.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暫無行動建議
              </div>
            ) : (
              <div className="space-y-4">
                {actionPlan.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="mt-1">
                      {item.status === "completed" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : item.status === "in_progress" ? (
                        <Clock className="h-5 w-5 text-blue-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{item.title}</h4>
                        <Badge
                          variant={
                            item.priority === "high"
                              ? "destructive"
                              : item.priority === "medium"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {item.priority === "high" ? "高" : item.priority === "medium" ? "中" : "低"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      {item.tactic && (
                        <p className="text-sm text-blue-600">策略：{item.tactic}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
