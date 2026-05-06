import { canUse } from '../lib/permissions';

export default function PlanGuard({ plan = 'free', feature, children, fallback }) {
  const allowed = canUse(plan, feature);
  if (!allowed) {
    return fallback || (
      <div className="card">
        <h3>此功能需要升級方案</h3>
        <p className="muted">請升級至 Pro / Business 方案以使用此功能。</p>
        <a className="btn btn-blue" href="/govbid-ai-erp/saas-mvp/settings">查看方案</a>
      </div>
    );
  }
  return children;
}
