import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function Projects() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [targetMarket, setTargetMarket] = useState<"TW" | "JP">("TW");
  const [competitors, setCompetitors] = useState("");

  const { data: projects, isLoading, refetch } = trpc.project.list.useQuery();
  const createProject = trpc.project.create.useMutation({
    onSuccess: () => {
      toast.success("專案建立成功！");
      setIsCreateDialogOpen(false);
      setProjectName("");
      setBrandName("");
      setCompetitors("");
      refetch();
    },
    onError: (error) => {
      toast.error(`建立失敗：${error.message}`);
    },
  });

  const deleteProject = trpc.project.delete.useMutation({
    onSuccess: () => {
      toast.success("專案已刪除");
      refetch();
    },
    onError: (error) => {
      toast.error(`刪除失敗：${error.message}`);
    },
  });

  const handleCreateProject = () => {
    if (!projectName.trim() || !brandName.trim()) {
      toast.error("請填寫專案名稱和品牌名稱");
      return;
    }

    createProject.mutate({
      projectName: projectName.trim(),
      brandName: brandName.trim(),
      targetMarket,
      competitors: competitors.split(",").map(c => c.trim()).filter(Boolean),
    });
  };

  const handleDeleteProject = (projectId: number) => {
    if (confirm("確定要刪除此專案嗎？此操作無法復原。")) {
      deleteProject.mutate({ projectId });
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">載入中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">我的專案</h1>
          <p className="text-muted-foreground mt-2">
            管理您的 GEO 分析專案，追蹤品牌在 AI 搜尋引擎中的表現
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              建立專案
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>建立新專案</DialogTitle>
              <DialogDescription>
                設定您的 GEO 分析專案基本資訊
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="projectName">專案名稱</Label>
                <Input
                  id="projectName"
                  placeholder="例如：2025 Q1 洗面乳市場分析"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brandName">品牌名稱</Label>
                <Input
                  id="brandName"
                  placeholder="您的品牌名稱"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetMarket">目標市場</Label>
                <Select value={targetMarket} onValueChange={(value: "TW" | "JP") => setTargetMarket(value)}>
                  <SelectTrigger id="targetMarket">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TW">台灣 (TW)</SelectItem>
                    <SelectItem value="JP">日本 (JP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="competitors">競爭對手（選填）</Label>
                <Input
                  id="competitors"
                  placeholder="以逗號分隔，例如：品牌A, 品牌B"
                  value={competitors}
                  onChange={(e) => setCompetitors(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreateProject} disabled={createProject.isPending}>
                {createProject.isPending ? "建立中..." : "建立"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!projects || projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-center space-y-4">
              <div className="text-muted-foreground">尚無專案</div>
              <p className="text-sm text-muted-foreground max-w-md">
                建立您的第一個專案，開始追蹤品牌在 AI 搜尋引擎中的表現
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                建立第一個專案
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{project.projectName}</CardTitle>
                    <CardDescription className="mt-1">
                      {project.brandName} · {project.targetMarket === "TW" ? "台灣" : "日本"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteProject(project.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {project.competitors && Array.isArray(project.competitors) && project.competitors.length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">競爭對手：</span>
                      <span className="ml-1">{project.competitors.join(", ")}</span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    建立於 {new Date(project.createdAt).toLocaleDateString("zh-TW")}
                  </div>
                  <Link href={`/project/${project.id}`}>
                    <Button className="w-full" variant="outline">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      查看專案
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
