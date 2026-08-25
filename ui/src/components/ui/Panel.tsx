import type { HTMLAttributes } from "react";

function Panel({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <section className={`panel ${className}`.trim()} {...props} />;
}

export default Panel;