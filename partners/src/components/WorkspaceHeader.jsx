export default function WorkspaceHeader({
  icon: Icon,
  eyebrow = 'Partner workspace',
  title,
  description,
  status,
  actions,
}) {
  return (
    <header className="workspace-header">
      <div className="workspace-header-main">
        <span className="workspace-header-icon">
          {Icon && <Icon size={22} aria-hidden="true" />}
        </span>
        <div className="workspace-header-copy">
          <p className="workspace-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {description && <p className="workspace-description">{description}</p>}
        </div>
      </div>
      {(status || actions) && (
        <div className="workspace-header-side">
          {status}
          {actions && <div className="workspace-header-actions">{actions}</div>}
        </div>
      )}
    </header>
  );
}
