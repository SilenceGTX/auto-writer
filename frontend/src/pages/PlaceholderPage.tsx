/** Placeholder page for workflow areas that will be implemented next. */
import type { ReactElement } from "react";
import { Card, CardBody, Chip } from "@heroui/react";

interface PlaceholderPageProps {
  title: string;
  summary: string;
  steps: string[];
}

/** Render a focused placeholder for a planned workflow page. */
export function PlaceholderPage(props: PlaceholderPageProps): ReactElement {
  return (
    <section className="workspace-page">
      <div className="page-header">
        <div>
          <h1>{props.title}</h1>
          <p>{props.summary}</p>
        </div>
      </div>
      <Card shadow="sm">
        <CardBody className="placeholder-card">
          {props.steps.map((step) => (
            <Chip key={step} color="primary" variant="flat">
              {step}
            </Chip>
          ))}
        </CardBody>
      </Card>
    </section>
  );
}
