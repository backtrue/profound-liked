import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { APP_TITLE, getLoginUrl } from "@/const";
import { TrendingUp, Search, Target, Zap, ArrowRight, BarChart3, MessageSquare } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">{APP_TITLE}</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-muted-foreground">歡迎，{user?.name}</span>
                <Link href="/settings/api-keys">
                  <Button variant="outline">API 設定</Button>
                </Link>
                <Link href="/settings/sarcasm-corpus">
                  <Button variant="outline">反串語料庫</Button>
                </Link>
                <Link href="/projects">
                  <Button>進入控制台</Button>
                </Link>
              </>
            ) : (
              <a href={getLoginUrl()}>
                <Button>登入</Button>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-background to-muted/20">
        <div className="container max-w-6xl">
          <div className="text-center space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              在 AI 搜尋時代
              <br />
              掌握品牌能見度
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              專注於台灣與日本市場的 GEO (Generative Engine Optimization) 分析平台。
              追蹤您的品牌在 ChatGPT、Perplexity、Gemini 等 AI 引擎中的表現。
            </p>
            <div className="flex items-center justify-center gap-4">
              {isAuthenticated ? (
                <Link href="/projects">
                  <Button size="lg" className="text-lg">
                    開始使用
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <a href={getLoginUrl()}>
                  <Button size="lg" className="text-lg">
                    立即開始
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-4">核心功能</h2>
            <p className="text-muted-foreground">
              三大模組，全方位掌握品牌在 AI 時代的競爭力
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="mb-4 inline-flex p-3 rounded-lg bg-primary/10">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>智能提問生成</CardTitle>
                <CardDescription>
                  自動生成 20-50 組測試問句，涵蓋不同購買階段與消費者疑慮
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Template-based 問句（50%）</li>
                  <li>• AI-Creative 問句（50%）</li>
                  <li>• 支援台灣與日本市場語境</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-4 inline-flex p-3 rounded-lg bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>全維度指標儀表板</CardTitle>
                <CardDescription>
                  追蹤 AI 聲量、情感分析、引用來源等關鍵指標
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• AI 聲量佔有率計算</li>
                  <li>• 情感極性與反串檢測</li>
                  <li>• 引用來源分類分析</li>
                  <li>• 推薦排名追蹤</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-4 inline-flex p-3 rounded-lg bg-primary/10">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>戰略行動建議</CardTitle>
                <CardDescription>
                  基於 SERP 邏輯，提供具體可執行的優化建議
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 內容缺口偵測</li>
                  <li>• 第三方合作建議</li>
                  <li>• 技術 SEO 優化</li>
                  <li>• 信任訊號提升計畫</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Why Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-4">為什麼選擇我們？</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Zap className="h-5 w-5" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">在地化深度分析</h3>
                <p className="text-sm text-muted-foreground">
                  專門針對台灣 PTT、Dcard 與日本 2ch、5ch 的語境進行反串與酸文檢測，避免誤判。
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Target className="h-5 w-5" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">可執行的行動建議</h3>
                <p className="text-sm text-muted-foreground">
                  不只提供數據，更根據 SERP 邏輯給出具體的優化步驟與策略建議。
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">全方位指標追蹤</h3>
                <p className="text-sm text-muted-foreground">
                  從聲量、情感、引用來源到推薦排名，一站式掌握品牌在 AI 引擎中的完整表現。
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Search className="h-5 w-5" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">智能問句生成</h3>
                <p className="text-sm text-muted-foreground">
                  結合模板與 AI 創意，自動生成符合真實消費者行為的測試問句。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container max-w-4xl">
          <Card className="border-2">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-6">
              <h2 className="text-3xl font-bold tracking-tight">
                準備好掌握 AI 時代的品牌能見度了嗎？
              </h2>
              <p className="text-muted-foreground max-w-2xl">
                立即開始使用 Omni-Market GEO Agent，追蹤並優化您的品牌在 AI 搜尋引擎中的表現。
              </p>
              {isAuthenticated ? (
                <Link href="/projects">
                  <Button size="lg" className="text-lg">
                    前往控制台
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <a href={getLoginUrl()}>
                  <Button size="lg" className="text-lg">
                    免費開始使用
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </a>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4 mt-auto">
        <div className="container text-center text-sm text-muted-foreground">
          <p>&copy; 2025 {APP_TITLE}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
