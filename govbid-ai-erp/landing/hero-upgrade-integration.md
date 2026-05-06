# GovBid AI ERP｜Hero 區升級整合說明

## 目的
把首頁右側空白區升級成 SaaS Dashboard 產品視覺，讓官網從一般 Landing Page 變成更像企業級 SaaS 官網。

## 已建立檔案

```text
hero-dashboard-mockup.css
hero-dashboard-mockup.html
```

## 整合方式

### 1. 在首頁 head 加入 CSS

```html
<link rel="stylesheet" href="./hero-dashboard-mockup.css" />
```

若首頁檔案與 CSS 路徑不同，請依實際位置調整，例如：

```html
<link rel="stylesheet" href="/job-exam-game/govbid-ai-erp/landing/hero-dashboard-mockup.css" />
```

### 2. 在 Hero 右側區塊加入 mockup HTML

將 `hero-dashboard-mockup.html` 的內容放到 Hero section 右側空白區。

建議結構：

```html
<section class="hero">
  <div class="hero-copy">
    <!-- 原本標題、文案、CTA 保留 -->
  </div>

  <div class="hero-visual">
    <!-- 貼上 hero-dashboard-mockup.html 內容 -->
  </div>
</section>
```

## 視覺內容

Dashboard Mockup 包含：

- 標案決策中心
- 決策分數 86
- AI 提案生成中
- CRM 名單追蹤
- 履約任務
- 財務控管
- 應收款提醒 NT$198,000
- AI 建議：這案適合投標

## RWD 行為

- 桌機：Dashboard Mockup 放右側
- 平板：置中顯示
- 手機：自動移到標題下方

## 下一步

1. 找到目前 Landing Page 的 `index.html`
2. 引入 `hero-dashboard-mockup.css`
3. 把 `hero-dashboard-mockup.html` 插入 Hero 右側
4. 上 GitHub Pages 檢查畫面
5. 若右側太大，調整 `.hero-product-visual` 的 `width`
