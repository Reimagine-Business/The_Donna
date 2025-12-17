import { requireAdmin } from "@/lib/admin/check-admin";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // CRITICAL: Only reimaginebusiness2025@gmail.com can access
  // This checks both email AND role
  await requireAdmin();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">System administration and management</p>
        </div>
      </div>
      <div className="container mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  );
}
