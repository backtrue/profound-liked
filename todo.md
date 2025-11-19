# Omni-Market GEO Agent (TW/JP Edition) - TODO List

## Phase 1: 建立專案基礎架構與資料模型
- [x] 設計並實作資料庫 Schema（Project, SeedKeyword, DerivativeQuery, TargetEngine, AnalysisSession, EngineResponse, BrandMention, CitationSource, ActionItem）
- [x] 建立基礎 UI 設計系統（色彩、字型、間距）
- [x] 實作專案管理基礎功能（建立、列表、詳情）

## Phase 2: 實作智能提問與場景生成模組（Module A）
- [x] 實作種子關鍵字輸入介面
- [x] 實作 Template-based 問句生成邏輯（50%）
- [x] 實作 AI-Creative 問句生成邏輯（50%，使用 LLM）
- [x] 實作衍生問句列表展示與管理
- [x] 實作多引擎測試配置（ChatGPT, Perplexity, Gemini 等）

## Phase 3: 實作全維度指標儀表板模組（Module B）
- [x] 實作 AI 聲量佔有率計算與展示
- [x] 實作情感極性與語意分析（正評、負評、反串檢測）
- [x] 實作引用來源佔比分析與視覺化
- [x] 實作推薦排名追蹤
- [x] 實作 AI 幻覚指數偵測
- [x] 建立綜合指標儀表板介面

## Phase 4: 實作戰略行動建議引擎模組（Module C）
- [x] 實作場景 1：影片內容缺口偵測與建議
- [x] 實作場景 2：第三方評比文章缺席偵測與建議
- [x] 實作場景 3：內容結構化優化建議
- [x] 實作場景 4：信任訊號不足偵測與 90 天行動計畫
- [x] 實作行動建議優先級排序
- [x] 實作行動建議追蹤與執行狀態管理

## Phase 5: 整合測試與優化
- [x] 撰寫核心功能單元測試
- [x] 進行端對端整合測試
- [x] 效能優化與使用者體驗調整
- [x] 建立使用者文件與操作指南

## Phase 6: 部署與交付
- [x] 準備生產環境配置
- [x] 建立專案 Checkpoint
- [x] 向使用者交付完整系統

## 新增需求：BYOK 多引擎測試整合
- [x] 設計 API Key 管理資料表與加密儲存機制
- [x] 實作 API Key 設定介面（使用者可新增/編輯/刪除各引擎的 Key）
- [x] 實作 ChatGPT API 整合（使用使用者提供的 OpenAI API Key）
- [x] 實作 Perplexity API 整合（使用使用者提供的 Perplexity API Key）
- [x] 實作 Gemini API 整合（使用使用者提供的 Google API Key）
- [x] 實作引擎測試執行邏輯（批次發送問句並收集回應）
- [x] 實作回應解析與品牌提及偵測
- [x] 實作引用來源提取與分類
- [x] 撰寫多引擎整合的單元測試

## 新增需求：批次引擎測試執行器
- [x] 實作批次測試執行 tRPC 路由（接收 sessionId，批次發送問句）
- [x] 實作測試進度追蹤機制（WebSocket 或輪詢）
- [x] 實作錯誤處理與重試邏輯
- [x] 在專案詳情頁添加「執行分析」按鈕與進度顯示
- [x] 實作測試結果儲存至 engineResponses 表
- [x] 撰寫批次測試執行器的單元測試

## 新增需求：WebSocket 即時進度追蹤
- [x] 設定 Socket.IO 伺服器端整合
- [x] 實作進度事件發送機制（連接批次測試執行器）
- [x] 建立前端 Socket.IO 客戶端連接
- [x] 設計即時進度顯示 UI 元件
- [x] 實作進度條與狀態更新
- [x] 實作預估剩餘時間計算
- [x] 撰寫 WebSocket 功能的測試

## 新增需求：LLM 增強品牌提及分析
- [x] 設計 LLM prompt 用於品牌提及分析（排名、推薦強度、情境）
- [x] 實作 LLM 語意分析函數取代關鍵字匹配
- [x] 實作品牌排名位置識別（第幾名推薦）
- [x] 實作推薦強度評分（強烈推薦/中性提及/負面警告）
- [x] 實作提及情境分類（比較評測/使用心得/問題解答/購買建議）
- [x] 實作摘要報告生成（使用 LLM 彙整分析結果）
- [x] 實作改善建議生成（基於分析結果提供具體行動方案）
- [x] 更新 brandMentions 資料表結構以儲存新欄位
- [x] 更新分析結果頁面顯示增強後的分析資訊
- [x] 撰寫 LLM 分析功能的單元測試

## 新增需求：台日市場專屬反串語料庫與 Sarcasm Detection
- [x] 收集台灣反串用語範例（PTT/Dcard 常見酸文、反串語法）
- [x] 收集日本反串用語範例（2ch/5ch 常見酸文、皮肉語法）
- [x] 建立反串語料庫資料表結構
- [x] 實作語料庫管理介面（新增/編輯/刪除範例）
- [x] 整合語料庫到 LLM prompt（提供反串範例作為 few-shot learning）
- [x] 實作增強版 Sarcasm Detection（使用語料庫提升準確度）
- [x] 在分析結果中顯示反串檢測詳細資訊
- [x] 撰寫反串檢測功能的單元測試

## Bug 修正
- [x] 修正 Projects 頁面查詢不存在的 sessionId 導致的錯誤
- [x] 確保所有查詢在資料不存在時正確處理 undefined 情況

## Bug 修正 - Gemini API
- [x] 修正 Gemini API 模型名稱錯誤（使用正確的模型名稱）

## Bug 修正 - 更新 Gemini 模型
- [x] 將 Gemini 模型名稱更新為 gemini-2.5-flash

## Bug 修正 - 批次測試執行
- [x] 調查批次測試執行後沒有產生引擎回應的問題
- [x] 檢查 API 呼叫失敗原因（查看後端日誌）
- [x] 修正 API 呼叫錯誤處理（從 API Keys 建立虛擬引擎列表）
- [x] 確保資料正確儲存到資料庫
- [x] 新增關鍵字後自動生成問句
- [x] 在關鍵字卡片上顯示已生成的問句數量
- [x] 在開始分析按鈕上添加前置檢查
