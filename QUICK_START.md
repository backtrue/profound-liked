# 快速開始部署指南

這是一個快速參考指南，幫助您在 30 分鐘內完成部署。

## 🚀 快速步驟

### 1. PlanetScale (5 分鐘)

```bash
# 1. 訪問 https://planetscale.com/ 並註冊
# 2. 創建資料庫：omni-market-db
# 3. 選擇區域：Tokyo 或 Singapore
# 4. 獲取連接字串並保存
# 5. 推送 schema
export DATABASE_URL="your-connection-string"
pnpm db:push
```

### 2. Google OAuth (5 分鐘)

```bash
# 1. 訪問 https://console.cloud.google.com/
# 2. 創建專案：Omni Market Geo Agent
# 3. 啟用 Google+ API
# 4. 創建 OAuth 2.0 憑證
# 5. 添加回調 URL：
#    - http://localhost:8787/api/oauth/callback (開發)
#    - https://your-worker.workers.dev/api/oauth/callback (生產)
# 6. 保存 Client ID 和 Client Secret
```

### 3. 生成密鑰 (2 分鐘)

```bash
# 生成 JWT Secret
openssl rand -base64 32

# 生成 Encryption Key
openssl rand -base64 32

# 保存這兩個值
```

### 4. 配置 Cloudflare Secrets (5 分鐘)

```bash
# 登入 Cloudflare
pnpm wrangler login

# 設置 secrets（按提示輸入）
pnpm wrangler secret put JWT_SECRET
pnpm wrangler secret put DATABASE_URL
pnpm wrangler secret put GOOGLE_CLIENT_ID
pnpm wrangler secret put GOOGLE_CLIENT_SECRET
pnpm wrangler secret put OAUTH_SERVER_URL  # 先設為 http://localhost:8787
pnpm wrangler secret put VITE_APP_ID  # 例如：omni-market-prod
pnpm wrangler secret put OWNER_OPEN_ID  # 先設為 google:temp
pnpm wrangler secret put ENCRYPTION_KEY
```

### 5. 本地測試 (5 分鐘)

```bash
# 啟動 Worker
pnpm dev:worker

# 在另一個終端測試
curl http://localhost:8787/health
# 應返回：{"status":"ok","timestamp":"..."}

# 在瀏覽器測試 OAuth
# 訪問 http://localhost:8787 並嘗試登入
```

### 6. 部署 Worker (3 分鐘)

```bash
# 構建
pnpm build:worker

# 部署
pnpm deploy:worker

# 記下 Worker URL，例如：
# https://omni-market-geo-agent-worker.your-account.workers.dev
```

### 7. 更新配置 (3 分鐘)

```bash
# 更新 OAUTH_SERVER_URL
pnpm wrangler secret put OAUTH_SERVER_URL
# 輸入您的 Worker URL

# 更新 Google OAuth 回調 URL
# 前往 Google Cloud Console > Credentials
# 添加：https://your-worker.workers.dev/api/oauth/callback
```

### 8. 部署前端 (2 分鐘)

**選項 A: 使用 Git（推薦）**
```bash
# 1. 推送代碼到 GitHub
git push origin main

# 2. 前往 Cloudflare Dashboard > Pages
# 3. Connect to Git > 選擇倉庫
# 4. 構建設置：
#    - Build command: pnpm run build
#    - Build output: dist/public
# 5. 環境變數：
#    - VITE_APP_ID: omni-market-prod
#    - VITE_API_URL: https://your-worker.workers.dev
```

**選項 B: 使用 CLI**
```bash
pnpm run build
pnpm deploy:pages
```

---

## ✅ 驗證部署

### 測試 Worker
```bash
curl https://your-worker.workers.dev/health
```

### 測試前端
訪問您的 Pages URL 並測試：
1. 登入（Google OAuth）
2. 創建專案
3. 添加關鍵字

---

## 🐛 快速故障排除

### Worker 無法啟動
```bash
# 檢查依賴
pnpm install

# 檢查 secrets
pnpm wrangler secret list
```

### OAuth 失敗
- 檢查回調 URL 是否完全匹配
- 檢查 OAUTH_SERVER_URL secret

### 資料庫連接失敗
- 檢查 DATABASE_URL 格式
- 確認 PlanetScale 資料庫正在運行

---

## 📋 完成檢查表

- [ ] PlanetScale 資料庫已創建並推送 schema
- [ ] Google OAuth 已設置
- [ ] 所有 secrets 已配置
- [ ] 本地測試通過
- [ ] Worker 已部署
- [ ] OAuth 回調 URL 已更新
- [ ] 前端已部署
- [ ] 可以成功登入

---

## 🎉 完成！

您的應用現在應該已經在 Cloudflare 上運行了！

**下一步**：
- 查看 [DEPLOYMENT_CHECKLIST.md](file:///Users/backtrue/Documents/profound-liked/DEPLOYMENT_CHECKLIST.md) 了解詳細說明
- 查看 [ENV_TEMPLATE.md](file:///Users/backtrue/Documents/profound-liked/ENV_TEMPLATE.md) 了解環境變數詳情
- 監控應用：`pnpm wrangler tail`
