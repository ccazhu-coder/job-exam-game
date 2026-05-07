/*
GovOps OS｜第44檔：LINE自然語言秘書中心
版本：MVP v1.0.0
依賴：37_core.gs、38_activity_workflow.gs、39_registration_crm.gs、40_onsite_checkin_reimbursement.gs、41_finance_receivable.gs、43_reminder_center.gs
用途：提供LINE Bot與前端文字指令測試使用，將自然語言轉成系統動作。
*/

function AI秘書查詢(data) {
  try {
    const text = String(data.text || data.query || '').trim();
    if (!text) return fail('請輸入要查詢的內容。');

    if (hasAny(text, ['今天要做什麼','今日摘要','每日摘要','今天摘要'])) return 產生秘書摘要(data);
    if (hasAny(text, ['今日提醒','今天提醒','提醒'])) return 查詢今日提醒(data);
    if (hasAny(text, ['今日任務','今天任務','今天工作'])) return 查詢今日任務(data);
    if (hasAny(text, ['未收款','應收','還沒收款','還沒收到錢'])) return 查詢未收款(data);
    if (hasAny(text, ['缺件','核銷','缺哪些'])) return AI缺件檢查(data);
    if (hasAny(text, ['損益','賺多少','虧多少'])) return 查詢專案損益(data);
    if (hasAny(text, ['入選名單','已入選'])) return queryRegistrationsByStatus('已入選', data);
    if (hasAny(text, ['候補名單','候補'])) return queryRegistrationsByStatus('候補', data);

    if (text.indexOf('完成') === 0) {
      const keyword = text.replace('完成', '').trim();
      return 更新任務狀態({ 活動ID: data.活動ID || '', keyword: keyword, status: '已完成' });
    }

    return 查詢({ query: text, 活動ID: data.活動ID || '' });
  } catch (err) {
    logError('AI秘書查詢', err);
    return fail('AI秘書暫時無法完成查詢。');
  }
}

function LINE測試V2(data) {
  return AI秘書查詢({ text: data.text || data.query || '', 活動ID: data.活動ID || '' });
}

function 產生秘書摘要(data) {
  try {
    初始化系統();
    初始化財務資料表();
    初始化提醒中心();

    const 今日 = today();
    const todayActs = readRows(SHEETS.活動).filter(a => normalizeDate(a.活動日期) === 今日 && String(a.活動狀態) !== '已取消');
    const tasks = readRows(SHEETS.任務).filter(r => ['','待執行','進行中','異常'].indexOf(String(r.任務狀態 || '')) >= 0);
    const missing = readRows(SHEETS.核銷).filter(r => ['','未完成','缺件'].indexOf(String(r.核銷狀態 || '')) >= 0);
    const unpaid = readRows('應收帳款').filter(r => String(r.應收狀態) !== '已收款');

    const lines = [];
    lines.push('珍珠老師，今天營運重點如下：');
    lines.push('今日活動：' + todayActs.length + '場');
    lines.push('未完成任務：' + tasks.length + '項');
    lines.push('核銷缺件：' + missing.length + '項');
    lines.push('未收款：' + unpaid.length + '筆');

    if (todayActs.length) {
      lines.push('');
      lines.push('今日活動');
      todayActs.slice(0, 5).forEach(a => lines.push('- ' + a.活動名稱 + '｜' + a.開始時間 + '｜' + a.活動地點));
    }

    if (tasks.length) {
      lines.push('');
      lines.push('優先處理任務');
      tasks.slice(0, 5).forEach(t => lines.push('- ' + t.工作任務 + '｜' + t.任務狀態 + '｜' + t.活動ID));
    }

    if (missing.length) {
      lines.push('');
      lines.push('缺件提醒');
      missing.slice(0, 5).forEach(m => lines.push('- ' + m.核銷項目 + '｜' + m.核銷狀態 + '｜' + m.活動ID));
    }

    if (unpaid.length) {
      lines.push('');
      lines.push('未收款提醒');
      unpaid.slice(0, 5).forEach(u => lines.push('- ' + u.對象名稱 + '｜' + u.應收項目 + '｜' + u.應收金額));
    }

    const summary = lines.join('\n');
    appendObjectByName('秘書摘要', {
      摘要ID: generateReminderId('SUM'),
      摘要日期: 今日,
      摘要類型: '每日摘要',
      摘要內容: summary,
      風險數: missing.length + unpaid.length,
      未完成任務數: tasks.length,
      缺件數: missing.length,
      未收款數: unpaid.length,
      建立時間: now()
    });

    return success('今日秘書摘要已產生。', { 摘要內容: summary });
  } catch (err) {
    logError('產生秘書摘要', err);
    return fail('今日秘書摘要產生失敗。');
  }
}

function hasAny(text, words) {
  return words.some(w => text.indexOf(w) >= 0);
}
