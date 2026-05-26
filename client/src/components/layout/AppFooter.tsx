import { Link } from "wouter";
import { Shield, FileText, Scale } from "lucide-react";

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border/50 bg-background mt-auto">
      <div className="max-w-full mx-auto sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1140px] 2xl:max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div className="py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground order-2 sm:order-1">
            &copy; {year} Urban Culture Hub. All rights reserved.
          </p>

          <nav className="flex items-center gap-1 order-1 sm:order-2 flex-wrap justify-center" aria-label="Legal">
            <Link
              href="/privacy-policy"
              className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
              data-testid="link-privacy-policy"
            >
              <Shield className="w-3.5 h-3.5" />
              Privacy Policy
            </Link>
            <span className="text-muted-foreground/40 text-xs" aria-hidden="true">·</span>
            <Link
              href="/terms-of-service"
              className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
              data-testid="link-terms-of-service"
            >
              <FileText className="w-3.5 h-3.5" />
              Terms of Service
            </Link>
            <span className="text-muted-foreground/40 text-xs" aria-hidden="true">·</span>
            <Link
              href="/legal-hub"
              className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
              data-testid="link-legal-hub"
            >
              <Scale className="w-3.5 h-3.5" />
              Legal Hub
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
