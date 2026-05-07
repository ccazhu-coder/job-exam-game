# GovBid AI ERP｜Google Apps Script 後端部署說明

本後端負責接收 Landing Page 表單資料，並寫入 Google Sheet CRM。

---

## 一、建立 Google Sheet

請先建立一份新的 Google Sheet，建議命名：

```text
GovBid AI ERP CRM
```

---

## 二、開啟 Apps Script

在 Google Sheet 上方選單：

```text
擴充功能 → Apps Script
```

把 `Code.gs` 的內容完整貼上。

---

## 三、第一次初始化

在 Apps Script 上方函式選單選擇：

```text
setup
```

然後按「執行」。

第一次會要求授權，請依照畫面完成授權。

執行成功後，Google Sheet 會自動建立：

```text
leads
logs
```

---

## 四、部署成 Web App

Apps Script 右上角：

```text
部署 → 新增部署
```

設定：

```text
類型：網頁應用程式
說明：GovBid AI ERP Lead API
執行身份：我
誰可以存取：任何知道連結的人
```

部署後會取得一組 Web App URL，例如：

```text
https://script.google.com/macros/s/xxxxxxxxxxxx/exec
```

---

## 五、串接前端 form.js

打開：

```text
govbid-ai-erp/landing/form.js
```

把：

```javascript
const WEB_APP_URL = '';
```

改成：

```javascript
const WEB_APP_URL = '你的 Web App URL';
```

---

## 六、測試表單

打開前端頁面：

```text
https://ccazhu-coder.github.io/job-exam-game/govbid-ai-erp/landing/
```

送出一筆測試資料。

成功時，Google Sheet 的 `leads` 工作表會新增一筆資料。

---

## 七、目前資料表欄位

### leads

```text
lead_id
created_at
source
name
line
email
plan
status
message
stage
owner
note
updated_at
```

### logs

```text
created_at
level
action
message
payload
```

---

## 八、Lead 階段建議

`stage` 欄位可使用：

```text
new
contacted
qualified
demo_scheduled
proposal_sent
won
lost
```

---

## 九、目前版本定位

這是 GovBid AI ERP 的第一版後端，用於：

```text
Landing Page 表單
→ Google Apps Script API
→ Google Sheet CRM
```

後續可升級為：

```text
Supabase Auth
Supabase Database
Vercel API
OpenAI API
LINE Webhook
正式 SaaS Dashboard
```
