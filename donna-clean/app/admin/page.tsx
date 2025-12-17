import Link from "next/link";
import { Users, Database, Settings, FileText } from "lucide-react";

export default function AdminDashboard() {
  const adminSections = [
    {
      title: "User Management",
      description: "View and manage all registered users",
      href: "/admin/users",
      icon: Users,
      color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    {
      title: "System Diagnostics",
      description: "Check system health and database status",
      href: "/admin/diagnostics",
      icon: Database,
      color: "bg-green-500/20 text-green-400 border-green-500/30",
    },
    {
      title: "Migration Tools",
      description: "Run database migrations and updates",
      href: "/admin/migrate-entry-types",
      icon: Settings,
      color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="block p-6 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg border ${section.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {section.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {section.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 p-6 rounded-lg border border-yellow-500/30 bg-yellow-900/10">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-yellow-400 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-yellow-400 mb-1">Admin Access</h4>
            <p className="text-sm text-yellow-300/80">
              You are logged in as the system administrator. Only your account
              (reimaginebusiness2025@gmail.com) can access these admin functions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
