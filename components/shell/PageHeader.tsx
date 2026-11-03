/**
 * Thin title bar at the top of an app page. `actions` sit on the right; `children` is an
 * optional second row (filters, tabs).
 */
export function PageHeader({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-b">
      <div className="flex min-h-12 flex-wrap items-center gap-3 px-4 py-2">
        <h1 className="text-sm font-medium">{title}</h1>
        {actions && (
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        )}
      </div>
      {children && <div className="border-t px-4 py-2">{children}</div>}
    </header>
  );
}
