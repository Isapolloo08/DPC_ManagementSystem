import { useEffect, useState } from "react";
import { memberRegistrationService, registrationError, type MemberSearchResult } from "../services/memberRegistrationService";

type SearchState = { status: "loading" } | { status: "success"; result: MemberSearchResult } | { status: "error"; error: string };

export function useRelativeMemberSearch(query: string, sourceMemberId: number) {
  const [attempt, setAttempt] = useState(0);
  const key = `${sourceMemberId}:${query}:${attempt}`;
  const [request, setRequest] = useState<{ key: string; state: SearchState }>({ key, state: { status: "loading" } });
  useEffect(() => {
    let current = true;
    setRequest({ key, state: { status: "loading" } });
    const timer = setTimeout(async () => {
      try {
        const result = await memberRegistrationService.search(query, sourceMemberId);
        if (current) setRequest({ key, state: { status: "success", result } });
      } catch (error) {
        if (current) setRequest({ key, state: { status: "error", error: registrationError(error, "Could not check existing members. Please retry.") } });
      }
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [key, query, sourceMemberId]);
  // Hide a previous query's candidates immediately, before its effect cleans up.
  const state: SearchState = request.key === key ? request.state : { status: "loading" };
  return { state, retry: () => setAttempt(value => value + 1) };
}
