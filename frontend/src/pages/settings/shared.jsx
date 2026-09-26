import { CheckCircle2, XCircle } from "lucide-react";
import clsx from "clsx";
import { Card } from "../../components/ui";

export function Section({ title, description, children, className }) {
  return (
    <Card className={clsx("p-5 sm:p-6", className)}>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/** Green or red message box shown after a "Test" button. */
export function TestResult({ result }) {
  if (!result) return null;

  return (
    <div
      className={clsx(
        "animate-in mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm",
        result.success ? "bg-good-soft text-good" : "bg-bad-soft text-bad"
      )}
    >
      {result.success ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
      <span>{result.message}</span>
    </div>
  );
}

export function Hint({ children }) {
  return <p className="mt-1 text-xs text-muted">{children}</p>;
}
