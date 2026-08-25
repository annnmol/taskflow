import type { HTMLAttributes, ReactNode } from "react";

type TextProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
  variant?: "body" | "muted" | "eyebrow" | "error" | "success" | "info";
};

function Text({
  children,
  className = "",
  variant = "body",
  ...props
}: TextProps) {
  return (
    <p className={`text text-${variant} ${className}`.trim()} {...props}>
      {children}
    </p>
  );
}

export default Text;
