import { ReactNode } from "react";

type TaskLayoutProps = {
  children: ReactNode;
};

export function TaskLayout({ children }: TaskLayoutProps) {
  return <section className="task-view">{children}</section>;
}
