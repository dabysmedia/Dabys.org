"use client";

import { useEffect, useState } from "react";
import { formatUtcTimeInHalifax } from "@/lib/dateUtils";

interface QuestDefinition {
  label: string;
  description: string;
  reward: number;
  rewardType: "credits" | "stardust";
  alwaysActive: boolean;
  rarityParam?: boolean;
}

interface QuestSettings {
  dailyQuestCount: number;
  allQuestsCompleteBonus: number;
  resetHourUTC: number;
  questDefinitions: Record<string, QuestDefinition>;
}

const QUEST_TYPE_LABELS: Record<string, string> = {
  login: "Daily Login",
  open_pack: "Open a Pack",
  trade_up: "Trade Up",
  upload_codex: "Upload to Codex",
  complete_trade: "Complete a Trade",
  disenchant_holo: "Disenchant a Holo",
  pack_a_punch: "Pack-a-Punch",
  marketplace_request: "Marketplace Request",
  find_rarity_in_pack: "Find Rarity in Pack",
};

export default function AdminQuestsPage() {
  const [settings, setSettings] = useState<QuestSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [wipingSetCompletion, setWipingSetCompletion] = useState(false);
  const [wipeSetCompletionOpen, setWipeSetCompletionOpen] = useState(false);
  const [wipeSetCompletionData, setWipeSetCompletionData] = useState<{
    users: { id: string; name: string }[];
    setCompletionByUser: { userId: string; userName: string; winnerId: string; movieTitle: string }[];
  } | null>(null);
  const [wipeUserId, setWipeUserId] = useState("");
  const [wipeWinnerId, setWipeWinnerId] = useState("");

  useEffect(() => {
    fetch("/api/admin/quests")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
      })
      .catch(() => setError("Failed to load quest settings"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/admin/quests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError("Failed to save");
      }
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function updateQuest(questType: string, field: string, value: unknown) {
    if (!settings) return;
    setSettings({
      ...settings,
      questDefinitions: {
        ...settings.questDefinitions,
        [questType]: {
          ...settings.questDefinitions[questType],
          [field]: value,
        },
      },
    });
  }

  async function handleResetQuests() {
    if (!resetConfirm) return;
    setResetting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/quests/reset", { method: "POST" });
      if (res.ok) {
        setResetConfirm(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to reset quests");
      }
    } catch {
      setError("Failed to reset quests");
    } finally {
      setResetting(false);
    }
  }

  async function handleWipeSetCompletionQuests() {
    if (!wipeUserId || !wipeWinnerId) return;
    setWipingSetCompletion(true);
    setError("");
    try {
      const res = await fetch("/api/admin/quests/wipe-set-completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: wipeUserId, winnerId: wipeWinnerId }),
      });
      if (res.ok) {
        setWipeUserId("");
        setWipeWinnerId("");
        setWipeSetCompletionOpen(false);
        const data = await res.json().catch(() => ({}));
        if (data.wiped) {
          const fresh = await fetch("/api/admin/quests/set-completion-data").then((r) => r.json());
          setWipeSetCompletionData(fresh);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to wipe set completion quests");
      }
    } catch {
      setError("Failed to wipe set completion quests");
    } finally {
      setWipingSetCompletion(false);
    }
  }

  async function openWipeSetCompletion() {
    setWipeSetCompletionOpen(true);
    setWipeUserId("");
    setWipeWinnerId("");
    setError("");
    try {
      const data = await fetch("/api/admin/quests/set-completion-data").then((r) => r.json());
      setWipeSetCompletionData(data);
    } catch {
      setError("Failed to load set completion data");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return <p className="text-red-400 py-10 text-center">{error || "Failed to load"}</p>;
  }

  const questTypes = Object.keys(settings.questDefinitions);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white/90">Daily Quests</h1>
          <p className="text-sm text-white/40 mt-1">
            Configure quest rewards, descriptions, and how many quests appear each day.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600/90 to-indigo-600/90 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-purple-500/20"
          >
            {saving ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : saved ? (
              "Saved!"
            ) : (
              "Save Changes"
            )}
          </button>
          {!resetConfirm ? (
            <button
              type="button"
              onClick={() => setResetConfirm(true)}
              className="px-4 py-2.5 rounded-xl border border-red-400/30 bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all cursor-pointer"
            >
              Reset Quests
            </button>
          ) : (
            <span className="flex items-center gap-2">
              <span className="text-xs text-white/50">Clear all progress?</span>
              <button
                type="button"
                onClick={handleResetQuests}
                disabled={resetting}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-400/40 text-red-400 text-xs font-medium hover:bg-red-500/30 cursor-pointer disabled:opacity-50"
              >
                {resetting ? (
                  <span className="inline-block w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                ) : (
                  "Yes, reset"
                )}
              </button>
              <button
                type="button"
                onClick={() => setResetConfirm(false)}
                className="px-3 py-1.5 rounded-lg border border-white/20 text-white/60 text-xs hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={openWipeSetCompletion}
            className="px-4 py-2.5 rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-all cursor-pointer"
          >
            Wipe Set Completion Quests
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Wipe set completion modal */}
      {wipeSetCompletionOpen && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-amber-400/90">Wipe Set Completion Quest</h3>
          <p className="text-xs text-white/50">Remove set bonus quest(s) for a specific user and set. This clears regular, holo, prismatic, and dark matter quests for that set.</p>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-white/50 mb-1">User</label>
              <select
                value={wipeUserId}
                onChange={(e) => {
                  setWipeUserId(e.target.value);
                  setWipeWinnerId("");
                }}
                className="min-w-[160px] px-3 py-2 rounded-lg border border-white/10 bg-white/[0.06] text-sm text-white/80 outline-none focus:border-amber-400/50 [color-scheme:dark] cursor-pointer"
              >
                <option value="">Select user</option>
                {(wipeSetCompletionData?.users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Set</label>
              <select
                value={wipeWinnerId}
                onChange={(e) => setWipeWinnerId(e.target.value)}
                disabled={!wipeUserId}
                className="min-w-[200px] px-3 py-2 rounded-lg border border-white/10 bg-white/[0.06] text-sm text-white/80 outline-none focus:border-amber-400/50 [color-scheme:dark] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select set</option>
                {wipeUserId &&
                  [...new Map(
                    (wipeSetCompletionData?.setCompletionByUser ?? [])
                      .filter((s) => s.userId === wipeUserId)
                      .map((s) => [s.winnerId, { winnerId: s.winnerId, movieTitle: s.movieTitle }])
                  ).values()].map(({ winnerId, movieTitle }) => (
                    <option key={winnerId} value={winnerId}>{movieTitle}</option>
                  ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleWipeSetCompletionQuests}
                disabled={wipingSetCompletion || !wipeUserId || !wipeWinnerId}
                className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-400 text-sm font-medium hover:bg-amber-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {wipingSetCompletion ? (
                  <span className="inline-block w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                ) : (
                  "Wipe"
                )}
              </button>
              <button
                type="button"
                onClick={() => { setWipeSetCompletionOpen(false); setWipeUserId(""); setWipeWinnerId(""); }}
                className="px-4 py-2 rounded-lg border border-white/20 text-white/60 text-sm hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
          {(wipeSetCompletionData?.setCompletionByUser?.length ?? 0) === 0 && (
            <p className="text-xs text-white/40">No set completion quests exist.</p>
          )}
        </div>
      )}

      {/* Global settings */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
          General Settings
        </h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-sm text-white/60">Quests per day:</label>
            <input
              type="number"
              min={1}
              max={20}
              value={settings.dailyQuestCount}
              onChange={(e) =>
                setSettings({ ...settings, dailyQuestCount: parseInt(e.target.value) || 6 })
              }
              className="w-20 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none focus:border-purple-400/50 transition-colors"
            />
            <span className="text-xs text-white/30">
              (Always-active quests + random optional quests)
            </span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-sm text-white/60">All quests complete bonus (credits):</label>
            <input
              type="number"
              min={0}
              value={typeof settings.allQuestsCompleteBonus === "number" ? settings.allQuestsCompleteBonus : 50}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  allQuestsCompleteBonus: Math.max(0, parseInt(e.target.value) || 0),
                })
              }
              className="w-24 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none focus:border-purple-400/50 transition-colors"
            />
            <span className="text-xs text-white/30">
              Awarded once when all daily quests are completed and claimed
            </span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-sm text-white/60">Daily reset time (UTC):</label>
            <select
              value={typeof settings.resetHourUTC === "number" ? settings.resetHourUTC : 0}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  resetHourUTC: parseInt(e.target.value) || 0,
                })
              }
              className="w-36 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none focus:border-purple-400/50 transition-colors cursor-pointer"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00 UTC → {formatUtcTimeInHalifax(h)} (Halifax)
                </option>
              ))}
            </select>
            <span className="text-xs text-white/30">
              New quests are generated after this hour each day
            </span>
          </div>
        </div>
        <p className="text-xs text-white/30 mt-3">
          Always-active quests are included every day. Remaining slots are filled from optional quests randomly.
        </p>
      </div>

      {/* Quest definitions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
          Quest Definitions
        </h2>

        {questTypes.map((questType) => {
          const def = settings.questDefinitions[questType];
          return (
            <div
              key={questType}
              className={`rounded-2xl border p-5 transition-colors ${
                def.alwaysActive
                  ? "border-amber-400/15 bg-amber-400/[0.02]"
                  : "border-white/[0.06] bg-white/[0.02]"
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-white/80">
                      {QUEST_TYPE_LABELS[questType] || questType}
                    </h3>
                    {def.alwaysActive && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider bg-amber-400/10 text-amber-400 border border-amber-400/20">
                        Always Active
                      </span>
                    )}
                    {def.rarityParam && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider bg-purple-400/10 text-purple-400 border border-purple-400/20">
                        Random Rarity
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/30">{questType}</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-white/40">Always active</span>
                  <input
                    type="checkbox"
                    checked={def.alwaysActive}
                    onChange={(e) => updateQuest(questType, "alwaysActive", e.target.checked)}
                    className="w-4 h-4 rounded border border-white/20 bg-white/5 accent-purple-500 cursor-pointer"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">
                    Label
                  </label>
                  <input
                    type="text"
                    value={def.label}
                    onChange={(e) => updateQuest(questType, "label", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none focus:border-purple-400/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={def.description}
                    onChange={(e) => updateQuest(questType, "description", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none focus:border-purple-400/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">
                    Reward Amount
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={def.reward}
                    onChange={(e) => updateQuest(questType, "reward", parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none focus:border-purple-400/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">
                    Reward Type
                  </label>
                  <select
                    value={def.rewardType}
                    onChange={(e) => updateQuest(questType, "rewardType", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none focus:border-purple-400/50 transition-colors cursor-pointer"
                  >
                    <option value="credits">Credits</option>
                    <option value="stardust">Stardust</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
