import index from "@/data/atoms-index.json";

interface Atom {
  id: string;
  knowledge: string;
  topics: string[];
  type: string;
  confidence: string;
}

interface AtomsIndex {
  keywords: Record<string, { id: string; weight: number }[]>;
  atoms: Record<string, Atom>;
}

const typedIndex = index as AtomsIndex;

export function retrieveRelevantAtoms(input: string, maxResults = 5): Atom[] {
  const scores = new Map<string, number>();

  for (const [keyword, matches] of Object.entries(typedIndex.keywords)) {
    if (input.includes(keyword)) {
      for (const match of matches) {
        scores.set(match.id, (scores.get(match.id) || 0) + match.weight);
      }
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxResults)
    .map(([id]) => typedIndex.atoms[id])
    .filter(Boolean);
}
