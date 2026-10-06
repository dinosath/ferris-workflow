import { SearchX, History } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Full-page 404 Not Found error page.
 *
 * Rendered by the Admin `catchAll` prop when no route matches the current URL.
 */
export const NotFoundPage = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center p-8">
    <SearchX className="h-20 w-20 text-muted-foreground" />
    <h1 className="text-6xl font-bold tracking-tight text-foreground">404</h1>
    <p className="text-xl font-semibold">Page Not Found</p>
    <p className="max-w-md text-muted-foreground">
      The page you are looking for does not exist or has been moved.
    </p>
    <Button
      className="mt-4 cursor-pointer"
      onClick={() => window.history.go(-1)}
    >
      <History className="mr-2 h-4 w-4" />
      Go Back
    </Button>
  </div>
);
