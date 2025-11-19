import { useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, PlayCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ProjectDetail() {
  const [, params] = useRoute("/project/:id");
  const projectId = params?.id ? parseInt(params.id) : 0;

  const [isAddKeywordDialogOpen, setIsAddKeywordDialogOpen] = useState(false);
  const [keyword, setKeyword] = useState("");

  const { data: project, isLoading: projectLoading } = trpc.project.getById.useQuery({ projectId });
  const { data: seedKeywords, refetch: refetchKeywords } = trpc.seedKeyword.listByProject.useQuery({ projectId });
  const { data: sessions, refetch: refetchSessions } = trpc.analysis.listByProject.useQuery({ projectId });

  const createKeyword = trpc.seedKeyword.create.useMutation({
    onSuccess: () => {
      toast.success("關鍵字已新增");
      setIsAddKeywordDialogOpen(false);
      setKeyword("");
      refetchKeywords();
    },
    onError: (error) => {
      toast.error(`新增失敗：${error.message}`);
    },
  });

  const generateQueries = trpc.queryGeneration.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`已生成 ${data.total} 個測試問句（模板：${data.template}，AI：${data.aiCreative}）`);
    },
    onError: (error) => {
      toast.error(`生成失敗：${error.message}`);
    },
  });

  const createSession = trpc.analysis.create.useMutation({
    onSuccess: async (data) => {
      toast.success("分析任務已建立，正在啟動批次測試...");
      refetchSessions();
      
      // Immediately run batch test
      try {
        await runBatchTest.mutateAsync({ sessionId: data.id });
      } catch (error) {
        // Error already handled by mutation
      }
    },
    onError: (error) => {
      toast.error(`建立失敗：${error.message}`);
    },
  });

  const runBatchTest = trpc.analysis.runBatchTest.useMutation({
    onSuccess: () => {
      toast.success("批次測試已啟動，請稍後查看結果");
      refetchSessions();
    },
    onError: (error) => {
      toast.error(`測試啟動失敗：${error.message}`);
    },
  });

  const handleAddKeyword = () => {
    if (!keyword.trim()) {
      toast.error("請輸入關鍵字");
      return;
    }

    createKeyword.mutate({
      projectId,
      keyword: keyword.trim(),
    });
  };

  const handleGenerateQueries = (seedKeywordId: number, seedKeyword: string) => {
    if (!project) return;

    generateQueries.mutate({
      seedKeywordId,
      seedKeyword,
      targetMarket: project.targetMarket,
    });
  };

  const handleStartAnalysis = () => {
    createSession.mutate({ projectId });
  };

  if (projectLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-center space-y-4">
              <div className="text-muted-foreground">專案不存在</div>
              <Link href="/projects">
                <Button variant="outline">返回專案列表</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <Link href="/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回專案列表
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.projectName}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline">{project.brandName}</Badge>
            <Badge variant="secondary">{project.targetMarket === "TW" ? "台灣市場" : "日本市場"}</Badge>
          </div>
        </div>

        <Tabs defaultValue="keywords" className="space-y-6">
          <TabsList>
            <TabsTrigger value="keywords">關鍵字管理</TabsTrigger>
            <TabsTrigger value="analysis">分析歷史</TabsTrigger>
          </TabsList>

          <TabsContent value="keywords" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">種子關鍵字</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  新增關鍵字並生成測試問句
                </p>
              </div>
              <Dialog open={isAddKeywordDialogOpen} onOpenChange={setIsAddKeywordDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    新增關鍵字
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新增種子關鍵字</DialogTitle>
                    <DialogDescription>
                      輸入您想要分析的產品或服務關鍵字
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="keyword">關鍵字</Label>
                      <Input
                        id="keyword"
                        placeholder="例如：洗面乳"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddKeywordDialogOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={handleAddKeyword} disabled={createKeyword.isPending}>
                      {createKeyword.isPending ? "新增中..." : "新增"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {!seedKeywords || seedKeywords.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <div className="text-muted-foreground">尚無關鍵字</div>
                    <p className="text-sm text-muted-foreground max-w-md">
                      新增您的第一個種子關鍵字，系統將自動生成測試問句
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {seedKeywords.map((kw) => (
                  <Card key={kw.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{kw.keyword}</CardTitle>
                        <Button
                          size="sm"
                          onClick={() => handleGenerateQueries(kw.id, kw.keyword)}
                          disabled={generateQueries.isPending}
                        >
                          {generateQueries.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              生成中...
                            </>
                          ) : (
                            <>
                              <PlayCircle className="mr-2 h-4 w-4" />
                              生成測試問句
                            </>
                          )}
                        </Button>
                      </div>
                      <CardDescription>
                        建立於 {new Date(kw.createdAt).toLocaleDateString("zh-TW")}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">分析歷史</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  查看過往的分析結果與指標
                </p>
              </div>
              <Button onClick={handleStartAnalysis} disabled={createSession.isPending}>
                {createSession.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    建立中...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    開始新分析
                  </>
                )}
              </Button>
            </div>

            {!sessions || sessions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <div className="text-muted-foreground">尚無分析記錄</div>
                    <p className="text-sm text-muted-foreground max-w-md">
                      開始您的第一次分析，追蹤品牌在 AI 搜尋引擎中的表現
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {sessions.map((session) => (
                  <Card key={session.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            分析 #{session.id}
                          </CardTitle>
                          <CardDescription>
                            {new Date(session.startedAt).toLocaleString("zh-TW")}
                          </CardDescription>
                        </div>
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
                      </div>
                    </CardHeader>
                    {session.status === "completed" && (
                      <CardContent>
                        <Link href={`/analysis/${session.id}`}>
                          <Button variant="outline" className="w-full">
                            查看分析結果
                          </Button>
                        </Link>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
