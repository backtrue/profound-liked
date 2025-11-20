# Cloudflare 部署準備清單

本文檔提供逐步指導，幫助您完成部署前的所有準備工作。

## 📋 部署前檢查清單

### ✅ 已完成
- [x] Workers 專案結構
- [x] Durable Objects 配置
- [x] tRPC 路由
- [x] 前端 WebSocket 客戶端
- [x] 加密功能
- [x] LLM 和 AI 引擎整合

### 🔲 需要完成
- [ ] 創建 PlanetScale 資料庫
- [ ] 設置 Google OAuth 應用
- [ ] 配置 Cloudflare Secrets
- [ ] 本地測試 Worker
- [ ] 部署到 Cloudflare
- [ ] 驗證功能

---

## 步驟 1: 創建 PlanetScale 資料庫

### 1.1 註冊 PlanetScale 帳號

1. 前往 [https://planetscale.com/](https://planetscale.com/)
2. 點擊 "Sign up" 註冊帳號（可使用 GitHub 登入）
3. 驗證電子郵件

### 1.2 創建新資料庫

1. 登入後，點擊 "Create database"
2. 填寫資料庫資訊：
   - **Name**: `omni-market-db`（或您喜歡的名稱）
   - **Region**: 選擇離您用戶最近的區域
     - 台灣用戶建議：`AWS ap-northeast-1 (Tokyo)`
     - 或 `AWS ap-southeast-1 (Singapore)`
3. 點擊 "Create database"

### 1.3 獲取連接字串

1. 在資料庫頁面，點擊 "Connect"
2. 選擇 "Prisma" 或 "General"
3. 複製連接字串，格式如下：
   ```
   mysql://username:password@aws.connect.psdb.cloud/database-name?sslaccept=strict
   ```
4. **保存此連接字串**，稍後會用到

### 1.4 推送 Database Schema

在本地執行：

```bash
# 設置環境變數
export DATABASE_URL="your-planetscale-connection-string"

# 推送 schema
pnpm db:push
```

**預期輸出**：
```
✓ Schema pushed successfully
```

如果成功，您應該在 PlanetScale 控制台看到所有的表格。

---

## 步驟 2: 設置 Google OAuth 應用

### 2.1 前往 Google Cloud Console

1. 訪問 [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. 登入您的 Google 帳號

### 2.2 創建新專案（或選擇現有專案）

1. 點擊頂部的專案選擇器
2. 點擊 "NEW PROJECT"
3. 輸入專案名稱：`Omni Market Geo Agent`
4. 點擊 "CREATE"

### 2.3 啟用 Google+ API

1. 在左側選單，選擇 "APIs & Services" > "Library"
2. 搜索 "Google+ API"
3. 點擊並啟用

### 2.4 創建 OAuth 2.0 憑證

1. 前往 "APIs & Services" > "Credentials"
2. 點擊 "CREATE CREDENTIALS" > "OAuth client ID"
3. 如果提示配置同意畫面，點擊 "CONFIGURE CONSENT SCREEN"：
   - User Type: **External**
   - App name: `Omni Market Geo Agent`
   - User support email: 您的電子郵件
   - Developer contact: 您的電子郵件
   - 點擊 "SAVE AND CONTINUE"
   - Scopes: 保持預設，點擊 "SAVE AND CONTINUE"
   - Test users: 可選，點擊 "SAVE AND CONTINUE"
4. 返回 "Credentials"，再次點擊 "CREATE CREDENTIALS" > "OAuth client ID"
5. 選擇應用程式類型：**Web application**
6. 名稱：`Omni Market Web Client`
7. **授權重新導向 URI**：
   - 開發環境：`http://localhost:8787/api/oauth/callback`
   - 生產環境：`https://your-worker-name.your-account.workers.dev/api/oauth/callback`
   - 如果有自訂域名：`https://api.yourdomain.com/api/oauth/callback`
8. 點擊 "CREATE"

### 2.5 保存憑證

創建完成後，會顯示：
- **Client ID**: `xxxxx.apps.googleusercontent.com`
- **Client Secret**: `xxxxx`

**請妥善保存這兩個值**，稍後配置時會用到。

---

## 步驟 3: 配置 Cloudflare Secrets

### 3.1 登入 Cloudflare

```bash
pnpm wrangler login
```

這會開啟瀏覽器讓您登入 Cloudflare 帳號。

### 3.2 設置所有必要的 Secrets

執行以下命令，逐一設置 secrets：

#### 必要的 Secrets

```bash
# 1. JWT Secret（用於 session token）
pnpm wrangler secret put JWT_SECRET
# 輸入一個隨機字串，例如：openssl rand -base64 32

# 2. 資料庫連接字串（從步驟 1.3 獲取）
pnpm wrangler secret put DATABASE_URL
# 輸入您的 PlanetScale 連接字串

# 3. Google OAuth Client ID（從步驟 2.5 獲取）
pnpm wrangler secret put GOOGLE_CLIENT_ID
# 輸入您的 Google Client ID

# 4. Google OAuth Client Secret（從步驟 2.5 獲取）
pnpm wrangler secret put GOOGLE_CLIENT_SECRET
# 輸入您的 Google Client Secret

# 5. OAuth 伺服器 URL（您的 Worker URL）
pnpm wrangler secret put OAUTH_SERVER_URL
# 開發：http://localhost:8787
# 生產：https://your-worker-name.your-account.workers.dev

# 6. 應用 ID
pnpm wrangler secret put VITE_APP_ID
# 輸入您的應用 ID（任意字串，例如：omni-market-prod）

# 7. 擁有者 OpenID（管理員帳號）
pnpm wrangler secret put OWNER_OPEN_ID
# 格式：google:your-google-user-id
# 您可以先設置為 google:temp，登入後從資料庫查詢實際的 openId

# 8. 加密密鑰（用於 API Keys）
pnpm wrangler secret put ENCRYPTION_KEY
# 輸入一個隨機字串，例如：openssl rand -base64 32
```

#### 可選的 Secrets（如果使用 Forge API）

```bash
# Forge API URL
pnpm wrangler secret put BUILT_IN_FORGE_API_URL
# 例如：https://forge.manus.im

# Forge API Key
pnpm wrangler secret put BUILT_IN_FORGE_API_KEY
# 輸入您的 Forge API Key
```

### 3.3 驗證 Secrets

```bash
pnpm wrangler secret list
```

應該看到所有已設置的 secrets（值會被隱藏）。

---

## 步驟 4: 更新 wrangler.toml

確保 `wrangler.toml` 中的配置正確：

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

---

## 步驟 5: 本地測試

### 5.1 啟動 Worker 開發伺服器

```bash
pnpm dev:worker
```

**預期輸出**：
```
⛅️ wrangler 3.x.x
------------------
Your worker has access to the following bindings:
- Durable Objects:
  - SESSION_PROGRESS: SessionProgress
- Vars:
  - NODE_ENV: "production"
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

### 5.2 測試健康檢查

在另一個終端：

```bash
curl http://localhost:8787/health
```

**預期輸出**：
```json
{"status":"ok","timestamp":"2025-01-20T..."}
```

### 5.3 測試 tRPC 端點

```bash
curl http://localhost:8787/api/trpc/system.health
```

### 5.4 測試 OAuth 流程

1. 在瀏覽器訪問：`http://localhost:8787`
2. 點擊登入按鈕
3. 應該重定向到 Google 登入頁面
4. 登入後應該重定向回應用

---

## 步驟 6: 部署到 Cloudflare

### 6.1 構建 Worker

```bash
pnpm build:worker
```

**預期輸出**：
```
✓ Built worker/index.ts successfully
```

### 6.2 部署 Worker

```bash
pnpm deploy:worker
```

**預期輸出**：
```
⛅️ wrangler 3.x.x
------------------
Uploaded omni-market-geo-agent-worker (x.xx sec)
Published omni-market-geo-agent-worker (x.xx sec)
  https://omni-market-geo-agent-worker.your-account.workers.dev
```

**保存這個 URL**，這是您的 Worker 端點。

### 6.3 更新 Google OAuth 回調 URL

1. 返回 Google Cloud Console
2. 前往 "Credentials"
3. 編輯您的 OAuth 2.0 Client ID
4. 在 "Authorized redirect URIs" 添加：
   ```
   https://omni-market-geo-agent-worker.your-account.workers.dev/api/oauth/callback
   ```
5. 保存

### 6.4 更新 OAUTH_SERVER_URL Secret

```bash
pnpm wrangler secret put OAUTH_SERVER_URL
# 輸入：https://omni-market-geo-agent-worker.your-account.workers.dev
```

### 6.5 構建並部署前端

```bash
# 構建前端
pnpm run build

# 部署到 Cloudflare Pages
pnpm deploy:pages
```

或者使用 Git 整合（推薦）：

1. 將代碼推送到 GitHub
2. 前往 [Cloudflare Dashboard](https://dash.cloudflare.com/) > Pages
3. 點擊 "Create a project" > "Connect to Git"
4. 選擇您的倉庫
5. 設置構建配置：
   - **Build command**: `pnpm run build`
   - **Build output directory**: `dist/public`
6. 設置環境變數：
   - `VITE_APP_ID`: 您的應用 ID
   - `VITE_API_URL`: 您的 Worker URL

---

## 步驟 7: 驗證部署

### 7.1 測試 Worker API

```bash
curl https://your-worker-url.workers.dev/health
```

### 7.2 測試前端

訪問您的 Pages URL（例如：`https://your-project.pages.dev`）

### 7.3 測試完整流程

1. 訪問前端
2. 登入（Google OAuth）
3. 創建專案
4. 添加種子關鍵字
5. 生成查詢
6. 配置 API Keys
7. 執行批次測試
8. 查看結果

---

## 🐛 常見問題排查

### 問題 1: Worker 部署失敗

**錯誤**: `Error: Could not resolve "xxx"`

**解決方案**: 檢查 `package.json` 中的依賴是否都已安裝：
```bash
pnpm install
```

### 問題 2: 資料庫連接失敗

**錯誤**: `Error: Failed to connect to database`

**解決方案**:
1. 檢查 `DATABASE_URL` secret 是否正確設置
2. 確認 PlanetScale 資料庫正在運行
3. 檢查連接字串格式

### 問題 3: OAuth 回調失敗

**錯誤**: `redirect_uri_mismatch`

**解決方案**:
1. 確認 Google OAuth 設置中的回調 URL 與實際 URL 完全匹配
2. 檢查 `OAUTH_SERVER_URL` secret 是否正確

### 問題 4: Durable Objects 錯誤

**錯誤**: `Error: Durable Object namespace not found`

**解決方案**:
1. 確認 `wrangler.toml` 中的 Durable Objects 配置正確
2. 重新部署 Worker

---

## 📊 部署檢查表

完成以下所有項目後，您的應用應該可以正常運行：

- [ ] PlanetScale 資料庫已創建
- [ ] Database schema 已推送
- [ ] Google OAuth 應用已設置
- [ ] 所有 Cloudflare secrets 已配置
- [ ] Worker 本地測試通過
- [ ] Worker 已部署到 Cloudflare
- [ ] Google OAuth 回調 URL 已更新
- [ ] 前端已部署到 Pages
- [ ] 完整流程測試通過

---

## 🎉 下一步

部署完成後，您可以：

1. **監控應用**
   ```bash
   pnpm wrangler tail
   ```

2. **查看日誌**
   - Cloudflare Dashboard > Workers > 您的 Worker > Logs

3. **設置自訂域名**（可選）
   - Workers: Cloudflare Dashboard > Workers > Triggers > Custom Domains
   - Pages: Cloudflare Dashboard > Pages > Custom domains

4. **優化效能**
   - 啟用 Cloudflare Analytics
   - 監控 Durable Objects 使用情況
   - 優化資料庫查詢

---

## 📞 需要幫助？

如果遇到問題，請檢查：
- [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
- [PlanetScale 文檔](https://planetscale.com/docs)
- [部署指南](file:///Users/backtrue/Documents/profound-liked/CLOUDFLARE_DEPLOYMENT.md)
