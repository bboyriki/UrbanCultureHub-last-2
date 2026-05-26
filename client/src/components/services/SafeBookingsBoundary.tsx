import { Component, ReactNode } from "react";
import { Link } from "wouter";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Optional label shown in the fallback header. */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Wraps the booking / services UI so that a runtime crash inside any of the
 * downstream components shows a calm fallback page instead of taking the
 * whole app down with a white screen. Errors are still logged to the console
 * for debugging.
 */
export default class SafeBookingsBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[SafeBookingsBoundary] caught error:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        className="min-h-[60svh] flex flex-col items-center justify-center px-6 text-center"
        data-testid="bookings-error-fallback"
      >
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-5">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold mb-2 tracking-tight">
          {this.props.label ?? "Something went wrong loading your bookings"}
        </h2>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed mb-6">
          We couldn't display this page right now. The team has been notified —
          you can try again, or head back to the rest of the app.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => this.setState({ error: null })}
            data-testid="bookings-error-retry"
          >
            Try again
          </Button>
          <Button asChild data-testid="bookings-error-home">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to the app
            </Link>
          </Button>
        </div>
      </div>
    );
  }
}
