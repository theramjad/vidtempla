import { cn } from "@/lib/utils";
import * as React from "react";
import { Button } from "./button";

interface ButtonGroupProps extends React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>> {
  value?: string;
  onValueChange?: (value: string) => void;
}

interface ButtonGroupItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function ButtonGroup({
  value,
  onValueChange,
  className,
  children,
  ...props
}: ButtonGroupProps) {
  return (
    <div className={cn("flex w-full rounded-lg border", className)} {...props}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement<ButtonGroupItemProps>(child)) {
          return React.cloneElement(child, {
            onClick: () => onValueChange?.(child.props.value),
            className: cn(
              "flex-1 rounded-none",
              "first:rounded-t-lg last:rounded-b-lg sm:first:rounded-l-lg sm:first:rounded-tr-none sm:last:rounded-r-lg sm:last:rounded-bl-none",
              "border-0",
              value === child.props.value
                ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                : "hover:bg-muted hover:text-foreground",
              child.props.className,
            ),
          });
        }
        return child;
      })}
    </div>
  );
}

export function ButtonGroupItem({ className, ...props }: ButtonGroupItemProps) {
  return <Button variant="outline" className={className} {...props} />;
}
