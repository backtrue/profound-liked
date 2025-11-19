import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, Loader2, Download } from "lucide-react";
import { Streamdown } from "streamdown";
import { useState } from "react";
import { toast } from "sonner";

export default function AnalysisReport() {
  const [, params] = useRoute("/analysis/:id/report");
  const sessionId = params?.id ? parseInt(params.id) : 0;
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const generateReportMutation = trpc.analysis.generateReport.useMutation({
    onSuccess: (data) => {
      setReport(data.report);
      setIsGenerating(false);
      toast.success("報告生成完成！");
    },
    onError: (error) => {
      setIsGenerating(false);
      toast.error(`報告生成失敗：${error.message}`);
    },
  });

  const handleGenerateReport = () => {
    setIsGenerating(true);
    generateReportMutation.mutate({ sessionId });
  };

  const handleDownload = () => {
    if (!report) return;
    
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis-report-${sessionId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("報告已下載！");
  };

  return (
    <div className="container py-8">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-8 w-8" />
              分析報告 #{sessionId}
            </h1>
            <p className="text-muted-foreground mt-2">
              使用 LLM 生成的深度品牌分析報告
            </p>
          </div>
          {report && (
            <Button onClick={handleDownload} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              下載 Markdown
            </Button>
          )}
        </div>

        {!report && !isGenerating && (
          <Card>
            <CardHeader>
              <CardTitle>生成分析報告</CardTitle>
              <CardDescription>
                點擊下方按鈕，使用 LLM 自動生成包含執行摘要、AI 聲量分析、情感分析、關鍵發現和戰略建議的完整報告
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleGenerateReport} size="lg">
                <FileText className="mr-2 h-5 w-5" />
                生成報告
              </Button>
            </CardContent>
          </Card>
        )}

        {isGenerating && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">正在生成報告...</h3>
              <p className="text-sm text-muted-foreground">
                LLM 正在分析數據並撰寫報告，這可能需要 30-60 秒
              </p>
            </CardContent>
          </Card>
        )}

        {report && (
          <Card>
            <CardHeader>
              <CardTitle>分析報告</CardTitle>
              <CardDescription>
                由 LLM 自動生成的品牌分析報告
              </CardDescription>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none dark:prose-invert">
              <Streamdown>{report}</Streamdown>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
