import './globals.css';

export const metadata = {
  title: 'GovBid AI ERP｜AI標案SaaS平台',
  description: 'AI標案決策、提案生成、履約管理與財務控管平台',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
