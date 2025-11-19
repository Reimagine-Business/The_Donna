"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StatusMessage =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

export function UpdatePasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<StatusMessage>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (password.length < 8) {
      setStatus({
        type: "error",
        message: "Password must be at least 8 characters long.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setStatus({
        type: "error",
        message: "Passwords do not match.",
      });
      return;
    }

    setStatus(null);
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setStatus({
          type: "error",
          message: error.message,
        });
        return;
      }

      setStatus({
        type: "success",
        message: "Password updated! You can now sign in with your new password.",
      });
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.replace("/auth/login");
      }, 1200);
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to update password.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Update your password</CardTitle>
          <CardDescription>Choose a strong password you haven&apos;t used before.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
            </div>
            {status ? (
              <p
                className={cn(
                  "text-sm",
                  status.type === "success" ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {status.message}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save new password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
