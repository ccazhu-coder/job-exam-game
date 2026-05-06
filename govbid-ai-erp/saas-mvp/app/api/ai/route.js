import { NextResponse } from 'next/server';

function buildProposal({ bidName = '', agency = '', spec = '' }) {
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
    qa: [
      '評審可能詢問：本團隊如何確保執行可行性？',
      '評審可能詢問：KPI如何量化與驗收？',
      '評審可能詢問：若招生不足或期程延誤如何處理？'
    ],
    pricingStrategy: '先估算必要成本、講師費、人力費、行政費、交通印刷與風險預備金，再依得標機率設定利潤率。',
    summary: `${agency || '機關'}｜${bidName || '標案'}：已建立初步提案架構。`
  };
}

export async function POST(request) {
  const body = await request.json();
  return NextResponse.json({ ok: true, data: buildProposal(body) });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'GovBid AI Proposal API' });
}
