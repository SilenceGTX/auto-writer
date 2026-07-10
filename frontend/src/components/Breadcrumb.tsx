/** Reusable breadcrumb for showing the current work context (rule G5). */
import { Fragment, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

export interface BreadcrumbItem {
  label: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/** Render a `/`-separated breadcrumb trail. */
export function Breadcrumb(props: BreadcrumbProps): ReactElement {
  const { t } = useTranslation("common");

  return (
    <nav className="breadcrumb" aria-label={t("breadcrumb.ariaLabel")}>
      {props.items.map((item, index) => (
        <Fragment key={`${item.label}-${index}`}>
          {index > 0 && <span className="breadcrumb-sep">/</span>}
          <span className="breadcrumb-item">{item.label}</span>
        </Fragment>
      ))}
    </nav>
  );
}
