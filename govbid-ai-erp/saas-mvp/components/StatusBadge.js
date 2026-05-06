export default function StatusBadge({ children, type = 'default' }) {
  const styles = {
    success: { background: '#dcfce7', color: '#166534' },
    warning: { background: '#fef3c7', color: '#92400e' },
    danger: { background: '#fee2e2', color: '#991b1b' },
    default: { background: '#e2e8f0', color: '#334155' },
  };
  return (
    <span style={{
      ...styles[type],
      padding: '5px 10px',
      borderRadius: '999px',
      fontSize: '13px',
      fontWeight: 800,
      display: 'inline-block'
    }}>
      {children}
    </span>
  );
}
