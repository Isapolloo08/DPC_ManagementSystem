import { useEffect, useState } from "react";
import type { Member } from "../../../types";
import { memberRegistrationService, registrationError } from "../services/memberRegistrationService";

type DuplicateState = { status: "idle" | "loading" } | { status: "success"; member: Member | null } | { status: "error"; error: string };

export function useMemberDuplicateCheck(name: string, excludeId: number | undefined, enabled: boolean) {
  const trimmed = name.trim();
  const [attempt, setAttempt] = useState(0);
  const key = `${enabled}:${excludeId}:${trimmed}:${attempt}`;
  const [request, setRequest] = useState<{ key: string; state: DuplicateState }>({ key, state: { status: "idle" } });
  useEffect(() => {
    let current = true;
    if (!enabled || trimmed.length < 2) {
      setRequest({ key, state: { status: "idle" } });
      return;
    }
    setRequest({ key, state: { status: "loading" } });
    const timer = setTimeout(async () => {
      try {
        const member = await memberRegistrationService.checkDuplicate(trimmed, excludeId);
        if (current) setRequest({ key, state: { status: "success", member } });
      } catch (error) {
        if (current) setRequest({ key, state: { status: "error", error: registrationError(error, "Could not check this name. Please retry.") } });
      }
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [key, trimmed, excludeId, enabled]);
  const state: DuplicateState = !enabled || trimmed.length < 2 ? { status: "idle" }
    : request.key === key ? request.state : { status: "loading" };
  return { state, retry: () => setAttempt(value => value + 1) };
}
