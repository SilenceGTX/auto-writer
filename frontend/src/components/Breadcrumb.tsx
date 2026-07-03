/** Reusable breadcrumb for showing the current work context (rule G5). */
import { Fragment, type ReactElement } from "react";

export interface BreadcrumbItem {
  label: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/** Render a `/`-separated breadcrumb trail. */
export function Breadcrumb(props: BreadcrumbProps): ReactElement {
  return (
    <nav className="breadcrumb" aria-label="当前作品上下文">
      {props.items.map((item, index) => (
        <Fragment key={`${item.label}-${index}`}>
          {index > 0 && <span className="breadcrumb-sep">/</span>}
          <span className="breadcrumb-item">{item.label}</span>
        </Fragment>
      ))}
    </nav>
  );
}
