# GovOps OS 上線狀態紀錄

更新日期：2026-05-26

## 一、正式主線

正式使用者入口為：

```text
login.html
→ dashboard.html
→ 營運工作台模組
```

舊版 `index.html` 只保留為過渡或舊功能來源，不作為正式主入口。

## 二、目前採用的正式服務端點

目前前端設定檔使用下列已通過驗收的服務端點：

```text
https://script.google.com/macros/s/AKfycbzEayaKAUTk5C0s_3fSGQe49KmuJmsZNhYCoia2cjpYSmlYqnnZKIRHZh1GQZT4JpDy5g/exec
```

此端點已通過：

- 系統健康檢查
- 正式環境自檢
- 復原報告
- 帳務摘要
- 功能權限
- 服務使用量
- 報名審核名單
- 報名資料一致性檢查
- 報名資料一致性修復

回應格式皆為標準資料結構：

```text
success
message
data
```

## 三、不可切回的舊服務端點

下列舊端點健康檢查可回應，但多個正式動作仍會回「找不到對應功能」：

```text
https://script.google.com/macros/s/AKfycbyAcoTcQ4GYJWRmMvuzJwFrzKikerbjSsR2Pl_ca4q5Mwg0mVbjko3wAdHdLVrjgFgbKA/exec
```

除非該 Apps Script 專案重新部署最新後端補丁，否則不可作為正式商用端點。

## 四、前端驗收結論

已通過：

- 登入到營運工作台
- 報名管理嵌入新版營運工作台
- 報名管理角色權限
- 財務秘書角色權限
- 財務分頁切換
- 前端驗收中心
- 系統健康檢查
- 管理控制台權限與主要操作
- 可見畫面不顯示英文
- 可見畫面不顯示後端資料
- 可見畫面不顯示原始回應

## 五、目前判定

狀態：可內測上線

可商用程度：95%

正式對外商用前，建議再補：

- 手機實機操作驗收
- 正式 Google 帳號權限與 Apps Script 擁有者確認
- 舊服務端點是否退役或重新部署的營運決策
