import { DeployButton } from "@/components/deploy-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { DesktopNav } from "@/components/navigation/desktop-nav";
import { hasEnvVars } from "@/lib/utils";

export function SiteHeader() {
  return (
    <nav className="hidden w-full md:flex justify-center border-b border-b-foreground/10 h-16 bg-card">
      <div className="w-full max-w-6xl flex justify-between items-center p-3 px-5 text-sm">
        {/* Desktop Navigation Links */}
        <DesktopNav />

        {/* Auth & Utility Buttons */}
        <div className="flex items-center gap-3">
          <DeployButton />
          {!hasEnvVars ? <EnvVarWarning /> : <AuthButton />}
        </div>
      </div>
    </nav>
  );
}
