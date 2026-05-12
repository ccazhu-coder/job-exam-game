# Tender Pipeline Dashboard Patch

已完成後端：`62_GovOps_TenderPipeline.gs`

待接 dashboard-v2：

- 建立標案流程：`tender.pipeline.create`
- 查詢標案流程：`tender.pipeline.query`
- 更新標案流程：`tender.pipeline.update`
- 標案流程下一步：`tender.pipeline.next`

建議 UI 欄位：

- 標案ID / 關鍵字
- 目前階段
- 下一步行動
- 下一步期限
- 負責人

階段：

1. 發現標案
2. 評估中
3. 決定投標
4. 備標中
5. 已投標
6. 開標等待
7. 已得標
8. 未得標
9. 履約中
10. 已結案

原則：

- 保留 dashboard-v2
- 不新增第二套 API client
- 使用 `callApi()`
- 表格顯示：標案ID、標案名稱、目前階段、流程狀態、下一步行動、下一步期限、完成率
