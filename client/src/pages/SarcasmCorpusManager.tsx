import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, BookOpen, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function SarcasmCorpusManager() {
  const [selectedMarket, setSelectedMarket] = useState<"taiwan" | "japan">("taiwan");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  const [newEntry, setNewEntry] = useState({
    market: "taiwan" as "taiwan" | "japan",
    platform: "",
    text: "",
    explanation: "",
    category: "sarcasm" as "irony" | "sarcasm" | "understatement" | "exaggeration" | "other",
  });

  const { data: allCorpus, refetch } = trpc.analysis.sarcasmCorpus.list.useQuery();
  const createMutation = trpc.analysis.sarcasmCorpus.create.useMutation({
    onSuccess: () => {
      toast.success("反串範例已新增！");
      refetch();
      setIsAddDialogOpen(false);
      setNewEntry({
        market: "taiwan",
        platform: "",
        text: "",
        explanation: "",
        category: "sarcasm",
      });
    },
    onError: (error) => {
      toast.error(`新增失敗：${error.message}`);
    },
  });

  const deleteMutation = trpc.analysis.sarcasmCorpus.delete.useMutation({
    onSuccess: () => {
      toast.success("反串範例已刪除！");
      refetch();
    },
    onError: (error) => {
      toast.error(`刪除失敗：${error.message}`);
    },
  });

  const taiwanCorpus = allCorpus?.filter(c => c.market === "taiwan") || [];
  const japanCorpus = allCorpus?.filter(c => c.market === "japan") || [];

  const handleAdd = () => {
    if (!newEntry.platform || !newEntry.text) {
      toast.error("請填寫必填欄位");
      return;
    }
    createMutation.mutate(newEntry);
  };

  const handleDelete = (id: number) => {
    if (confirm("確定要刪除這個反串範例嗎？")) {
      deleteMutation.mutate({ id });
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors = {
      irony: "bg-purple-500",
      sarcasm: "bg-red-500",
      understatement: "bg-blue-500",
      exaggeration: "bg-orange-500",
      other: "bg-gray-500",
    };
    const labels = {
      irony: "反諷",
      sarcasm: "諷刺",
      understatement: "輕描淡寫",
      exaggeration: "誇張",
      other: "其他",
    };
    return (
      <Badge className={colors[category as keyof typeof colors]}>
        {labels[category as keyof typeof labels]}
      </Badge>
    );
  };

  const renderCorpusList = (corpus: any[]) => (
    <div className="space-y-4">
      {corpus.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>尚無反串範例</p>
        </div>
      ) : (
        corpus.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {getCategoryBadge(item.category)}
                    <Badge variant="outline">{item.platform}</Badge>
                  </div>
                  <CardTitle className="text-lg">{item.text}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            {item.explanation && (
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.explanation}</p>
              </CardContent>
            )}
          </Card>
        ))
      )}
    </div>
  );

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
              <MessageSquare className="h-8 w-8" />
              反串語料庫管理
            </h1>
            <p className="text-muted-foreground mt-2">
              管理台日市場專屬的反串用語範例，提升 Sarcasm Detection 準確度
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                新增範例
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>新增反串範例</DialogTitle>
                <DialogDescription>
                  添加新的反串用語範例到語料庫
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>市場 *</Label>
                    <Select
                      value={newEntry.market}
                      onValueChange={(value: "taiwan" | "japan") =>
                        setNewEntry({ ...newEntry, market: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="taiwan">台灣</SelectItem>
                        <SelectItem value="japan">日本</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>平台 *</Label>
                    <Input
                      placeholder="例如：PTT, Dcard, 2ch, 5ch"
                      value={newEntry.platform}
                      onChange={(e) =>
                        setNewEntry({ ...newEntry, platform: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>反串文字 *</Label>
                  <Textarea
                    placeholder="例如：超棒der，根本神作"
                    value={newEntry.text}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, text: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div>
                  <Label>解釋</Label>
                  <Textarea
                    placeholder="解釋為什麼這是反串用語"
                    value={newEntry.explanation}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, explanation: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div>
                  <Label>類型 *</Label>
                  <Select
                    value={newEntry.category}
                    onValueChange={(value: any) =>
                      setNewEntry({ ...newEntry, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="irony">反諷</SelectItem>
                      <SelectItem value="sarcasm">諷刺</SelectItem>
                      <SelectItem value="understatement">輕描淡寫</SelectItem>
                      <SelectItem value="exaggeration">誇張</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button onClick={handleAdd}>新增</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>語料庫統計</CardTitle>
            <CardDescription>
              台灣：{taiwanCorpus.length} 筆 | 日本：{japanCorpus.length} 筆 | 總計：{allCorpus?.length || 0} 筆
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs value={selectedMarket} onValueChange={(v: any) => setSelectedMarket(v)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="taiwan">台灣市場</TabsTrigger>
            <TabsTrigger value="japan">日本市場</TabsTrigger>
          </TabsList>
          <TabsContent value="taiwan" className="mt-6">
            {renderCorpusList(taiwanCorpus)}
          </TabsContent>
          <TabsContent value="japan" className="mt-6">
            {renderCorpusList(japanCorpus)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
