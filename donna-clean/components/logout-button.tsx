"use client";

import { useTransition } from "react";

import { logoutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      onClick={() => {
        startTransition(() => {
          void logoutAction();
        });
      }}
      disabled={isPending}
    >
      {isPending ? "Logging out..." : "Logout"}
    </Button>
  );
}
