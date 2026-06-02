import * as fs from "fs";
import * as path from "path";

interface Atom {
  id: string;
  knowledge: string;
  original?: string;
  url?: string;
  date?: string;
  topics: string[];
  skills: string[];
  type: string;
  confidence: string;
}

interface AtomsIndex {
  keywords: Record<string, { id: string; weight: number }[]>;
  atoms: Record<string, Atom>;
}

// Chinese stop words to skip when extracting keywords
const STOP_WORDS = new Set([
  "的", "了", "是", "在", "我", "有", "和", "就", "不", "人", "都", "一",
  "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着",
  "没有", "看", "好", "自己", "这", "他", "她", "它", "们", "那", "些",
  "什么", "怎么", "如何", "为什么", "因为", "所以", "但是", "可以", "这个",
  "那个", "还是", "只是", "如果", "虽然", "不过", "然后", "已经", "还",
  "让", "把", "被", "从", "对", "与", "或", "及", "等", "其", "其中",
  "进行", "通过", "需要", "应该", "能够", "可能", "对于", "关于", "以及",
]);

function extractKeywords(text: string): string[] {
  // Extract meaningful 2-4 character Chinese phrases
  const words = new Set<string>();
  const cleaned = text.replace(/[^一-龥a-zA-Z0-9]/g, "");

  for (let i = 0; i < cleaned.length - 1; i++) {
    for (let len = 2; len <= 4; len++) {
      if (i + len <= cleaned.length) {
        const phrase = cleaned.slice(i, i + len);
        if (!STOP_WORDS.has(phrase) && phrase.length >= 2) {
          words.add(phrase);
        }
      }
    }
  }
  return [...words];
}

function buildIndex(): AtomsIndex {
  const atomsPath = path.resolve(
    "/Users/hello/Downloads/dbskill-main/知识库/原子库/atoms.jsonl"
  );
  const lines = fs.readFileSync(atomsPath, "utf-8").trim().split("\n");

  const allAtoms: Atom[] = lines.map((line) => JSON.parse(line) as Atom);

  // Filter: content-related topics + high confidence + actionable types
  const usefulTypes = new Set(["principle", "method", "tool", "insight"]);
  const contentTopics = [
    "内容创作与平台",
    "语言与思维",
  ];

  const filtered = allAtoms.filter((atom) => {
    const hasContentTopic = atom.topics.some((t) => contentTopics.includes(t));
    const highConfidence = atom.confidence === "high";
    const goodType = usefulTypes.has(atom.type);
    return hasContentTopic && highConfidence && goodType;
  });

  console.log(`Filtered ${filtered.length} atoms from ${allAtoms.length} total`);

  // Build inverted index
  const keywordMap = new Map<string, Map<string, number>>();

  for (const atom of filtered) {
    const keywords = extractKeywords(atom.knowledge);
    for (const kw of keywords) {
      if (!keywordMap.has(kw)) {
        keywordMap.set(kw, new Map());
      }
      const atomMap = keywordMap.get(kw)!;
      atomMap.set(atom.id, (atomMap.get(atom.id) || 0) + 1);
    }
  }

  // Convert to serializable format, keeping only keywords with >=2 atoms
  const keywords: Record<string, { id: string; weight: number }[]> = {};
  for (const [kw, atomMap] of keywordMap) {
    if (atomMap.size >= 3) {
      keywords[kw] = [...atomMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10) // Keep top 10 atoms per keyword
        .map(([id, weight]) => ({ id, weight }));
    }
  }

  const atoms: Record<string, Atom> = {};
  for (const atom of filtered) {
    atoms[atom.id] = {
      id: atom.id,
      knowledge: atom.knowledge,
      topics: atom.topics,
      skills: atom.skills,
      type: atom.type,
      confidence: atom.confidence,
    };
  }

  const index: AtomsIndex = { keywords, atoms };
  console.log(
    `Built index with ${Object.keys(keywords).length} keywords and ${Object.keys(atoms).length} atoms`
  );

  return index;
}

const outputPath = path.resolve(__dirname, "../data/atoms-index.json");
const index = buildIndex();
fs.writeFileSync(outputPath, JSON.stringify(index), "utf-8");
console.log(`Index written to ${outputPath} (${(JSON.stringify(index).length / 1024).toFixed(1)} KB)`);
