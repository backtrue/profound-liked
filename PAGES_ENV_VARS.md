# Cloudflare Pages 環境變數配置

## 生產環境變數

請在 Cloudflare Dashboard 設置以下環境變數：

### 必要變數

1. **VITE_API_URL**
   ```
   https://omni-market-geo-agent-worker.backtrue.workers.dev
   ```

2. **VITE_APP_ID**
   ```
   omni-market-prod
   ```

## 設置步驟

1. 前往 https://dash.cloudflare.com/
2. Workers & Pages > omni-market-app
3. Settings > Environment variables
4. 添加上述變數
5. Deployments > Retry deployment

## 驗證

設置完成後，訪問：
https://omni-market-app.pages.dev/

應該可以正常載入。
