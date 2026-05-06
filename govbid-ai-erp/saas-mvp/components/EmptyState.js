export default function EmptyState({ title = '目前沒有資料', description = '建立第一筆資料後會顯示在這裡。', actionText, actionHref }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '44px' }}>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {actionText && actionHref ? <a className="btn btn-blue" href={actionHref}>{actionText}</a> : null}
    </div>
  );
}
