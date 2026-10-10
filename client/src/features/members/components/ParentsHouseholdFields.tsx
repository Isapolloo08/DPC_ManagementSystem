import { useEffect, useRef, useState } from "react";
import { GitBranch, Plus, X } from "lucide-react";
import { api } from "../../../api";
import type { FamilyLinksInput, Household, Member } from "../../../types";
import { Button } from "../../../components/common/Button";

type ParentDraft = FamilyLinksInput["parents"][number] & { display: string };
export function ParentsHouseholdFields({
  memberId,
  households,
  members,
  onChange,
}: {
  memberId?: number;
  households: Household[];
  members: Member[];
  onChange: (value: FamilyLinksInput | undefined) => void;
}) {
  const [origin, setOrigin] = useState<number | null>(null),
    [parents, setParents] = useState<ParentDraft[]>([]),
    [loading, setLoading] = useState(!!memberId),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const requestVersion = useRef(0);
  const [warning, setWarning] = useState("");
  useEffect(
    () => () => {
      requestVersion.current++;
    },
    [],
  );
  useEffect(() => {
    let active = true;
    requestVersion.current++;
    onChange(undefined);
    setError("");
    setLoading(!!memberId);
    setOrigin(null);
    setParents([]);
    if (!memberId) {
      onChange({ parents_household_id: null, parents: [] });
      return;
    }
    api
      .getMemberParents(memberId)
      .then((value) => {
        if (active) {
          setOrigin(value.parents_household_id);
          setParents(
            value.parents.map((p) => ({
              person_id: p.person_id,
              role: p.role,
              display: p.name,
            })),
          );
          onChange({
            parents_household_id: value.parents_household_id,
            parents: value.parents.map((p) => ({
              person_id: p.person_id,
              role: p.role,
            })),
          });
        }
      })
      .catch((e) => {
        if (active) setError(e.message || "Could not load parent links");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [memberId, attempt, onChange]);
  const change = (next: ParentDraft[], household = origin) => {
    setParents(next);
    setOrigin(household);
    onChange({
      parents_household_id: household,
      parents: next.map(({ display, ...person }) => person),
    });
  };
  const selected = households.find((h) => h.id === origin);
  const selectHousehold = async (id: number | null) => {
    const version = ++requestVersion.current;
    setError("");
    setWarning("");
    setOrigin(id);
    if (!id) {
      change([], null);
      return;
    }
    setLoading(true);
    onChange(undefined);
    try {
      const household = households.find((h) => h.id === id)!;
      const tree = await api.getFamilyTree(id);
      if (version !== requestVersion.current) return;
      const next: ParentDraft[] = [];
      for (const role of ["father", "mother"] as const) {
        const name = household[`${role}_name`]?.trim();
        if (!name) continue;
        const entry = household.family_members?.find(
          (p) => [role, role === 'father' ? 'husband' : 'wife'].includes(p.relationship.toLowerCase()) && p.member_id,
        );
        const normalize = (n: string) =>
          n.trim().replace(/\s+/g, " ").toLowerCase();
        const matches = tree.people.filter((p) =>
          entry?.member_id
            ? p.member_id === entry.member_id
            : normalize(p.name) === normalize(name),
        );
        const person = matches.length === 1 ? matches[0] : undefined;
        if (person?.member_id === memberId) {
          throw new Error(
            "Choose your parents’ household, rather than a household where you are recorded as a parent.",
          );
        }
        if (person)
          next.push({ role, person_id: person.id, display: person.name });
        else {
          const registered = members.filter(
            (m) =>
              m.household_id === id &&
              normalize(`${m.first_name} ${m.last_name}`) === normalize(name),
          );
          if (entry?.member_id || registered.length === 1) {
            const id = entry?.member_id || registered[0].id;
            if (id === memberId)
              throw new Error(
                "Choose your parents’ household, rather than a household where you are recorded as a parent.",
              );
            next.push({ role, member_id: id, display: name });
          } else if (registered.length > 1 || matches.length > 1) {
            next.push({ role, name: "", display: name });
            setWarning(
              "More than one person has this name. Choose the correct registered parent in Change parent details.",
            );
          } else next.push({ role, name, display: name });
        }
      }
      change(next, id);
    } catch (e) {
      if (version === requestVersion.current)
        setError(
          e instanceof Error ? e.message : "Could not load household parents",
        );
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };
  return (
    <section
      className="space-y-3 p-4 rounded-2xl border border-indigo-200 bg-indigo-50/40"
      aria-label="Parents’ household"
    >
      <h3 className="font-semibold text-sm text-indigo-950 flex items-center gap-2">
        <GitBranch aria-hidden="true" className="w-4 h-4" />
        Parents’ household{" "}
        <span className="text-xs font-normal text-muted">Optional</span>
      </h3>
      <p className="ui-help">
        Choose the family you came from. Its recorded parents are filled in
        automatically; your current household and address stay the same.
      </p>
      {loading ? (
        <p role="status" className="ui-help">
          Loading parent links…
        </p>
      ) : error ? (
        <div role="alert" className="space-y-2 text-rose-700 text-sm">
          <p>{error}</p>
          <Button
            onClick={() =>
              origin ? selectHousehold(origin) : setAttempt((a) => a + 1)
            }
          >
            Retry parent links
          </Button>
          {origin && (
            <Button
              onClick={() => {
                setError("");
                change([], null);
              }}
            >
              Choose another household
            </Button>
          )}
        </div>
      ) : (
        <>
          <label className="ui-field">
            Parents’ registered household
            <select
              className="ui-input mt-1"
              value={origin || ""}
              onChange={(e) =>
                selectHousehold(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">No household selected</option>
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                  {h.address ? ` · ${h.address}` : ""}
                </option>
              ))}
            </select>
          </label>
          {warning && (
            <p role="status" className="ui-help">
              {warning}
            </p>
          )}
          {!!parents.length && (
            <div
              className="grid sm:grid-cols-2 gap-2"
              aria-label="Recorded parents"
            >
              {parents.map((parent, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-indigo-100 bg-white p-3"
                >
                  <p className="text-xs text-muted capitalize">{parent.role}</p>
                  <p className="font-medium text-sm text-indigo-950 mt-1">
                    {parent.display || "Choose a parent"}
                  </p>
                </div>
              ))}
            </div>
          )}
          {selected && !parents.length && (
            <p className="ui-help">
              No father or mother recorded in this household yet. Add them
              below.
            </p>
          )}
          <details
            className="rounded-xl border border-indigo-100 bg-white p-3"
            open={warning ? true : undefined}
          >
            <summary className="text-sm font-medium text-indigo-950 cursor-pointer">
              {parents.length ? "Change parent details" : "Add parent details"}
            </summary>
            <div className="mt-3 space-y-3">
              {parents.map((parent, index) => (
                <div
                  key={index}
                  className="space-y-2 border-t border-indigo-100 pt-3"
                >
                  <div className="flex items-center gap-2">
                    <label className="ui-field flex-1">
                      Parent role
                      <select
                        aria-label={`Parent role ${index + 1}`}
                        className="ui-input mt-1"
                        value={parent.role}
                        onChange={(e) =>
                          change(
                            parents.map((p, i) =>
                              i === index
                                ? {
                                    ...p,
                                    role: e.target.value as ParentDraft["role"],
                                  }
                                : p,
                            ),
                          )
                        }
                      >
                        <option value="father">Father</option>
                        <option value="mother">Mother</option>
                        <option value="parent">Parent</option>
                      </select>
                    </label>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove parent ${index + 1}`}
                      onClick={() =>
                        change(parents.filter((_, i) => i !== index))
                      }
                    >
                      <X aria-hidden="true" className="w-4 h-4" />
                    </Button>
                  </div>
                  <label className="ui-field">
                    Registered parent
                    <select
                      aria-label={`Registered parent ${index + 1}`}
                      className="ui-input mt-1"
                      value={
                        parent.member_id || (parent.person_id ? "recorded" : "")
                      }
                      onChange={(e) => {
                        const member = members.find(
                          (m) => m.id === Number(e.target.value),
                        );
                        change(
                          parents.map((p, i) =>
                            i === index
                              ? member
                                ? {
                                    role: p.role,
                                    member_id: member.id,
                                    display: `${member.first_name} ${member.last_name}`,
                                  }
                                : {
                                    role: p.role,
                                    name: p.display,
                                    display: p.display,
                                  }
                              : p,
                          ),
                        );
                      }}
                    >
                      <option value="">Enter an unregistered relative</option>
                      {parent.person_id && (
                        <option value="recorded">
                          {parent.display} · recorded parent
                        </option>
                      )}
                      {members
                        .filter((m) => m.id !== memberId)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.first_name} {m.last_name} ·{" "}
                            {m.birthdate?.slice(0, 10)} ·{" "}
                            {households.find((h) => h.id === m.household_id)
                              ?.name || "No household"}
                          </option>
                        ))}
                    </select>
                  </label>
                  {!parent.person_id && !parent.member_id && (
                    <label className="ui-field">
                      Relative’s name
                      <input
                        aria-label={`Parent name ${index + 1}`}
                        required
                        maxLength={255}
                        className="ui-input mt-1"
                        value={parent.name || ""}
                        onChange={(e) =>
                          change(
                            parents.map((p, i) =>
                              i === index
                                ? {
                                    ...p,
                                    name: e.target.value,
                                    display: e.target.value,
                                  }
                                : p,
                            ),
                          )
                        }
                      />
                    </label>
                  )}
                </div>
              ))}
              <Button
                size="sm"
                onClick={() =>
                  change([
                    ...parents,
                    {
                      role: !parents.some((p) => p.role === "father")
                        ? "father"
                        : !parents.some((p) => p.role === "mother")
                          ? "mother"
                          : "parent",
                      name: "",
                      display: "",
                    },
                  ])
                }
              >
                <Plus aria-hidden="true" className="w-4 h-4" />
                Add parent
              </Button>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
