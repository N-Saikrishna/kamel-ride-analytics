// Shared panel chrome and loading/empty primitives.

import type { ReactNode } from "react";

export function Panel(props: {
  title: string;
  tools?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{props.title}</h2>
        {props.tools !== undefined ? (
          <div className="panel-tools">{props.tools}</div>
        ) : null}
      </div>
      {props.children}
    </section>
  );
}

export function Skeleton(props: { className?: string }): ReactNode {
  return <div className={`skeleton ${props.className ?? ""}`} />;
}

export function EmptyState(props: { message: string }): ReactNode {
  return <div className="empty">{props.message}</div>;
}
