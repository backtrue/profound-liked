# Cloudflare 遷移待辦事項

## ✅ 已完成

### 基礎架構
- [x] 創建 Worker 專案結構
- [x] 配置 wrangler.toml
- [x] 設置 Hono 框架
- [x] 創建 Durable Object (SessionProgress)
- [x] 配置 PlanetScale 資料庫連接
- [x] 實現 Google OAuth 處理
- [x] 遷移 tRPC 路由結構
- [x] 更新前端 WebSocket 客戶端
- [x] 添加 Workers 依賴到 package.json
- [x] 創建部署文檔

## 🚧 需要完成的工作

### 1. 資料庫函數遷移

以下函數在 `worker/db-functions.ts` 中標記為 TODO，需要完整實現：

- [ ] `startBatchTest` - 批次測試執行邏輯
- [ ] `getSessionMetrics` - 會話指標計算
- [ ] `generateAnalysisReport` - 分析報告生成
- [ ] `testApiKey` - API Key 測試
- [ ] API Key 加密/解密功能

這些函數需要從 `server/db.ts` 和相關文件遷移。

### 2. LLM 整合

需要遷移以下 LLM 相關功能：

- [ ] `server/_core/llm.ts` → `worker/llm.ts`
- [ ] `server/llmBrandAnalysis.ts` → `worker/llmBrandAnalysis.ts`
- [ ] `server/aiEngines.ts` → `worker/aiEngines.ts`
- [ ] `server/enhancedSarcasmDetection.ts` → `worker/enhancedSarcasmDetection.ts`
- [ ] `server/hallucinationDetection.ts` → `worker/hallucinationDetection.ts`

### 3. 批次測試執行器

- [ ] 遷移 `server/batchTestExecutor.ts` 到 Workers
- [ ] 更新進度廣播使用 Durable Objects
- [ ] 實現 exponential backoff 和 rate limiting

### 4. 加密功能

- [ ] 遷移 `server/encryption.ts` 到 Workers
- [ ] 使用 Web Crypto API 替代 Node.js crypto
- [ ] 實現 API Key 加密/解密

### 5. 環境變數

需要在 Cloudflare 設置以下 secrets：

```bash
wrangler secret put JWT_SECRET
wrangler secret put DATABASE_URL
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put OAUTH_SERVER_URL
wrangler secret put VITE_APP_ID
wrangler secret put OWNER_OPEN_ID
wrangler secret put ENCRYPTION_KEY
```

可選：
```bash
wrangler secret put BUILT_IN_FORGE_API_URL
wrangler secret put BUILT_IN_FORGE_API_KEY
```

### 6. 前端配置

- [ ] 更新 API 端點指向 Workers URL
- [ ] 配置 Pages 環境變數
- [ ] 測試所有前端功能

### 7. 測試

- [ ] 本地測試 Worker (`pnpm dev:worker`)
- [ ] 測試資料庫連接
- [ ] 測試 OAuth 流程
- [ ] 測試 WebSocket 連接
- [ ] 測試批次測試執行
- [ ] 端到端測試

### 8. 部署

- [ ] 創建 PlanetScale 資料庫
- [ ] 推送 schema 到 PlanetScale
- [ ] 設置 Google OAuth 應用
- [ ] 部署 Worker
- [ ] 部署 Pages
- [ ] 配置自訂域名（可選）

## 📝 注意事項

### Workers 限制

1. **CPU 時間限制**: 每個請求最多 50ms CPU 時間（付費方案 50ms）
   - 批次測試需要使用 Durable Objects 或 Queues 處理長時間任務

2. **記憶體限制**: 128MB
   - 需要優化大型資料處理

3. **請求大小**: 最大 100MB
   - 目前設置為 50MB，應該足夠

### Durable Objects 注意事項

1. **狀態持久化**: Durable Objects 的狀態會自動持久化
2. **單一實例**: 每個 DO ID 只有一個實例在運行
3. **WebSocket 連接**: 每個 DO 可以處理多個 WebSocket 連接

### PlanetScale 注意事項

1. **連接池**: PlanetScale HTTP driver 會自動處理連接池
2. **查詢限制**: 免費方案有查詢限制，注意優化查詢
3. **Schema 變更**: 使用 `drizzle-kit push` 推送 schema 變更

## 🔧 開發工作流

### 本地開發

```bash
# 啟動 Worker 開發伺服器
pnpm dev:worker

# 啟動前端開發伺服器（另一個終端）
pnpm dev
```

### 構建

```bash
# 構建 Worker
pnpm build:worker

# 構建前端
pnpm run build
```

### 部署

```bash
# 部署 Worker
pnpm deploy:worker

# 部署 Pages
pnpm deploy:pages
```

## 📚 參考資源

- [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
- [Durable Objects 文檔](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare Pages 文檔](https://developers.cloudflare.com/pages/)
- [PlanetScale 文檔](https://planetscale.com/docs)
- [Hono 文檔](https://hono.dev/)
- [Drizzle ORM 文檔](https://orm.drizzle.team/)
