"use client";

import { useState, useEffect } from "react";
import { ProfileSetupModal } from "./profile-setup-modal";

/**
 * Client component that checks if the user's business profile is complete.
 * If not, and the account is 7+ days old, shows the setup modal.
 * Drop this anywhere in a server component page — it renders nothing visible
 * until the modal triggers.
 */
export function ProfileSetupTrigger() {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/business-profile");
        if (!res.ok) return;
        const profile = await res.json();

        if (cancelled) return;

        if (profile.profile_completed) return; // already done

        // Show after 7 days of account age
        const created = new Date(profile.created_at).getTime();
        const daysSinceSignup =
          (Date.now() - created) / (1000 * 60 * 60 * 24);

        if (daysSinceSignup >= 7) {
          setShowModal(true);
        }
      } catch {
        // silently ignore — profile table may not exist yet
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ProfileSetupModal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
    />
  );
}
