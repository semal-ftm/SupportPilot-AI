import { useEffect, useRef } from "react";
import clsx from "clsx";
import { ArrowUp, Loader2 } from "lucide-react";

export function Composer({ value, onChange, onSend, disabled, busy, placeholder, footer, autoFocus, className }) {
  const ref = useRef(null);

  // Grow with the content up to a sensible height
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const submit = () => {
    if (!value.trim() || disabled || busy) return;
    onSend(value);
  };

  return (
    <div className={className}>
      <div
        className={clsx(
          "flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-card transition-colors",
          "focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/15"
        )}
      >
        <textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={2000}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="max-h-44 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-[14px] text-ink outline-none placeholder:text-muted"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || disabled || busy}
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
          aria-label="Send"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" strokeWidth={2.5} />}
        </button>
      </div>
      {footer && <div className="mt-2 px-1 text-center text-[11px] text-muted">{footer}</div>}
    </div>
  );
}
