"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Version {
  title: string;
  body: string;
  tags: string[];
  angle: string;
  score: number;
  scoring_notes?: string;
}

interface HistoryEntry {
  input: string;
  versions: Version[];
  summary: string;
}

const EXCHANGE_PROMPTS = [
  "敏感肌修护精华，适合换季泛红",
  "油皮用的清爽防晒霜，不闷痘",
  "抗老面霜，针对25+初老细纹",
];

const LOADING_TEXTS = [
  "消化产品卖点...",
  "匹配创作方法论...",
  "构思6个切入角度...",
  "注入博主人设...",
  "质检：读起来像真人吗...",
];

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [summary, setSummary] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [loadingTextIdx, setLoadingTextIdx] = useState(0);
  const [conversationMessages, setConversationMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  const resultRef = useRef<HTMLDivElement>(null);
  const loadingInterval = useRef<NodeJS.Timeout | null>(null);

  // Load API key and history from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem("xhs_api_key");
    if (savedKey) setApiKey(savedKey);

    const savedHistory = localStorage.getItem("xhs_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch {}
    }
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("xhs_api_key", key);
  };

  const addToHistory = (entry: HistoryEntry) => {
    const updated = [entry, ...history].slice(0, 20);
    setHistory(updated);
    localStorage.setItem("xhs_history", JSON.stringify(updated));
  };

  // Rotate loading text
  useEffect(() => {
    if (isLoading) {
      loadingInterval.current = setInterval(() => {
        setLoadingTextIdx((i) => (i + 1) % LOADING_TEXTS.length);
      }, 1500);
    } else {
      if (loadingInterval.current) clearInterval(loadingInterval.current);
    }
    return () => {
      if (loadingInterval.current) clearInterval(loadingInterval.current);
    };
  }, [isLoading]);

  // Scroll to results
  useEffect(() => {
    if (versions && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [versions]);

  const handleGenerate = useCallback(async () => {
    if (!input.trim()) return;
    if (!apiKey.trim()) {
      setError("请先设置 API Key");
      setShowApiKey(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setVersions(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: input.trim(),
          apiKey,
          messages: conversationMessages,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "生成失败，请重试");
        return;
      }

      setVersions(data.versions);
      setSummary(data.summary || "");

      // Update conversation history
      const assistantContent = JSON.stringify(data.versions);
      setConversationMessages((prev) => [
        ...prev,
        { role: "user" as const, content: input.trim() },
        { role: "assistant" as const, content: assistantContent },
      ]);

      // Add to local history
      addToHistory({
        input: input.trim(),
        versions: data.versions,
        summary: data.summary || "",
      });

      setFeedback("");
    } catch {
      setError("网络异常，请检查网络后重试");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, apiKey, conversationMessages]);

  const handleFeedback = useCallback(async () => {
    if (!feedback.trim() || !versions) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: feedback.trim(),
          apiKey,
          messages: conversationMessages,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "修改失败，请重试");
        return;
      }

      setVersions(data.versions);
      setSummary(data.summary || "");

      setConversationMessages((prev) => [
        ...prev,
        { role: "user" as const, content: feedback.trim() },
        {
          role: "assistant" as const,
          content: JSON.stringify(data.versions),
        },
      ]);

      addToHistory({
        input: `[修改] ${feedback.trim()}`,
        versions: data.versions,
        summary: data.summary || "",
      });

      setFeedback("");
    } catch {
      setError("网络异常，请重试");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, versions, apiKey, conversationMessages]);

  const copyVersion = async (v: Version, idx: number) => {
    const text = `${v.title}\n\n${v.body}\n\n${v.tags.join(" ")}`;
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const startNewSession = () => {
    setInput("");
    setVersions(null);
    setSummary("");
    setFeedback("");
    setError(null);
    setConversationMessages([]);
  };

  const loadHistory = (entry: HistoryEntry) => {
    setInput(entry.input.startsWith("[修改]") ? "" : entry.input);
    setVersions(entry.versions);
    setSummary(entry.summary);
    setFeedback("");
    setError(null);
    setShowHistory(false);
  };

  const angleLabel = (angle: string) => {
    switch (angle) {
      case "personal":
        return "现身说法";
      case "counterintuitive":
        return "反常识";
      case "mythbust":
        return "扫盲避坑";
      case "sensory":
        return "沉浸体验";
      case "insider":
        return "老司机";
      case "comparison":
        return "真实对比";
      default:
        return angle;
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="py-8 px-4 text-center">
        <h1 className="text-2xl font-bold text-[#3D2C2A] leading-tight">
          小红书文案生成器
        </h1>
        <p className="text-[#8C7A76] mt-2 text-sm">
          输入产品信息，一键生成6版护肤爆款笔记
        </p>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-20">
        {/* API Key Section */}
        <div className="mb-6">
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            className="flex items-center gap-2 text-sm text-[#8C7A76] hover:text-[#E8927C] transition-colors"
          >
            <span>{apiKey ? "🔑 API Key 已设置" : "⚙️ 设置 API Key"}</span>
            <span className="text-xs">{showApiKey ? "收起" : "展开"}</span>
          </button>
          {showApiKey && (
            <div className="mt-3 flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onBlur={() => apiKey && saveApiKey(apiKey)}
                placeholder="输入 DeepSeek API Key (sk-...)"
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#F0E0D8] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E8927C]/30"
              />
              <button
                onClick={() => {
                  saveApiKey(apiKey);
                  setShowApiKey(false);
                }}
                className="px-4 py-2.5 bg-[#E8927C] text-white rounded-xl text-sm font-medium hover:bg-[#D97A6A] transition-colors"
              >
                保存
              </button>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="mb-6">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="输入产品名称、一句话主题、或关键词...
例如：敏感肌修护精华，适合换季泛红"
              rows={4}
              disabled={isLoading}
              className="w-full px-5 py-4 rounded-2xl border border-[#F0E0D8] bg-white text-[#3D2C2A] placeholder-[#B8A9A0] focus:outline-none focus:ring-2 focus:ring-[#E8927C]/30 resize-none text-sm leading-relaxed disabled:opacity-50"
            />
          </div>

          {/* Example chips */}
          {!versions && !isLoading && (
            <div className="flex flex-wrap gap-2 mt-3">
              {EXCHANGE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="px-3 py-1.5 bg-white border border-[#F0E0D8] rounded-full text-xs text-[#8C7A76] hover:border-[#E8927C] hover:text-[#E8927C] transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={isLoading || !input.trim()}
            className="mt-4 w-full py-3 bg-[#E8927C] text-white rounded-2xl text-base font-medium
              hover:bg-[#D97A6A] transition-all disabled:opacity-40 disabled:cursor-not-allowed
              active:scale-[0.98]"
          >
            {isLoading ? "正在生成..." : "✨ 开始生成"}
          </button>
          <p className="text-xs text-[#B8A9A0] text-center mt-2">
            Cmd/Ctrl + Enter 快速发送
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
            <span className="text-red-400 shrink-0 mt-0.5">⚠</span>
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="mb-6 p-10 text-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 bg-[#E8927C] rounded-full animate-pulse-dot" />
              <span className="w-2.5 h-2.5 bg-[#E8927C] rounded-full animate-pulse-dot" />
              <span className="w-2.5 h-2.5 bg-[#E8927C] rounded-full animate-pulse-dot" />
            </div>
            <p className="text-sm text-[#8C7A76]">
              {LOADING_TEXTS[loadingTextIdx]}
            </p>
          </div>
        )}

        {/* Results */}
        {versions && !isLoading && (
          <div ref={resultRef}>
            {/* Summary */}
            {summary && (
              <p className="text-sm text-[#8C7A76] mb-4 px-1">{summary}</p>
            )}

            {/* Version cards */}
            <div className="space-y-4">
              {versions.map((v, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-5 border border-[#F0E0D8] shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#E8927C] bg-[#FFF0EC] px-2 py-0.5 rounded-full">
                        版本 {idx + 1}
                      </span>
                      <span className="text-xs text-[#B8A9A0]">
                        {angleLabel(v.angle)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {v.score && (
                        <span className="text-xs text-[#8C7A76]">
                          质量 {v.score}/10
                        </span>
                      )}
                      <button
                        onClick={() => copyVersion(v, idx)}
                        className="text-xs text-[#E8927C] hover:text-[#D97A6A] transition-colors"
                      >
                        {copiedIdx === idx ? "已复制!" : "复制"}
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-semibold text-[#3D2C2A] mb-2">
                    {v.title || "(无标题)"}
                  </h3>

                  {/* Body */}
                  <p className="text-sm text-[#3D2C2A] leading-relaxed whitespace-pre-wrap mb-3">
                    {v.body || "(无正文)"}
                  </p>

                  {/* Tags */}
                  {Array.isArray(v.tags) && v.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {v.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs text-[#8C7A76] bg-[#FFF8F5] px-2 py-0.5 rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Feedback shortcut */}
                  <button
                    onClick={() =>
                      setFeedback(`版本${idx + 1}：`)
                    }
                    className="text-xs text-[#B8A9A0] hover:text-[#E8927C] transition-colors"
                  >
                    基于此版本修改
                  </button>
                </div>
              ))}
            </div>

            {/* Feedback area */}
            <div className="mt-6">
              <p className="text-sm text-[#8C7A76] mb-2">
                对结果不满意？输入修改意见继续迭代
              </p>
              <div className="flex gap-2">
                <input
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleFeedback();
                    }
                  }}
                  placeholder="如：第三版语气更轻松"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#F0E0D8] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E8927C]/30 disabled:opacity-50"
                />
                <button
                  onClick={handleFeedback}
                  disabled={isLoading || !feedback.trim()}
                  className="px-5 py-2.5 bg-[#E8927C] text-white rounded-xl text-sm font-medium hover:bg-[#D97A6A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  重新生成
                </button>
              </div>
            </div>

            {/* New session */}
            <div className="mt-4 text-center">
              <button
                onClick={startNewSession}
                className="text-xs text-[#B8A9A0] hover:text-[#E8927C] transition-colors"
              >
                开始新的文案
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!versions && !isLoading && !error && (
          <div className="py-12 text-center">
            <p className="text-4xl mb-4">💆</p>
            <p className="text-sm text-[#B8A9A0]">
              输入你的护肤产品信息
              <br />
              让 AI 帮你写出有温度的文案
            </p>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="mt-10 border-t border-[#F0E0D8] pt-6">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm text-[#8C7A76] hover:text-[#E8927C] transition-colors"
            >
              {showHistory ? "收起" : "展开"} 历史记录 ({history.length})
            </button>
            {showHistory && (
              <div className="mt-3 space-y-2">
                {history.map((entry, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadHistory(entry)}
                    className="w-full text-left px-4 py-3 bg-white rounded-xl border border-[#F0E0D8] text-sm hover:border-[#E8927C] transition-colors"
                  >
                    <span className="text-[#3D2C2A] truncate block">
                      {entry.input.slice(0, 50)}
                      {entry.input.length > 50 ? "..." : ""}
                    </span>
                    <span className="text-xs text-[#B8A9A0]">
                      {entry.summary.slice(0, 40) || `${entry.versions.length}个版本`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
