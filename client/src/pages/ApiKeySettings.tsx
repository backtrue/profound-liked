import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Key, TestTube, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ApiKeySettings() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [provider, setProvider] = useState<"openai" | "perplexity" | "google" | "valueserp">("openai");
  const [apiKey, setApiKey] = useState("");
  const [testQuery, setTestQuery] = useState("推薦好用的洗面乳");
  const [testProvider, setTestProvider] = useState<"openai" | "perplexity" | "google" | "valueserp">("openai");
  const [testResult, setTestResult] = useState<{ content: string; citations: Array<{ url: string; title?: string }> } | null>(null);

  const { data: apiKeys, refetch } = trpc.apiKey.list.useQuery();

  const createKey = trpc.apiKey.create.useMutation({
    onSuccess: () => {
      toast.success("API Key 已新增");
      setIsAddDialogOpen(false);
      setApiKey("");
      refetch();
    },
    onError: (error) => {
      toast.error(`新增失敗：${error.message}`);
    },
  });

  const deleteKey = trpc.apiKey.delete.useMutation({
    onSuccess: () => {
      toast.success("API Key 已刪除");
      refetch();
    },
    onError: (error) => {
      toast.error(`刪除失敗：${error.message}`);
    },
  });

  const testKey = trpc.apiKey.test.useMutation({
    onSuccess: (data) => {
      setTestResult(data);
      toast.success("測試成功！");
    },
    onError: (error) => {
      toast.error(`測試失敗：${error.message}`);
      setTestResult(null);
    },
  });

  const handleAddKey = () => {
    if (!apiKey.trim()) {
      toast.error("請輸入 API Key");
      return;
    }

    createKey.mutate({ provider, apiKey: apiKey.trim() });
  };

  const handleDeleteKey = (keyId: number) => {
    if (confirm("確定要刪除此 API Key 嗎？")) {
      deleteKey.mutate({ keyId });
    }
  };

  const handleTestKey = () => {
    if (!testQuery.trim()) {
      toast.error("請輸入測試問句");
      return;
    }

    setTestResult(null);
    testKey.mutate({ provider: testProvider, query: testQuery.trim() });
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case "openai":
        return "OpenAI (ChatGPT)";
      case "perplexity":
        return "Perplexity";
      case "google":
        return "Google (Gemini)";
      case "valueserp":
        return "ValueSERP (Google SGE)";
      default:
        return provider;
    }
  };

  const getProviderBadgeColor = (provider: string) => {
    switch (provider) {
      case "openai":
        return "bg-green-100 text-green-800";
      case "perplexity":
        return "bg-blue-100 text-blue-800";
      case "google":
        return "bg-orange-100 text-orange-800";
      case "valueserp":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

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
          <h1 className="text-3xl font-bold tracking-tight">API Key 設定</h1>
          <p className="text-muted-foreground mt-2">
            管理您的 AI 引擎 API Keys（BYOK - Bring Your Own Key）
          </p>
        </div>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              關於 BYOK
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              為了保護您的隱私和控制成本，本系統採用 BYOK（Bring Your Own Key）模式。
              您需要自行申請並設定以下 AI 引擎的 API Key：
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                <strong>OpenAI (ChatGPT)</strong>：前往{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  OpenAI Platform
                </a>{" "}
                申請
              </li>
              <li>
                <strong>Perplexity</strong>：前往{" "}
                <a
                  href="https://www.perplexity.ai/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Perplexity Settings
                </a>{" "}
                申請
              </li>
              <li>
                <strong>Google (Gemini)</strong>：前往{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google AI Studio
                </a>{" "}
                申請
              </li>
              <li>
                <strong>ValueSERP (Google SGE)</strong>：前往{" "}
                <a
                  href="https://www.valueserp.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  ValueSERP
                </a>{" "}
                申請（支援多組 Key 自動切換）
              </li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              ⚠️ API Key 將使用 AES-256-GCM 加密儲存，僅用於您的分析任務。
            </p>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">已設定的 API Keys</h2>
            <p className="text-sm text-muted-foreground mt-1">
              管理您的 AI 引擎憑證
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <TestTube className="mr-2 h-4 w-4" />
                  測試 API
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>測試 API Key</DialogTitle>
                  <DialogDescription>
                    發送測試問句以驗證 API Key 是否正常運作
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="testProvider">選擇引擎</Label>
                    <Select value={testProvider} onValueChange={(value: "openai" | "perplexity" | "google" | "valueserp") => setTestProvider(value)}>
                      <SelectTrigger id="testProvider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
                        <SelectItem value="perplexity">Perplexity</SelectItem>
                        <SelectItem value="google">Google (Gemini)</SelectItem>
                        <SelectItem value="valueserp">ValueSERP (Google SGE)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="testQuery">測試問句</Label>
                    <Input
                      id="testQuery"
                      placeholder="例如：推薦好用的洗面乳"
                      value={testQuery}
                      onChange={(e) => setTestQuery(e.target.value)}
                    />
                  </div>
                  {testResult && (
                    <div className="space-y-2">
                      <Label>回應內容</Label>
                      <Textarea
                        value={testResult.content}
                        readOnly
                        className="min-h-[200px]"
                      />
                      {testResult.citations && testResult.citations.length > 0 && (
                        <div className="space-y-2">
                          <Label>引用來源</Label>
                          <div className="space-y-1">
                            {testResult.citations.map((citation, idx) => (
                              <div key={idx} className="text-sm">
                                <a
                                  href={citation.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {citation.title || citation.url}
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsTestDialogOpen(false)}>
                    關閉
                  </Button>
                  <Button onClick={handleTestKey} disabled={testKey.isPending}>
                    {testKey.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        測試中...
                      </>
                    ) : (
                      "發送測試"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  新增 API Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新增 API Key</DialogTitle>
                  <DialogDescription>
                    選擇 AI 引擎並輸入您的 API Key
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider">AI 引擎</Label>
                    <Select value={provider} onValueChange={(value: "openai" | "perplexity" | "google" | "valueserp") => setProvider(value)}>
                      <SelectTrigger id="provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
                        <SelectItem value="perplexity">Perplexity</SelectItem>
                        <SelectItem value="google">Google (Gemini)</SelectItem>
                        <SelectItem value="valueserp">ValueSERP (Google SGE)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      API Key 將使用 AES-256-GCM 加密儲存
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleAddKey} disabled={createKey.isPending}>
                    {createKey.isPending ? "新增中..." : "新增"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {!apiKeys || apiKeys.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-center space-y-4">
                <Key className="h-12 w-12 text-muted-foreground mx-auto" />
                <div className="text-muted-foreground">尚未設定任何 API Key</div>
                <p className="text-sm text-muted-foreground max-w-md">
                  請先新增至少一個 AI 引擎的 API Key 以開始使用多引擎測試功能
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {apiKeys.map((key) => (
              <Card key={key.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={getProviderBadgeColor(key.provider)}>
                        {getProviderName(key.provider)}
                      </Badge>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {key.maskedKey}
                      </code>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteKey(key.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>
                    建立於 {new Date(key.createdAt).toLocaleString("zh-TW")}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
