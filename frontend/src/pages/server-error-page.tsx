import type { FallbackProps } from "react-error-boundary";
import { ServerCrash, History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Full-page 5XX Server Error page.
 *
 * Rendered by the Admin `error` prop when an unhandled exception is caught by
 * the React error boundary. Shows a sanitised message in development mode only.
 */
export const ServerErrorPage = ({
  error,
  resetErrorBoundary,
}: FallbackProps) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error ?? "Unknown error");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center p-8">
      <ServerCrash className="h-20 w-20 text-destructive" />
      <h1 className="text-6xl font-bold tracking-tight text-foreground">
        500
      </h1>
      <p className="text-xl font-semibold">Server Error</p>
      <p className="max-w-md text-muted-foreground">
        Something went wrong on our end. Please try again later.
      </p>
      {process.env.NODE_ENV !== "production" && message && (
        <pre className="max-w-xl rounded-md bg-secondary p-4 text-left text-sm whitespace-pre-wrap break-all text-secondary-foreground">
          {message}
        </pre>
      )}
      <div className="flex gap-3 mt-4">
        <Button
          variant="outline"
          className="cursor-pointer"
          onClick={() => window.history.go(-1)}
        >
          <History className="mr-2 h-4 w-4" />
          Go Back
        </Button>
        <Button className="cursor-pointer" onClick={resetErrorBoundary}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  );
};
