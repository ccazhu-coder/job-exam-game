export async function generateProposalWithOpenAI({ bidName = '', agency = '', spec = '' }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: 'OPENAI_API_KEY 尚未設定',
      fallback: buildFallbackProposal({ bidName, agency, spec })
    };
  }

  const prompt = `你是30年政府標案顧問與評選委員。請依據以下標案資料，產出：服務建議書架構、評審答詢問題、報價策略、風險控管。\n\n標案名稱：${bidName}\n機關：${agency}\n工作說明書：${spec}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '你是專業政府標案顧問，輸出要具體、可投標、可執行。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
    }),
  });

  const data = await response.json();
  return {
    ok: response.ok,
    content: data?.choices?.[0]?.message?.content || '',
    raw: data,
  };
}

export function buildFallbackProposal({ bidName = '', agency = '', spec = '' }) {
  return {
    proposalOutline: [
      '一、計畫背景與政策對應',
      '二、服務需求分析',
      '三、整體執行策略',
      '四、服務內容與執行規劃',
      '五、專案團隊與分工',
      '六、KPI與成果評估',
      '七、創新加值服務',
      '八、風險控管與備援機制',
      '九、經費與報價說明',
      '十、結案與驗收規劃'
    ],
    qa: ['可行性如何確保？', 'KPI如何驗收？', '風險如何備援？'],
    pricingStrategy: '依成本、風險、得標機率與利潤率進行報價。',
    summary: `${agency || '機關'}｜${bidName || '標案'}：已建立初步提案架構。`
  };
}
