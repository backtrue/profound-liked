# Cloudflare 部署指南

本指南將協助您將應用部署到 Cloudflare 平台。

## 前置準備

### 1. 安裝 Cloudflare CLI (Wrangler)

```bash
pnpm install
```

### 2. 登入 Cloudflare

```bash
pnpm wrangler login
```

這會開啟瀏覽器讓您登入 Cloudflare 帳號。

## 資料庫設置 (PlanetScale)

### 1. 創建 PlanetScale 資料庫

1. 前往 [PlanetScale](https://planetscale.com/) 註冊帳號
2. 創建新資料庫（例如：`omni-market-db`）
3. 選擇區域（建議選擇離您用戶最近的區域）

### 2. 獲取連接字串

1. 在 PlanetScale 控制台，點擊 "Connect"
2. 選擇 "Prisma" 或 "General" 選項
3. 複製連接字串，格式如下：
   ```
   mysql://username:password@host/database?sslaccept=strict
   ```

### 3. 推送 Schema 到 PlanetScale

```bash
# 設置 DATABASE_URL 環境變數
export DATABASE_URL="your-planetscale-connection-string"

# 推送 schema
pnpm db:push
```

## Google OAuth 設置

### 1. 創建 Google OAuth 應用

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 創建新專案或選擇現有專案
3. 啟用 "Google+ API"
4. 前往 "憑證" > "建立憑證" > "OAuth 2.0 用戶端 ID"
5. 應用程式類型選擇 "網頁應用程式"
6. 設置授權重新導向 URI：
   - 開發環境：`http://localhost:8787/api/oauth/callback`
   - 生產環境：`https://your-worker.workers.dev/api/oauth/callback`
   - 或您的自訂域名：`https://yourdomain.com/api/oauth/callback`

### 2. 記錄憑證

記下以下資訊：
- Client ID
- Client Secret

## Cloudflare Workers 配置

### 1. 設置 Secrets

使用 `wrangler secret put` 命令設置敏感資訊：

```bash
# JWT 密鑰（用於 session token）
pnpm wrangler secret put JWT_SECRET
# 輸入一個隨機字串，例如：openssl rand -base64 32

# 資料庫連接字串
pnpm wrangler secret put DATABASE_URL
# 輸入您的 PlanetScale 連接字串

# Google OAuth 憑證
pnpm wrangler secret put GOOGLE_CLIENT_ID
# 輸入您的 Google Client ID

pnpm wrangler secret put GOOGLE_CLIENT_SECRET
# 輸入您的 Google Client Secret

# OAuth 伺服器 URL（您的 Worker URL）
pnpm wrangler secret put OAUTH_SERVER_URL
# 例如：https://your-worker.workers.dev

# 應用 ID
pnpm wrangler secret put VITE_APP_ID
# 輸入您的應用 ID

# 擁有者 OpenID（管理員帳號）
pnpm wrangler secret put OWNER_OPEN_ID
# 例如：google:123456789

# API Key 加密密鑰
pnpm wrangler secret put ENCRYPTION_KEY
# 輸入一個隨機字串，例如：openssl rand -base64 32

# （可選）Forge API 憑證
pnpm wrangler secret put BUILT_IN_FORGE_API_URL
pnpm wrangler secret put BUILT_IN_FORGE_API_KEY
```

### 2. 更新 wrangler.toml

編輯 `wrangler.toml`，確認以下設置：

```toml
name = "omni-market-geo-agent-worker"
main = "worker/index.ts"
compatibility_date = "2024-11-01"

[[durable_objects.bindings]]
name = "SESSION_PROGRESS"
class_name = "SessionProgress"
script_name = "omni-market-geo-agent-worker"

[vars]
NODE_ENV = "production"
```

### 3. 創建 Durable Object

首次部署時，需要創建 Durable Object：

```bash
pnpm wrangler deployments create
```

## 部署

### 1. 構建 Worker

```bash
pnpm build:worker
```

### 2. 部署 Worker

```bash
pnpm deploy:worker
```

部署成功後，您會看到 Worker URL，例如：
```
https://omni-market-geo-agent-worker.your-account.workers.dev
```

### 3. 構建前端

```bash
pnpm run build
```

這會在 `dist/public` 目錄生成靜態文件。

### 4. 部署到 Cloudflare Pages

#### 方法 A：使用 Git 整合（推薦）

1. 將代碼推送到 GitHub/GitLab
2. 前往 [Cloudflare Dashboard](https://dash.cloudflare.com/) > Pages
3. 點擊 "Create a project" > "Connect to Git"
4. 選擇您的倉庫
5. 設置構建配置：
   - **Build command**: `pnpm run build`
   - **Build output directory**: `dist/public`
6. 設置環境變數：
   - `VITE_APP_ID`: 您的應用 ID
   - `VITE_API_URL`: 您的 Worker URL

#### 方法 B：使用 CLI 部署

```bash
pnpm deploy:pages
```

## 驗證部署

### 1. 測試 Worker API

```bash
curl https://your-worker.workers.dev/health
```

應該返回：
```json
{"status":"ok","timestamp":"2025-01-20T..."}
```

### 2. 測試前端

訪問您的 Pages URL（例如：`https://your-project.pages.dev`）

### 3. 測試 OAuth 登入

1. 點擊登入按鈕
2. 應該重定向到 Google 登入頁面
3. 授權後應該重定向回應用並成功登入

### 4. 測試 WebSocket 連接

1. 創建一個專案
2. 執行批次測試
3. 檢查進度更新是否即時顯示

## 監控與除錯

### 查看 Worker 日誌

```bash
pnpm wrangler tail
```

### 查看 Pages 部署日誌

前往 Cloudflare Dashboard > Pages > 您的專案 > Deployments

### 常見問題

#### 1. WebSocket 連接失敗

- 檢查 Durable Object 是否正確綁定
- 確認 WebSocket URL 正確（使用 `wss://` 而非 `ws://`）

#### 2. 資料庫連接錯誤

- 確認 `DATABASE_URL` secret 已正確設置
- 檢查 PlanetScale 資料庫是否正常運行
- 確認連接字串格式正確

#### 3. OAuth 回調失敗

- 確認 Google OAuth 設置中的重定向 URI 與實際 URL 匹配
- 檢查 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET` 是否正確

#### 4. CORS 錯誤

- 檢查 `worker/index.ts` 中的 CORS 設置
- 確認 `origin` 包含您的 Pages 域名

## 自訂域名（可選）

### 為 Worker 設置自訂域名

1. 前往 Cloudflare Dashboard > Workers & Pages
2. 選擇您的 Worker
3. 點擊 "Triggers" > "Add Custom Domain"
4. 輸入域名（例如：`api.yourdomain.com`）

### 為 Pages 設置自訂域名

1. 前往 Cloudflare Dashboard > Pages
2. 選擇您的專案
3. 點擊 "Custom domains" > "Set up a custom domain"
4. 輸入域名（例如：`yourdomain.com`）

## 更新部署

### 更新 Worker

```bash
pnpm build:worker
pnpm deploy:worker
```

### 更新 Pages

如果使用 Git 整合，只需推送代碼到倉庫即可自動部署。

如果使用 CLI：
```bash
pnpm run build
pnpm deploy:pages
```

## 回滾

### Worker 回滾

```bash
pnpm wrangler rollback
```

### Pages 回滾

前往 Cloudflare Dashboard > Pages > 您的專案 > Deployments，選擇之前的部署並點擊 "Rollback"。

## 成本估算

- **Cloudflare Workers**: 免費方案每天 100,000 次請求
- **Cloudflare Pages**: 免費方案每月 500 次構建
- **Durable Objects**: 免費方案每月 1,000,000 次請求
- **PlanetScale**: 免費方案 5GB 存儲，10 億行讀取

對於大多數應用，免費方案應該足夠。如需更高配額，請參考 [Cloudflare 定價](https://www.cloudflare.com/plans/)。
