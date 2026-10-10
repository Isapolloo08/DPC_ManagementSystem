import type { FamilyPerson, FamilyRelationship } from "../../types";
export const familyTreeCardSize = { width: 224, height: 216 };
export function relativeLabel(
  person: number,
  focus: number,
  edges: FamilyRelationship[],
) {
  if (person === focus) return "Selected person";
  const parents = (id: number) =>
    edges
      .filter((e) => e.kind === "parent" && e.to_person_id === id)
      .map((e) => e.from_person_id);
  const children = (id: number) =>
    edges
      .filter((e) => e.kind === "parent" && e.from_person_id === id)
      .map((e) => e.to_person_id);
  if (
    edges.some(
      (e) =>
        e.kind === "spouse" &&
        [e.from_person_id, e.to_person_id].includes(person) &&
        [e.from_person_id, e.to_person_id].includes(focus),
    )
  )
    return "Spouse";
  const distance = (next: (id: number) => number[]) => {
    const pending = [{ id: focus, depth: 0 }],
      seen = new Set<number>();
    while (pending.length) {
      const current = pending.shift()!;
      if (current.id === person) return current.depth;
      if (seen.has(current.id)) continue;
      seen.add(current.id);
      pending.push(
        ...next(current.id).map((id) => ({ id, depth: current.depth + 1 })),
      );
    }
    return 0;
  };
  const up = distance(parents);
  if (up)
    return up === 1
      ? edges.find(
          (e) =>
            e.kind === "parent" &&
            e.from_person_id === person &&
            e.to_person_id === focus,
        )?.parent_role || "Parent"
      : up === 2
        ? "Grandparent"
        : `Ancestor (${up} generations)`;
  const down = distance(children);
  if (down)
    return down === 1
      ? "Child"
      : down === 2
        ? "Grandchild"
        : `Descendant (${down} generations)`;
  if (parents(person).some((id) => parents(focus).includes(id)))
    return "Sibling";
  return "";
}
export function familyTreeLayout(
  people: FamilyPerson[],
  edges: FamilyRelationship[],
) {
  const groups = new Map(people.map((p) => [p.id, p.id]));
  const root = (id: number): number => {
    let current = id;
    while (groups.get(current) !== current) current = groups.get(current)!;
    return current;
  };
  for (const edge of edges.filter((e) => e.kind === "spouse"))
    if (groups.has(edge.from_person_id) && groups.has(edge.to_person_id))
      groups.set(root(edge.to_person_id), root(edge.from_person_id));
  const ranks = new Map(people.map((p) => [root(p.id), 0]));
  for (let i = 0; i < people.length; i++) {
    let changed = false;
    for (const edge of edges.filter((e) => e.kind !== "spouse")) {
      const from = root(edge.from_person_id),
        to = root(edge.to_person_id);
      if (from !== to && ranks.get(to)! <= ranks.get(from)!) {
        ranks.set(to, Math.min(people.length, ranks.get(from)! + 1));
        changed = true;
      }
    }
    if (!changed) break;
  }
  const rows = new Map<number, FamilyPerson[]>();
  for (const person of people) {
    const rank = ranks.get(root(person.id))!;
    if (!rows.has(rank)) rows.set(rank, []);
    rows.get(rank)!.push(person);
  }
  const ordered = [...rows.entries()].sort((a, b) => a[0] - b[0]);
  const columnWidth = familyTreeCardSize.width + 32;
  const rowHeight = familyTreeCardSize.height + 64;
  const width = Math.max(
    480,
    ...ordered.map(([, row]) => row.length * columnWidth + 32),
  );
  const positions = new Map<number, { x: number; y: number }>();
  ordered.forEach(([, row], index) => {
    row.sort((a, b) => root(a.id) - root(b.id) || a.name.localeCompare(b.name));
    row.forEach((person, column) =>
      positions.set(person.id, {
        x: (width - row.length * columnWidth) / 2 + column * columnWidth + 16,
        y: index * rowHeight + 24,
      }),
    );
  });
  return { positions, width, height: Math.max(rowHeight, ordered.length * rowHeight) };
}
