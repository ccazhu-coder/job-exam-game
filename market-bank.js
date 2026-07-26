(() => {
  'use strict';
  const GROUPS = [{"category":"企業經典必考題","start":1,"questions":["請用一分鐘介紹自己，並說明你與這個職缺的連結。","你為什麼想應徵這個職務？","你為什麼選擇我們公司？","你對這份工作的內容了解多少？","公司為什麼應該錄取你？","哪一段經驗最能證明你適合這個職缺？","請說明你最有競爭力的三項優勢。","你目前最需要改善的地方是什麼？你正在怎麼改善？","以前的同事、同學或朋友通常怎麼形容你？","請分享一件讓你最有成就感的事。","你離開上一份工作或想轉職的主要原因是什麼？","履歷中有一段任職時間較短，可以說明原因嗎？","履歷上的待業或空窗期間，你做了哪些準備？","你不是本科系或相關經驗不多，為什麼想做這份工作？","你對未來三到五年的職涯規劃是什麼？","你對這份工作的期待是什麼？","最快什麼時候可以到職？","你可以配合加班、輪班、假日或出差嗎？","目前還有面試其他公司或職缺嗎？","面談最後，你想向公司了解哪些事情？"],"intent":"企業通常用這類題目確認求職動機、穩定度、準備程度與職務適配性。","hint":"先說結論，再用一個具體經驗或成果佐證，最後把內容連結到應徵職務。"},{"category":"行為與職場情境題","start":21,"questions":["請分享一次你解決棘手問題的經驗。","請分享一次你犯錯後如何補救的經驗。","曾經有一件事情結果不如預期嗎？你學到什麼？","你曾經和同事或同學意見不合嗎？最後怎麼處理？","請分享一次你在團隊中主動補位的經驗。","在一個專案中，你實際負責哪些工作？貢獻是什麼？","遇到期限很趕的任務，你會如何安排？","同時收到多項任務時，你如何判斷優先順序？","執行到一半需求突然改變，你會怎麼處理？","面對不滿或抱怨的客戶，你會怎麼回應？","主管直接批評你的表現時，你會怎麼做？","被交付一項完全不熟悉的工作，你會怎麼開始？","團隊成員沒有按時完成工作，你會怎麼處理？","工作壓力很大時，你如何維持效率與情緒穩定？","你不同意主管的做法時，會怎麼溝通？","發現同事的做法可能違反規定或造成風險，你會怎麼辦？","請舉例說明你曾經如何改善一個流程。","你如何在短時間內學會一個新工具或新流程？","請分享一次你成功說服他人接受建議的經驗。","主管交代不清楚，但期限很近，你會怎麼確認並完成？"],"intent":"企業藉由過去行為判斷問題處理、合作、責任感與臨場反應。","hint":"使用STAR：情境、任務、行動、結果；要明確說出「你做了什麼」。"},{"category":"行政／文書／專案助理","start":41,"questions":["你如何確保文件、數字或資料輸入正確？","同時要安排會議、接電話和處理急件時，你會如何排序？","請說明你整理會議紀錄與追蹤待辦事項的方法。","你使用Excel、Word或雲端文件處理過哪些工作？","接觸個資、薪資或公司機密時，你會注意什麼？","主管臨時要求一份今天下班前要完成的資料，你會怎麼做？","兩位主管同時交辦急件，而且都說自己最優先，你會怎麼處理？","你如何管理檔案命名、版本與歸檔，避免找錯資料？","需要代表公司聯繫客戶、廠商或公部門時，你會如何準備？","請分享一次你協助活動、會議或專案順利完成的經驗。"],"intent":"確認細心度、文書工具、溝通協調、時間管理與保密意識。","hint":"回答時說明使用的工具、檢查步驟、追蹤方式及實際成果。"},{"category":"業務／客服／門市服務","start":51,"questions":["客戶認為價格太高，你會如何回應？","遇到情緒激動的客戶，你會先做什麼？","業績或服務目標落後時，你會如何調整？","客戶詢問你不熟悉的產品或問題時，你會怎麼處理？","尖峰時段排隊人數很多，你會如何兼顧速度與服務品質？","客戶要求超出公司規定的補償，你會怎麼說？","你答應客戶的事情沒有如期完成，會如何補救？","交班時如何確保客戶需求不會遺漏？","你會用什麼方式建立客戶信任與回購意願？","連續被客戶拒絕或業績受挫時，你如何調整自己？"],"intent":"確認服務態度、抗壓性、需求釐清、說服能力及規範意識。","hint":"先理解需求與情緒，再提出符合公司規定的方案，最後確認客戶是否接受。"},{"category":"製造／品管／倉儲／技術現場","start":61,"questions":["你如何確保自己依照SOP完成工作？","發現產品品質異常時，你會怎麼處理？","設備出現異音或異常警示，但產線正趕進度，你會怎麼辦？","請舉例說明你如何維持現場安全與整潔。","交接班時，你認為哪些資訊一定要交代清楚？","盤點數量與系統資料不一致時，你會怎麼查找原因？","面對重複性高的工作，你如何維持專注與品質？","主管要求提高速度時，你如何兼顧效率與正確率？","同一種不良品反覆發生，你會如何協助找出原因？","你能接受輪班、久站、搬運或依現場需求加班嗎？"],"intent":"確認SOP、安全、品質、設備敏感度、紀律與現場配合度。","hint":"安全與品質要優先，說明通報、隔離、紀錄、查核與改善流程。"},{"category":"數位行銷／影音／AI應用","start":71,"questions":["請分享一個你參與的社群、影音或數位專案，成果如何？","如果要為一項新產品規劃一週的社群內容，你會怎麼開始？","品牌貼文出現負面留言時，你會如何處理？","你會看哪些數據判斷內容或活動是否有效？","你如何使用AI工具提升效率，又如何確認內容正確？","使用圖片、音樂、客戶資料或AI生成內容時，要注意哪些權利與風險？","客戶對設計或影片反覆修改，你如何管理版本與需求？","今天臨時要在兩小時內完成一則宣傳內容，你會如何取捨？","作品集中哪一個案例最能代表你的能力？你負責什麼？","遇到不會的軟體功能時，你通常如何學會並完成任務？"],"intent":"確認作品成果、內容思維、數據觀念、工具能力與責任使用AI的態度。","hint":"說明目標、受眾、你的角色、使用工具、衡量指標及改善結果。"},{"category":"無人機／科技應用","start":81,"questions":["你為什麼想應徵無人機或科技應用相關工作？","執行戶外或設備任務前，你會如何規劃與確認條件？","面對法規、場域限制或客戶要求衝突時，你會怎麼處理？","工作中設備出現異常時，你的處理順序是什麼？","你如何確保操作人員、現場民眾與設備的安全？","天候或現場條件突然改變時，你會如何判斷是否繼續？","客戶催促你在風險未排除前開始工作，你會如何溝通？","你如何建立任務、設備或異常處理紀錄？","請分享一次你在技術實作中與團隊分工的經驗。","無人機課程中學到的能力，還可以轉用到哪些職務？"],"intent":"此題組只在選擇無人機或科技應用方向時出現，確認技術基礎與可轉移能力。","hint":"專業題也要以職場語言回答：安全、流程、紀錄、溝通與結果。"},{"category":"薪資／到職／職涯與反問","start":91,"questions":["你的期望薪資是多少？判斷依據是什麼？","面試官詢問上一份工作的薪資時，你會如何回答？","公司提出的薪資低於你的預期，你會怎麼談？","錄取後發現實際工作內容和面談時不同，你會怎麼處理？","如果職務有固定加班、輪班或出差需求，你會確認哪些條件？","公司希望你比原定時間更早到職，你會怎麼協調？","同時收到兩個錄取通知時，你會用哪些條件做決定？","除了薪資，你最重視哪些工作條件？","試用期間你希望自己達成哪些具體成果？","面談結束前，請用三十秒做最後補充，並提出一個有品質的問題。"],"intent":"確認薪資期待、決策標準、到職可行性與職涯成熟度。","hint":"先了解完整職務與條件，再提出有市場依據、可協商且誠實的回答。"}];
  const NEW_QUESTIONS = GROUPS.flatMap((group,groupIndex) => group.questions.map((question,index)=>({id:group.start+index,category:group.category,categoryNo:groupIndex+1,question,intent:group.intent,hint:group.hint})));
  const NEW_EVENTS = ["主管把交件時間提前一半，請重新安排你的處理順序。","同組一位重要成員臨時請假，你會如何調整分工？","客戶在最後一刻改變需求，但預算與時間不變。","系統突然故障，原本準備的資料暫時無法開啟。","你發現已送出的文件有一個數字可能錯誤。","現場出現安全疑慮，但主管希望先把工作做完。","客戶公開抱怨服務品質，並要求立刻處理。","前一班留下的交接資料不完整。","你同時收到三件都標示為急件的任務。","重要郵件不小心寄給錯誤的收件人。","設備或工具出現異常，但工作進度正在落後。","盤點結果與系統紀錄不一致。","你發現同事可能沒有依照規定處理工作。","業績或工作進度落後原定目標。","客戶連續拒絕你的三個方案。","主管只說『盡快處理』，但沒有說明完成標準。","公司臨時改用你不熟悉的新工具。","你在會議中被主管當眾指出問題。","合作對象長時間沒有回覆，卻即將到期限。","剩餘時間只有原計畫的一半，請說明你會保留哪些工作。"];
  const NEW_OFFERS = ["你的期望薪資是多少？判斷依據是什麼？","面試官詢問上一份工作的薪資時，你會如何回答？","公司提出的薪資低於你的預期，你會怎麼談？","錄取後發現實際工作內容和面談時不同，你會怎麼處理？","如果職務有固定加班、輪班或出差需求，你會確認哪些條件？","公司希望你比原定時間更早到職，你會怎麼協調？","同時收到兩個錄取通知時，你會用哪些條件做決定？","除了薪資，你最重視哪些工作條件？","試用期間你希望自己達成哪些具體成果？","面談結束前，請用三十秒做最後補充，並提出一個有品質的問題。"];

  function updateQuestionBank(){
    if(typeof QUESTIONS!=='undefined') QUESTIONS.splice(0,QUESTIONS.length,...NEW_QUESTIONS);
    if(typeof EVENTS!=='undefined') EVENTS.splice(0,EVENTS.length,...NEW_EVENTS);
    if(typeof OFFERS!=='undefined') OFFERS.splice(0,OFFERS.length,...NEW_OFFERS);
    if(typeof CRITERIA!=='undefined') CRITERIA.splice(0,CRITERIA.length,'內容完整','邏輯條理','職務連結','問題處理','表達台風');
    if(typeof careerLabels!=='undefined') Object.assign(careerLabels,{
      general:'不限職類／通用面談',
      admin:'行政／文書／專案助理',
      service:'業務／客服／門市服務',
      operations:'製造／品管／倉儲／技術現場',
      digital:'數位行銷／影音／AI應用',
      drone:'無人機／科技應用',
      pilot:'無人機／科技應用',
      media:'數位行銷／影音／AI應用',
      inspection:'製造／品管／倉儲／技術現場',
      project:'行政／文書／專案助理'
    });
    if(typeof state!=='undefined'){
      const legacy={pilot:'drone',media:'digital',inspection:'operations',project:'admin'};
      state.career=legacy[state.career]||state.career||'general';
    }
  }

  function careerPool(key){
    const normalized={pilot:'drone',media:'digital',inspection:'operations',project:'admin'}[key]||key;
    const behavior=NEW_QUESTIONS.filter(q=>q.id>=21&&q.id<=40);
    const maps={
      general:NEW_QUESTIONS.filter(q=>(q.id>=1&&q.id<=40)||(q.id>=91&&q.id<=100)),
      admin:behavior.concat(NEW_QUESTIONS.filter(q=>q.id>=41&&q.id<=50)),
      service:behavior.concat(NEW_QUESTIONS.filter(q=>q.id>=51&&q.id<=60)),
      operations:behavior.concat(NEW_QUESTIONS.filter(q=>q.id>=61&&q.id<=70)),
      digital:behavior.concat(NEW_QUESTIONS.filter(q=>q.id>=71&&q.id<=80)),
      drone:behavior.concat(NEW_QUESTIONS.filter(q=>q.id>=81&&q.id<=90))
    };
    return maps[normalized]||maps.general;
  }

  function overrideRoundPool(){
    roundPool=function(){
      const r=state.round;
      if(r==='warmup') return NEW_QUESTIONS.filter(q=>q.id>=1&&q.id<=20);
      if(r==='scenario') return NEW_QUESTIONS.filter(q=>q.id>=21&&q.id<=40);
      if(r==='career') return careerPool(state.career);
      if(r==='offer') return NEW_QUESTIONS.filter(q=>q.id>=91&&q.id<=100);
      if(r==='pk') return NEW_QUESTIONS.filter(q=>(q.id>=11&&q.id<=40)||(q.id>=91&&q.id<=100));
      return NEW_QUESTIONS.slice();
    };
  }

  const CAREERS=[
    ['general','不限職類／通用面談'],
    ['admin','行政／文書／專案助理'],
    ['service','業務／客服／門市服務'],
    ['operations','製造／品管／倉儲／技術現場'],
    ['digital','數位行銷／影音／AI應用'],
    ['drone','無人機／科技應用']
  ];
  function replaceOptions(select){
    if(!select)return;
    const current=(typeof state!=='undefined'&&state.career)||'general';
    select.innerHTML=CAREERS.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
    select.value=CAREERS.some(([value])=>value===current)?current:'general';
  }
  function updateUi(){
    replaceOptions(document.getElementById('careerSelect'));
    replaceOptions(document.getElementById('syncCareerSelect'));
    const comments=document.getElementById('commentSelect');
    if(comments){
      [...comments.options].forEach(option=>{
        if(option.textContent.includes('安全與責任意識')) option.textContent='問題處理與責任感良好';
      });
    }
    const placeholder=document.getElementById('customComment');
    if(placeholder) placeholder.placeholder='例如：回答可再補充具體案例、成果或職務連結。';
  }
  function init(){
    updateQuestionBank();
    overrideRoundPool();
    updateUi();
    setTimeout(updateUi,80);
    if(typeof renderAll==='function') renderAll();
    if(typeof safeSave==='function') safeSave();
    console.info('[面談演練闖關遊戲] 已載入一般就業市場面談題庫100題');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();