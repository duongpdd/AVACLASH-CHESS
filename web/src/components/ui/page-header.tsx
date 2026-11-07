import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  id,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <header className="page-intro">
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 id={id} className="text-2xl font-bold">
          {title}
        </h1>
        {description && <p className="text-description mt-2">{description}</p>}
      </div>
      {actions && (
        <div className="page-intro-actions flex flex-wrap gap-2">{actions}</div>
      )}
    </header>
  );
}
