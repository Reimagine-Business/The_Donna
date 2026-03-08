import { getBusinessBySlug } from "@/app/feedback/actions";
import { CustomerFeedbackForm } from "@/components/feedback/customer-feedback-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CustomerFeedbackPage({ params }: Props) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);

  if (!business) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Page not found</h1>
        <p className="text-gray-500">
          We couldn&apos;t find a business at this link. Please check the QR code or URL.
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #faf5ff 0%, #f0fdf4 100%)" }}
    >
      {/* Subtle brand bar */}
      <div
        className="w-full py-3 px-6 text-center"
        style={{ background: "rgba(124,58,237,0.08)" }}
      >
        <span className="text-violet-600 text-xs font-semibold tracking-wide uppercase">
          Customer Feedback
        </span>
      </div>

      <div className="flex-1 flex flex-col">
        <CustomerFeedbackForm
          businessId={business.id}
          businessName={business.business_name}
          businessSlug={business.business_slug}
          collectionMode="qr"
          categories={business.feedback_categories ?? undefined}
        />
      </div>
    </div>
  );
}
