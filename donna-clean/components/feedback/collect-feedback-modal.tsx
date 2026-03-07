"use client";

import { X } from "lucide-react";
import { CustomerFeedbackForm } from "./customer-feedback-form";

interface Props {
  businessId: string;
  businessName: string;
  businessSlug: string;
  onClose: () => void;
}

export function CollectFeedbackModal({
  businessId,
  businessName,
  businessSlug,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-white flex flex-col"
      style={{ overscrollBehavior: "contain" }}
    >
      {/* Close button — top right */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={onClose}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      {/* Customer feedback flow fills the screen */}
      <div className="flex-1 overflow-y-auto">
        <CustomerFeedbackForm
          businessId={businessId}
          businessName={businessName}
          businessSlug={businessSlug}
          collectionMode="direct"
          onComplete={onClose}
        />
      </div>
    </div>
  );
}
