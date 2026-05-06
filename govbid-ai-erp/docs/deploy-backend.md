# GovBid AI ERP｜後端部署與正式營運設定

## 目標

讓銷售頁表單送出的客戶資料，自動寫入 Google Sheet 的「客戶名單」工作表。

---

## 已完成的檔案

- `landing/index.html`：銷售頁與表單
- `landing/form.js`：前端表單送出邏輯
- `backend/apps-script-webhook.gs`：Google Apps Script 後端

---

## 第一步：建立客戶名單 Google Sheet

建議直接使用現有的 GovBid AI ERP 主系統 Google Sheet。

後端會自動建立工作表：

- 客戶名單

欄位包含：

- 建立時間
- 姓名/單位
- LINE
- Email
- 方案
- 目前狀況
- 需求內容
- 來源
- 前端建立時間
- 名單狀態
- 聯繫狀態
- 備註

---

## 第二步：部署 Apps Script

1. 打開 Google Sheet
2. 點選「擴充功能」
3. 點選「Apps Script」
4. 將 `backend/apps-script-webhook.gs` 的內容貼入
5. 儲存專案
6. 點選「部署」
7. 選擇「新增部署作業」
8. 類型選擇「網頁應用程式」
9. 執行身分：我
10. 存取權限：任何人
11. 點選部署
12. 複製 Web App URL

---

## 第三步：更新前端 Web App URL

打開：

`landing/form.js`

找到：

```js
const WEB_APP_URL = '';
```

改成：

```js
const WEB_APP_URL = '你的 Google Apps Script Web App URL';
```

提交後，網站表單就會正式寫入 Google Sheet。

---

## 第四步：測試

1. 打開正式銷售頁
2. 填寫測試資料
3. 送出表單
4. 回到 Google Sheet
5. 查看是否新增「客戶名單」工作表與新資料列

---

## 正式營運檢查清單

- GitHub Pages 已啟用
- 銷售頁可以正常打開
- 表單可以填寫
- Apps Script 已部署為 Web App
- `form.js` 已填入 Web App URL
- Google Sheet 有收到客戶資料
- 客戶名單有聯繫狀態欄位
- 每日固定檢查新名單

---

## 後續升級方向

- Email 通知
- LINE 通知
- 自動報價
- 客戶分級
- 成交追蹤
- 付款串接
