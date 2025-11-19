"use client";

import { useEffect } from "react";

type VerifyEmailAlertProps = {
  shouldAlert: boolean;
};

export function VerifyEmailAlert({ shouldAlert }: VerifyEmailAlertProps) {
  useEffect(() => {
    if (!shouldAlert) {
      return;
    }

    if (typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert("Verify email");
    }
  }, [shouldAlert]);

  return null;
}
