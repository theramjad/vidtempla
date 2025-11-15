import { cn } from "@/lib/utils";
import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ className, ...props }) => (
      <h1
        className={cn(
          // Slightly smaller than before and a bit less top/bottom spacing
          "mb-6 mt-10 scroll-m-20 text-2xl font-bold tracking-tight sm:text-3xl",
          className,
        )}
        {...props}
      />
    ),
    h2: ({ className, ...props }) => (
      <h2
        className={cn(
          // Down from text-2xl to text-xl with reduced spacing
          "mb-4 mt-8 scroll-m-20 border-b pb-2 text-xl font-semibold tracking-tight first:mt-0",
          className,
        )}
        {...props}
      />
    ),
    h3: ({ className, ...props }) => (
      <h3
        className={cn(
          // Slightly smaller still
          "mb-3 mt-6 scroll-m-20 text-lg font-semibold tracking-tight",
          className,
        )}
        {...props}
      />
    ),
    h4: ({ className, ...props }) => (
      <h4
        className={cn(
          "mb-2 mt-5 scroll-m-20 text-base font-semibold tracking-tight",
          className,
        )}
        {...props}
      />
    ),
    h5: ({ className, ...props }) => (
      <h5
        className={cn(
          "mb-2 mt-4 scroll-m-20 text-sm font-semibold tracking-tight",
          className,
        )}
        {...props}
      />
    ),
    h6: ({ className, ...props }) => (
      <h6
        className={cn(
          "mb-2 mt-4 scroll-m-20 text-xs font-semibold tracking-tight",
          className,
        )}
        {...props}
      />
    ),
    a: ({ className, ...props }) => (
      <a
        className={cn(
          "font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:text-primary/80 hover:decoration-primary/60",
          className,
        )}
        {...props}
      />
    ),
    p: ({ className, ...props }) => (
      <p
        className={cn(
          // Switched to text-sm for a smaller reading size and slightly less margin
          "mt-5 text-sm leading-relaxed text-gray-600",
          className,
        )}
        {...props}
      />
    ),
    ul: ({ className, ...props }) => (
      <ul
        className={cn("my-5 ml-4 list-disc space-y-2 text-sm", className)}
        {...props}
      />
    ),
    ol: ({ className, ...props }) => (
      <ol
        className={cn("my-5 ml-4 list-decimal space-y-2 text-sm", className)}
        {...props}
      />
    ),
    li: ({ className, ...props }) => (
      <li
        className={cn("mt-1 text-sm leading-relaxed text-gray-600", className)}
        {...props}
      />
    ),
    blockquote: ({ className, ...props }) => (
      <blockquote
        className={cn(
          "my-5 border-l-2 border-primary/60 pl-4 text-sm italic text-gray-600",
          className,
        )}
        {...props}
      />
    ),
    hr: ({ ...props }) => <hr className="my-8 border-primary/10" {...props} />,
    table: ({ className, ...props }) => (
      <div className="my-5 w-full overflow-x-auto">
        <table
          className={cn("w-full border-collapse text-sm", className)}
          {...props}
        />
      </div>
    ),
    tr: ({ className, ...props }) => (
      <tr
        className={cn("m-0 border-t p-0 even:bg-muted/30", className)}
        {...props}
      />
    ),
    th: ({ className, ...props }) => (
      <th
        className={cn(
          "border px-3 py-2 text-left font-medium [&[align=center]]:text-center [&[align=right]]:text-right",
          className,
        )}
        {...props}
      />
    ),
    td: ({ className, ...props }) => (
      <td
        className={cn(
          "border px-3 py-2 text-left align-top [&[align=center]]:text-center [&[align=right]]:text-right",
          className,
        )}
        {...props}
      />
    ),
    pre: ({ className, ...props }) => (
      <pre
        className={cn(
          "my-5 overflow-x-auto rounded-lg border bg-black p-4 text-sm text-white",
          className,
        )}
        {...props}
      />
    ),
    code: ({ className, ...props }) => (
      <code
        className={cn(
          "relative rounded border bg-muted px-[0.3rem] py-[0.15rem] font-mono text-xs",
          className,
        )}
        {...props}
      />
    ),
    strong: ({ className, ...props }) => (
      <strong
        className={cn("font-medium text-gray-900", className)}
        {...props}
      />
    ),
    ...components,
  };
}
