# 環境變數範本

## Cloudflare Workers Secrets

以下是所有需要設置的 secrets 及其說明。

### 必要的 Secrets

```bash
# JWT Secret - 用於簽署 session tokens
# 生成方式：openssl rand -base64 32
JWT_SECRET=your-random-jwt-secret-here

# 資料庫連接字串 - PlanetScale
# 格式：mysql://username:password@host/database?sslaccept=strict
DATABASE_URL=mysql://xxxxx:pscale_pw_xxxxx@aws.connect.psdb.cloud/omni-market-db?sslaccept=strict

# Google OAuth Client ID
# 從 Google Cloud Console 獲取
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com

# Google OAuth Client Secret
# 從 Google Cloud Console 獲取
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# OAuth 伺服器 URL - 您的 Worker URL
# 開發：http://localhost:8787
# 生產：https://your-worker-name.your-account.workers.dev
OAUTH_SERVER_URL=https://omni-market-geo-agent-worker.your-account.workers.dev

# 應用 ID - 任意唯一標識符
VITE_APP_ID=omni-market-prod

# 擁有者 OpenID - 管理員帳號
# 格式：google:your-google-user-id
# 登入後從資料庫 users 表查詢 openId 欄位
OWNER_OPEN_ID=google:123456789

# 加密密鑰 - 用於加密 API Keys
# 生成方式：openssl rand -base64 32
ENCRYPTION_KEY=your-random-encryption-key-here
```

### 可選的 Secrets

```bash
# Forge API URL（如果使用 Forge API 進行 LLM 調用）
BUILT_IN_FORGE_API_URL=https://forge.manus.im

# Forge API Key
BUILT_IN_FORGE_API_KEY=your-forge-api-key-here
```

---

## Cloudflare Pages 環境變數

在 Pages 設置中配置以下環境變數：

```bash
# 應用 ID（與 Worker 中的相同）
VITE_APP_ID=omni-market-prod

# API URL（指向您的 Worker）
VITE_API_URL=https://omni-market-geo-agent-worker.your-account.workers.dev
```

---

## 設置命令

### 使用 Wrangler CLI 設置 Secrets

```bash
# 設置所有必要的 secrets
pnpm wrangler secret put JWT_SECRET
pnpm wrangler secret put DATABASE_URL
pnpm wrangler secret put GOOGLE_CLIENT_ID
pnpm wrangler secret put GOOGLE_CLIENT_SECRET
pnpm wrangler secret put OAUTH_SERVER_URL
pnpm wrangler secret put VITE_APP_ID
pnpm wrangler secret put OWNER_OPEN_ID
pnpm wrangler secret put ENCRYPTION_KEY

# 可選的 secrets
pnpm wrangler secret put BUILT_IN_FORGE_API_URL
pnpm wrangler secret put BUILT_IN_FORGE_API_KEY
```

### 驗證 Secrets

```bash
# 列出所有已設置的 secrets
pnpm wrangler secret list
```

---

## 生成隨機密鑰

### 使用 OpenSSL

```bash
# 生成 JWT Secret
openssl rand -base64 32

# 生成 Encryption Key
openssl rand -base64 32
```

### 使用 Node.js

```bash
# 生成隨機密鑰
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 使用線上工具

- [RandomKeygen](https://randomkeygen.com/)
- [1Password Generator](https://1password.com/password-generator/)

---

## 安全注意事項

1. **永遠不要**將 secrets 提交到 Git
2. **永遠不要**在代碼中硬編碼 secrets
3. **定期輪換** JWT Secret 和 Encryption Key
4. **使用強密碼**生成器創建隨機密鑰
5. **限制訪問**：只有必要的人員才能訪問 secrets
6. **使用不同的密鑰**用於開發和生產環境

---

## 環境變數檢查清單

部署前確認：

- [ ] JWT_SECRET 已設置（隨機 32 字節）
- [ ] DATABASE_URL 已設置（PlanetScale 連接字串）
- [ ] GOOGLE_CLIENT_ID 已設置
- [ ] GOOGLE_CLIENT_SECRET 已設置
- [ ] OAUTH_SERVER_URL 已設置（正確的 Worker URL）
- [ ] VITE_APP_ID 已設置
- [ ] OWNER_OPEN_ID 已設置（或設為臨時值）
- [ ] ENCRYPTION_KEY 已設置（隨機 32 字節）
- [ ] Pages 環境變數已配置（VITE_APP_ID, VITE_API_URL）

---

## 獲取 OWNER_OPEN_ID

1. 首次部署時，將 `OWNER_OPEN_ID` 設為臨時值：
   ```bash
   pnpm wrangler secret put OWNER_OPEN_ID
   # 輸入：google:temp
   ```

2. 部署後，使用 Google 帳號登入應用

3. 連接到 PlanetScale 資料庫，查詢您的 openId：
   ```sql
   SELECT openId FROM users WHERE email = 'your-email@gmail.com';
   ```

4. 更新 `OWNER_OPEN_ID` 為實際值：
   ```bash
   pnpm wrangler secret put OWNER_OPEN_ID
   # 輸入查詢到的 openId，例如：google:123456789
   ```
