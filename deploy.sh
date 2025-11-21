#!/bin/bash

# 部署腳本 - Cloudflare Worker + Pages
# 用法: ./deploy.sh [worker|pages|all]

set -e  # 遇到錯誤立即退出

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 環境變數
WORKER_NAME="omni-market-geo-agent-worker"
PAGES_PROJECT="omni-market-app"
VITE_API_URL="https://omni-market-geo-agent-worker.backtrue.workers.dev"

# 輔助函數
print_step() {
    echo -e "${BLUE}==>${NC} ${GREEN}$1${NC}"
}

print_error() {
    echo -e "${RED}錯誤:${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}警告:${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# 部署 Worker
deploy_worker() {
    print_step "開始部署 Worker..."
    
    # 構建 Worker
    print_step "構建 Worker..."
    pnpm run build:worker
    
    # 部署 Worker
    print_step "部署到 Cloudflare..."
    pnpm wrangler deploy
    
    print_success "Worker 部署完成！"
    echo -e "  URL: ${BLUE}https://${WORKER_NAME}.backtrue.workers.dev${NC}"
}

# 部署 Pages
deploy_pages() {
    print_step "開始部署 Pages..."
    
    # 使用環境變數構建前端
    print_step "構建前端（使用環境變數）..."
    VITE_API_URL=$VITE_API_URL pnpm run build
    
    # 部署到 Pages
    print_step "部署到 Cloudflare Pages..."
    pnpm wrangler pages deploy dist/public --project-name=$PAGES_PROJECT
    
    print_success "Pages 部署完成！"
    echo -e "  自訂網域: ${BLUE}https://dd.thinkwithblack.com${NC}"
}

# 主邏輯
main() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Cloudflare 部署腳本${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    
    case "${1:-all}" in
        worker)
            deploy_worker
            ;;
        pages)
            deploy_pages
            ;;
        all)
            deploy_worker
            echo ""
            deploy_pages
            ;;
        *)
            print_error "無效的參數: $1"
            echo "用法: $0 [worker|pages|all]"
            echo ""
            echo "選項:"
            echo "  worker  - 只部署 Worker"
            echo "  pages   - 只部署 Pages"
            echo "  all     - 部署 Worker 和 Pages（預設）"
            exit 1
            ;;
    esac
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  部署完成！${NC}"
    echo -e "${GREEN}========================================${NC}"
}

# 執行主函數
main "$@"
