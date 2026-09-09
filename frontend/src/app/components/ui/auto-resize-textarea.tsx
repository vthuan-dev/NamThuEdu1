import * as React from "react";
import { cn } from "./utils";

export interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeight?: number;
  maxHeight?: number;
}

export const AutoResizeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoResizeTextareaProps
>(
  (
    {
      value,
      onChange,
      onInput,
      minHeight = 44,
      maxHeight,
      className,
      style,
      rows = 2,
      ...props
    },
    forwardedRef
  ) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    const adjustHeight = React.useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;

      // Reset height to auto first to accurately calculate new scrollHeight (especially when text is deleted)
      el.style.height = "auto";
      const scrollH = el.scrollHeight;
      const targetH = maxHeight
        ? Math.min(maxHeight, Math.max(minHeight, scrollH))
        : Math.max(minHeight, scrollH);

      el.style.height = `${targetH}px`;
      el.style.overflowY = maxHeight && scrollH > maxHeight ? "auto" : "hidden";
    }, [minHeight, maxHeight]);

    React.useLayoutEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    return (
      <textarea
        ref={(node) => {
          textareaRef.current = node;
          if (typeof forwardedRef === "function") {
            forwardedRef(node);
          } else if (forwardedRef) {
            forwardedRef.current = node;
          }
        }}
        value={value}
        rows={rows}
        onChange={onChange}
        onInput={(e) => {
          adjustHeight();
          onInput?.(e);
        }}
        style={{
          ...style,
          resize: "none",
        }}
        className={cn("overflow-hidden transition-[height] duration-75", className)}
        {...props}
      />
    );
  }
);

AutoResizeTextarea.displayName = "AutoResizeTextarea";
