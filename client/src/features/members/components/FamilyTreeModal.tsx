import { useEffect, useRef, useState } from "react";
import {
  GitBranch,
  House,
  List,
  Minus,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { api } from "../../../api";
import type {
  FamilyPerson,
  FamilyPersonInput,
  FamilyRelationship,
  FamilyTreeResponse,
  Household,
  Member,
} from "../../../types";
import { Button } from "../../../components/common/Button";
import { ViewportOverlay } from "../../../components/common/ViewportOverlay";
import { useDialogFocus } from "../../../hooks/useDialogFocus";
import { familyTreeCardSize, familyTreeLayout, relativeLabel } from "../familyTreeLayout";
import { useSocketEvent } from "../../../socket";

const edgeLabel = (edge: FamilyRelationship) =>
  edge.kind === "parent"
    ? `${edge.parent_role} → child`
    : edge.kind === "guardian"
      ? "Guardian → dependent"
      : "Spouses";
export function FamilyTreeModal({
  household,
  members,
  households,
  onClose,
}: {
  household: Household;
  members: Member[];
  households: Household[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<FamilyTreeResponse | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0),
    [zoom, setZoom] = useState(1),
    [list, setList] = useState(false),
    [manage, setManage] = useState(false);
  const [extended, setExtended] = useState(false);
  useSocketEvent("households:changed", () => setAttempt(a => a + 1));
  useSocketEvent("members:changed", () => setAttempt(a => a + 1));
  const [selected, setSelected] = useState(0),
    [relation, setRelation] = useState("father"),
    [other, setOther] = useState(""),
    [name, setName] = useState(""),
    [namedHousehold, setNamedHousehold] = useState(household.id);
  const [editing, setEditing] = useState<number | undefined>(),
    [remove, setRemove] = useState<FamilyRelationship | null>(null),
    [linkMember, setLinkMember] = useState("");
  useDialogFocus(ref, onClose, busy);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .getFamilyTree(household.id, extended)
      .then((value) => {
        if (active) {
          setData(value);
          setSelected((previous) =>
            value.people.some((p) => p.id === previous)
              ? previous
              : value.people.find((p) => p.household_id === household.id)?.id ||
                value.people[0]?.id ||
                0,
          );
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [household.id, attempt, extended]);
  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      setMessage(success);
      setAttempt((a) => a + 1);
      setEditing(undefined);
      setRemove(null);
      setOther("");
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save relationships");
    } finally {
      setBusy(false);
    }
  };
  const people = data?.people || [],
    edges = data?.relationships || [];
  const householdGroups = [...new Set([household.id, ...people.map(p => p.household_id)])]
    .map(id => ({
      id,
      name: id === household.id
        ? household.name
        : households.find(h => h.id === id)?.name || people.find(p => p.household_id === id)?.household_name || "Household not recorded",
      people: people.filter(p => p.household_id === id),
    }));
  const householdLabel = (id: number | null) => id === household.id
    ? "This household"
    : id === null ? "No household" : "Other household";
  const householdStyle = (id: number | null) => id === household.id
    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
    : id === null ? "bg-gray-50 border-gray-200 text-muted" : "bg-amber-50 border-amber-200 text-amber-800";
  const recordedHouseholdRole = (person: FamilyPerson) => {
    const couple = data?.legacy_suggestions?.family_members?.find(entry => ['Husband','Wife'].includes(entry.relationship) && (entry.member_id ? entry.member_id === person.member_id : entry.name.trim().toLowerCase() === person.name.trim().toLowerCase()) && person.household_id === household.id);
    if (couple) return couple.relationship.toLowerCase();
    return (["father", "mother", "guardian"] as const).find(role => {
    const entry = data?.legacy_suggestions?.family_members?.find(entry => entry.relationship.toLowerCase() === role && entry.member_id === person.member_id && person.member_id);
    return !!entry || (person.name.trim().toLowerCase() === String(data?.legacy_suggestions?.[`${role}_name`] || "").trim().toLowerCase() && person.household_id === household.id);
    });
  };
  const connected = people.filter((p) =>
    edges.some((e) => e.from_person_id === p.id || e.to_person_id === p.id) || !!recordedHouseholdRole(p),
  );
  const disconnected = people.filter((p) => !connected.includes(p));
  const layout = familyTreeLayout(connected, edges);
  const activePerson = people.find((p) => p.id === selected);
  const legacyNames = [
    data?.legacy_suggestions?.father_name,
    data?.legacy_suggestions?.mother_name,
    data?.legacy_suggestions?.guardian_name,
    ...(data?.legacy_suggestions?.family_members || [])
      .filter((p) => !p.member_id)
      .map((p) => p.name),
  ].filter((name): name is string => !!name?.trim());
  const pendingNames = [...new Set(legacyNames)].filter(
    (name) => !people.some((person) => person.name === name),
  );
  const reset = () => {
    setZoom(1);
    canvas.current?.scrollTo({ left: 0, top: 0 });
  };
  const personCard = (person: FamilyPerson) => {
    const roles = [
      ...new Set(
        edges
          .filter(
            (e) =>
              e.from_person_id === person.id || e.to_person_id === person.id,
          )
          .map((e) =>
            e.kind === "spouse"
              ? "Spouse"
              : e.kind === "guardian"
                ? e.from_person_id === person.id
                  ? "Guardian"
                  : "Dependent"
                : e.from_person_id === person.id
                  ? e.parent_role!
                  : "Child",
          ),
      ),
    ];
    return (
      <button
        type="button"
        disabled={busy}
        aria-pressed={selected === person.id}
        onClick={() => {
          setSelected(person.id);
          setEditing(undefined);
          setOther("");
          setName("");
          setLinkMember("");
        }}
        data-family-person={person.id}
        data-household-id={person.household_id ?? "none"}
        style={{ minHeight: familyTreeCardSize.height }}
        className={`w-full h-full flex flex-col text-left p-3 rounded-2xl bg-white border-2 ${selected === person.id ? "border-indigo-400 ring-2 ring-indigo-200" : person.household_id === household.id ? "border-indigo-200" : person.household_id === null ? "border-gray-200" : "border-amber-200"} text-charcoal hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2`}
      >
        <span className={`inline-flex self-start items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${householdStyle(person.household_id)}`}>
          <House aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
          {householdLabel(person.household_id)}
        </span>
        <div className="flex items-center gap-2 mt-2 min-h-10">
          <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 shrink-0 overflow-hidden flex items-center justify-center">
            {person.photo_url ? (
              <img
                src={person.photo_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-semibold">
                {person.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")}
              </span>
            )}
          </div>
          <span
            title={person.name}
            className="text-sm font-semibold break-words min-w-0 line-clamp-2"
          >
            {person.name}
          </span>
        </div>
        <p className="text-xs text-indigo-700 capitalize mt-2 truncate w-full">
          {recordedHouseholdRole(person) || relativeLabel(person.id, selected, edges) ||
            roles.join(" · ") ||
            "Relationship not recorded"}
        </p>
        <p
          className="text-sm font-semibold mt-1 break-words line-clamp-2"
          title={householdGroups.find(group => group.id === person.household_id)?.name}
        >
          {householdGroups.find(group => group.id === person.household_id)?.name}
        </p>
        <p className="text-xs text-muted mt-auto pt-2">
          {person.member_id ? "Registered member" : "Unregistered relative"}
        </p>
      </button>
    );
  };
  const save = () => {
    let target: FamilyPersonInput;
    if (other.startsWith("p:")) target = { person_id: Number(other.slice(2)) };
    else if (other.startsWith("m:"))
      target = { member_id: Number(other.slice(2)) };
    else target = { name: name.trim(), household_id: namedHousehold || null };
    const selectedInput = { person_id: selected };
    const parent = ["father", "mother", "parent"].includes(relation);
    const payload = {
      from: parent || relation === "guardian" ? target : selectedInput,
      to: parent || relation === "guardian" ? selectedInput : target,
      kind: (parent || relation === "child" ? "parent" : relation) as
        | "parent"
        | "guardian"
        | "spouse",
      parent_role: parent
        ? relation
        : relation === "child"
          ? "parent"
          : undefined,
    };
    void run(
      () => api.saveFamilyRelationship(payload, editing),
      "Family relationship saved.",
    );
  };
  const edit = (edge: FamilyRelationship) => {
    setRemove(null);
    setEditing(edge.id);
    setSelected(edge.to_person_id);
    setOther(`p:${edge.from_person_id}`);
    setRelation(edge.kind === "parent" ? edge.parent_role! : edge.kind);
    setManage(true);
  };
  return (
    <ViewportOverlay className="z-[120] bg-slate-950/70 backdrop-blur-sm p-3 sm:p-5 flex items-center justify-center">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="family-tree-title"
        data-modal-panel
        className="bg-white text-charcoal rounded-3xl border border-indigo-100 shadow-2xl w-full max-w-6xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden"
      >
        <header
          data-modal-header
          className="p-4 sm:p-5 border-b border-gray-200 flex items-center gap-3 shrink-0"
        >
          <GitBranch aria-hidden="true" className="w-6 h-6 text-indigo-700" />
          <div className="flex-1 min-w-0">
            <h2
              id="family-tree-title"
              className="font-semibold text-lg text-indigo-950"
            >
              Family Tree
            </h2>
            <p className="ui-help break-words">
              {household.name} · {extended ? "Linked family across households" : "This household only"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label="Close family tree"
            onClick={onClose}
          >
            <X aria-hidden="true" className="w-5 h-5" />
          </Button>
        </header>
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-2 shrink-0">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm cursor-pointer">
            <input type="checkbox" checked={extended} disabled={busy} onChange={event => {setExtended(event.target.checked);setZoom(1);setEditing(undefined);setRemove(null);}} className="accent-indigo-700 w-4 h-4" />
            Include linked parents & relatives
          </label>
          <Button aria-pressed={list} onClick={() => setList(!list)}>
            <List aria-hidden="true" className="w-4 h-4" />
            {list ? "Show tree" : "List view"}
          </Button>
          <Button aria-pressed={manage} onClick={() => setManage(!manage)}>
            <Settings2 aria-hidden="true" className="w-4 h-4" />
            Manage Relationships
          </Button>
          {!list && (
            <>
              <Button
                size="icon"
                aria-label="Zoom out"
                disabled={zoom <= 0.5}
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
              >
                <Minus aria-hidden="true" className="w-4 h-4" />
              </Button>
              <span className="text-sm self-center tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                size="icon"
                aria-label="Zoom in"
                disabled={zoom >= 1.5}
                onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
              >
                <Plus aria-hidden="true" className="w-4 h-4" />
              </Button>
              <Button onClick={reset}>
                <RotateCcw aria-hidden="true" className="w-4 h-4" />
                Reset view
              </Button>
            </>
          )}
        </div>
        <div data-modal-body className="min-h-0 overflow-y-auto p-4 space-y-4">
          {error && (
            <div
              role="alert"
              className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2"
            >
              <p>{error}</p>
              {!data && (
                <Button onClick={() => setAttempt((a) => a + 1)}>
                  Retry family tree
                </Button>
              )}
            </div>
          )}
          {message && (
            <p role="status" className="text-sm text-emerald-700">
              {message}
            </p>
          )}
          {loading && (
            <p role="status" className="ui-help">
              Loading family tree…
            </p>
          )}
          {data && (
            <div
              className={
                manage
                  ? "grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4"
                  : "space-y-4"
              }
            >
              <section
                className="min-w-0 space-y-4"
                aria-label="Family connections"
              >
                <section aria-label="Households in this view" className="space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold text-indigo-950">Households in this view</h3>
                    <p className="ui-help">Each person’s badge shows where they belong. Family lines connect relatives across households.</p>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {householdGroups.map(group => (
                      <li key={group.id ?? "none"} className={`flex items-start gap-2 rounded-xl border px-3 py-2 min-w-0 max-w-full ${householdStyle(group.id)}`}>
                        <House aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs">{householdLabel(group.id)} · {group.people.length} {group.people.length === 1 ? "person" : "people"}</p>
                          <p className="text-sm font-semibold break-words">{group.name}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
                {!connected.length && (
                  <div className="p-6 border border-gray-200 rounded-2xl text-center">
                    <GitBranch
                      aria-hidden="true"
                      className="w-8 h-8 text-indigo-700 mx-auto mb-2"
                    />
                    <p className="font-medium">
                      No confirmed relationships yet
                    </p>
                    <p className="ui-help mt-1">
                      Choose Manage Relationships to connect parents, spouses,
                      and children.
                    </p>
                  </div>
                )}
                {list ? (
                  <div className="space-y-4">
                    {householdGroups.map(group => {
                      const groupPeople = connected.filter(p => p.household_id === group.id);
                      if (!groupPeople.length) return null;
                      return (
                        <section key={group.id ?? "none"} aria-label={`${group.name} family members`} className="space-y-3">
                          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-indigo-950">
                            {group.name}
                            <span className={`rounded-md border px-2 py-0.5 text-xs ${householdStyle(group.id)}`}>{householdLabel(group.id)}</span>
                          </h3>
                          <ul className="grid sm:grid-cols-2 gap-3">
                            {groupPeople.map(p => <li key={p.id}>{personCard(p)}</li>)}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  connected.length > 0 && (
                    <div
                      ref={canvas}
                      tabIndex={0}
                      aria-label="Scrollable family tree"
                      className="overflow-auto max-h-[55vh] bg-gray-50 border border-gray-200 rounded-2xl"
                    >
                      <div
                        style={{
                          width: layout.width * zoom,
                          height: layout.height * zoom,
                          marginInline: "auto",
                        }}
                      >
                        <div
                          className="relative"
                          style={{
                            width: layout.width,
                            height: layout.height,
                            transform: `scale(${zoom})`,
                            transformOrigin: "top left",
                          }}
                        >
                          <svg
                            aria-hidden="true"
                            className="absolute inset-0 text-indigo-400 pointer-events-none"
                            width={layout.width}
                            height={layout.height}
                          >
                            {edges.map((edge) => {
                              const a = layout.positions.get(
                                  edge.from_person_id,
                                ),
                                b = layout.positions.get(edge.to_person_id);
                              if (!a || !b) return null;
                              const spouse = edge.kind === "spouse";
                              const x1 = a.x + familyTreeCardSize.width / 2,
                                y1 = a.y + (spouse ? familyTreeCardSize.height / 2 : familyTreeCardSize.height),
                                x2 = b.x + familyTreeCardSize.width / 2,
                                y2 = b.y + (spouse ? familyTreeCardSize.height / 2 : 0);
                              return (
                                <path
                                  key={edge.id}
                                  d={
                                    spouse
                                      ? `M ${x1} ${y1} L ${x2} ${y2}`
                                      : `M ${x1} ${y1} V ${(y1 + y2) / 2} H ${x2} V ${y2}`
                                  }
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeDasharray={
                                    edge.kind === "guardian" ? "6 4" : undefined
                                  }
                                />
                              );
                            })}
                          </svg>
                          {connected.map((person) => {
                            const pos = layout.positions.get(person.id)!;
                            return (
                              <div
                                key={person.id}
                                className="absolute"
                                style={{
                                  left: pos.x,
                                  top: pos.y,
                                  width: familyTreeCardSize.width,
                                  height: familyTreeCardSize.height,
                                }}
                              >
                                {personCard(person)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )
                )}
                {(list || manage) && edges.length > 0 && (
                  <ul
                    className="space-y-2 text-xs"
                    aria-label="Recorded relationships"
                  >
                    {edges.map((edge) => (
                      <li
                        key={edge.id}
                        className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2"
                      >
                        <span className="flex-1 capitalize">
                          {
                            people.find((p) => p.id === edge.from_person_id)
                              ?.name
                          }{" "}
                          · {edgeLabel(edge)} ·{" "}
                          {people.find((p) => p.id === edge.to_person_id)?.name}
                        </span>
                        {manage && (
                          <>
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => edit(edge)}
                            >
                              Edit relationship
                            </Button>
                            <Button
                              size="icon"
                              disabled={busy}
                              variant="ghost"
                              aria-label={`Remove relationship ${edge.id}`}
                              onClick={() => setRemove(edge)}
                            >
                              <Trash2 aria-hidden="true" className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {disconnected.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-indigo-950">
                      Relationships not yet recorded
                    </h3>
                    <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {disconnected.map((p) => (
                        <li key={p.id}>{personCard(p)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {pendingNames.length > 0 && (
                  <section
                    className="space-y-2 border-t border-gray-200 pt-3"
                    aria-label="Household names awaiting confirmation"
                  >
                    <h3 className="text-sm font-semibold text-indigo-950">
                      Household names awaiting confirmation
                    </h3>
                    <p className="ui-help">
                      These names were recorded in the household. Choose their
                      relationship explicitly before adding them to the tree.
                    </p>
                    {pendingNames.map((name) => (
                      <div
                        key={name}
                        className="flex flex-wrap gap-2 items-center text-sm"
                      >
                        <span className="flex-1">{name}</span>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setManage(true);
                            setEditing(undefined);
                            setOther("");
                            setName(name);
                            setRelation("parent");
                          }}
                        >
                          Use name in relationship form
                        </Button>
                      </div>
                    ))}
                  </section>
                )}
              </section>
              {manage && (
                <section
                  aria-label="Manage family relationships"
                  className="space-y-4 p-4 border border-indigo-100 rounded-2xl self-start"
                >
                  <h3 className="font-semibold text-indigo-950 flex items-center gap-2">
                    <UserRound aria-hidden="true" className="w-4 h-4" />
                    Manage Relationships
                  </h3>
                  {remove && (
                    <div
                      role="alert"
                      className="space-y-2 bg-rose-50 border border-rose-200 p-3 rounded-xl text-sm"
                    >
                      <p>
                        Remove this relationship? Both people and their records
                        will remain.
                      </p>
                      <Button
                        pending={busy}
                        onClick={() =>
                          void run(
                            () => api.removeFamilyRelationship(remove.id),
                            "Relationship removed.",
                          )
                        }
                      >
                        Remove link
                      </Button>
                      <Button disabled={busy} onClick={() => setRemove(null)}>
                        Keep link
                      </Button>
                    </div>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      save();
                    }}
                    className="space-y-3"
                  >
                    <label className="ui-field">
                      Family person
                      <select
                        required
                        disabled={busy || !!editing}
                        className="ui-input mt-1"
                        value={selected || ""}
                        onChange={(e) => {
                          setSelected(Number(e.target.value));
                          setLinkMember("");
                        }}
                      >
                        <option value="">Select a person</option>
                        {people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="ui-field">
                      {editing ? "Relationship to edit" : "Add their"}
                      <select
                        className="ui-input mt-1"
                        disabled={busy}
                        value={relation}
                        onChange={(e) => setRelation(e.target.value)}
                      >
                        <option value="father">Father</option>
                        <option value="mother">Mother</option>
                        <option value="parent">Parent</option>
                        <option value="child">Child</option>
                        <option value="spouse">Spouse</option>
                        <option value="guardian">Guardian</option>
                      </select>
                    </label>
                    <label className="ui-field">
                      Related person
                      <select
                        className="ui-input mt-1"
                        disabled={busy}
                        value={other}
                        onChange={(e) => setOther(e.target.value)}
                      >
                        <option value="">Enter an unregistered relative</option>
                        {people
                          .filter((p) => p.id !== selected)
                          .map((p) => (
                            <option key={`p${p.id}`} value={`p:${p.id}`}>
                              {p.name} · {p.household_name || "No household"}
                            </option>
                          ))}
                        {members
                          .filter(
                            (m) => !people.some((p) => p.member_id === m.id),
                          )
                          .map((m) => (
                            <option key={`m${m.id}`} value={`m:${m.id}`}>
                              {m.first_name} {m.last_name} ·{" "}
                              {m.birthdate?.slice(0, 10)} ·{" "}
                              {households.find((h) => h.id === m.household_id)
                                ?.name || "No household"}
                            </option>
                          ))}
                      </select>
                    </label>
                    {!other && (
                      <>
                        <label className="ui-field">
                          Relative’s name
                          <input
                            required
                            maxLength={255}
                            disabled={busy}
                            className="ui-input mt-1"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                          />
                        </label>
                        <label className="ui-field">
                          Relative’s household
                          <select
                            disabled={busy}
                            className="ui-input mt-1"
                            value={namedHousehold || ""}
                            onChange={(e) =>
                              setNamedHousehold(Number(e.target.value))
                            }
                          >
                            <option value="">Unknown household</option>
                            {households.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                    <p className="ui-help">
                      Only this relationship changes. Household assignments stay
                      the same.
                    </p>
                    <Button
                      type="submit"
                      variant="primary"
                      pending={busy}
                      disabled={!selected || loading}
                    >
                      {editing
                        ? "Save relationship changes"
                        : "Save relationship"}
                    </Button>
                    {editing && (
                      <Button
                        disabled={busy}
                        onClick={() => {
                          setEditing(undefined);
                          setOther("");
                        }}
                      >
                        Cancel edit
                      </Button>
                    )}
                  </form>
                  {activePerson && !activePerson.member_id && (
                    <div className="border-t border-gray-200 pt-3 space-y-3">
                      <p className="ui-help">
                        Link {activePerson.name} to their registered member
                        record. Review the identity before confirming.
                      </p>
                      <label className="ui-field">
                        Registered member
                        <select
                          className="ui-input mt-1"
                          value={linkMember}
                          disabled={busy}
                          onChange={(e) => setLinkMember(e.target.value)}
                        >
                          <option value="">Choose member</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.first_name} {m.last_name} ·{" "}
                              {m.birthdate?.slice(0, 10)} ·{" "}
                              {households.find((h) => h.id === m.household_id)
                                ?.name || "No household"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button
                        pending={busy}
                        disabled={!linkMember}
                        onClick={() =>
                          void run(
                            () =>
                              api.linkFamilyPerson(
                                activePerson.id,
                                Number(linkMember),
                              ),
                            "Relative linked to registered member.",
                          )
                        }
                      >
                        Confirm member link
                      </Button>
                    </div>
                  )}
                  <p className="ui-help">
                    Husband and Wife connect as spouses. Recorded children connect
                    to them as parents; guardians connect separately. These roles
                    come from Edit Household & Family, including named relatives. Other roles need explicit family
                    links. Manual corrections are preserved.
                  </p>
                  {(data.legacy_suggestions?.father_name ||
                    data.legacy_suggestions?.mother_name) && (
                    <p className="ui-help">
                      Recorded household names:{" "}
                      {[
                        data.legacy_suggestions.father_name,
                        data.legacy_suggestions.mother_name,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
        <footer
          data-modal-footer
          className="p-4 border-t border-gray-200 flex justify-end shrink-0"
        >
          <Button disabled={busy} onClick={onClose}>
            Close
          </Button>
        </footer>
      </div>
    </ViewportOverlay>
  );
}
