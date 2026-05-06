export default function PageHeader({ title, description, actionText, actionHref }) {
  return (
    <div className="card" style={{ marginBottom: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>{title}</h1>
          {description ? <p className="muted" style={{ marginBottom: 0 }}>{description}</p> : null}
        </div>
        {actionText && actionHref ? <a className="btn btn-blue" href={actionHref}>{actionText}</a> : null}
      </div>
    </div>
  );
}
