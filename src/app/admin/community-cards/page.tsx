"use client";

import { useEffect, useState } from "react";
import { CardDisplay } from "@/components/CardDisplay";
import Link from "next/link";

interface CommunitySetCard {
  actorName: string;
  characterName: string;
  profilePath: string;
  rarity: "uncommon" | "rare" | "epic" | "legendary";
}

interface CommunitySetWithCreator {
  id: string;
  creatorId: string;
  creatorName: string;
  name: string;
  createdAt: string;
  status: "draft" | "pending" | "published" | "denied";
  cards: CommunitySetCard[];
}

type TabId = "pending" | "published" | "draft" | "denied" | "pool";

const RARITY_ORDER: Record<string, number> = { uncommon: 0, rare: 1, epic: 2, legendary: 3 };
function sortCardsByRarity<T extends { rarity?: string }>(cards: T[]): T[] {
  return [...cards].sort((a, b) => (RARITY_ORDER[a.rarity ?? ""] ?? 0) - (RARITY_ORDER[b.rarity ?? ""] ?? 0));
}

export default function AdminCommunityCardsPage() {
  const [tab, setTab] = useState<TabId>("pending");
  const [pending, setPending] = useState<CommunitySetWithCreator[]>([]);
  const [published, setPublished] = useState<CommunitySetWithCreator[]>([]);
  const [draft, setDraft] = useState<CommunitySetWithCreator[]>([]);
  const [denied, setDenied] = useState<CommunitySetWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [pool, setPool] = useState<{ characterId: string; actorName: string; characterName: string; movieTitle: string; profilePath?: string; rarity: string; communitySetId?: string }[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [removingFromPoolId, setRemovingFromPoolId] = useState<string | null>(null);
  const [editingSet, setEditingSet] = useState<CommunitySetWithCreator | null>(null);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tab === "pool") loadPool();
  }, [tab]);

  async function load() {
    try {
      const res = await fetch("/api/admin/community-sets");
      if (res.ok) {
        const data = await res.json();
        setPending(data.pending ?? []);
        setPublished(data.published ?? []);
        setDraft(data.draft ?? []);
        setDenied(data.denied ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function loadPool() {
    setPoolLoading(true);
    try {
      const res = await fetch("/api/admin/character-pool");
      if (res.ok) {
        const data = await res.json();
        const communityEntries = (data.pool ?? []).filter((c: { communitySetId?: string; cardType?: string }) => c.communitySetId || (c.cardType ?? "actor") === "community");
        setPool(communityEntries);
      }
    } catch {
      // ignore
    } finally {
      setPoolLoading(false);
    }
  }

  async function handleRemoveSet(id: string) {
    setActioningId(id);
    try {
      const res = await fetch(`/api/admin/community-sets/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRemoveConfirmId(null);
        await load();
        if (tab === "pool") await loadPool();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to remove");
      }
    } catch {
      alert("Failed to remove");
    } finally {
      setActioningId(null);
    }
  }

  async function handleRemoveFromPool(characterId: string) {
    setRemovingFromPoolId(characterId);
    try {
      const res = await fetch(`/api/admin/character-pool?characterId=${encodeURIComponent(characterId)}`, { method: "DELETE" });
      if (res.ok) {
        await loadPool();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to remove from pool");
      }
    } catch {
      alert("Failed to remove from pool");
    } finally {
      setRemovingFromPoolId(null);
    }
  }

  async function handleSaveEdit() {
    if (!editingSet) return;
    setActioningId(editingSet.id);
    try {
      const res = await fetch(`/api/admin/community-sets/${editingSet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingSet.name,
          cards: editingSet.cards,
        }),
      });
      if (res.ok) {
        setEditingSet(null);
        await load();
        if (tab === "pool") await loadPool();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to save");
      }
    } catch {
      alert("Failed to save");
    } finally {
      setActioningId(null);
    }
  }

  async function handleApprove(id: string) {
    setActioningId(id);
    try {
      const res = await fetch(`/api/admin/community-sets/${id}/approve`, {
        method: "POST",
      });
      if (res.ok) {
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to approve");
      }
    } catch {
      alert("Failed to approve");
    } finally {
      setActioningId(null);
    }
  }

  async function handleDeny(id: string) {
    setActioningId(id);
    try {
      const res = await fetch(`/api/admin/community-sets/${id}/deny`, {
        method: "POST",
      });
      if (res.ok) {
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to deny");
      }
    } catch {
      alert("Failed to deny");
    } finally {
      setActioningId(null);
    }
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "pending", label: "Pending", count: pending.length },
    { id: "published", label: "Published", count: published.length },
    { id: "draft", label: "Draft", count: draft.length },
    { id: "denied", label: "Denied", count: denied.length },
    { id: "pool", label: "Pool", count: pool.length },
  ];

  const currentSets =
    tab === "pending"
      ? pending
      : tab === "published"
        ? published
        : tab === "draft"
          ? draft
          : tab === "denied"
            ? denied
            : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white/90">Community Cards</h1>
        <p className="text-sm text-white/50 mt-1">
          Review and approve community sets. New sets are submitted as pending.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              tab === t.id
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "bg-white/[0.04] text-white/60 border border-white/10 hover:text-white/80 hover:border-white/20"
            }`}
          >
            {t.label}
            {t.count >= 0 && (
              <span className="ml-1.5 text-xs opacity-80">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {tab === "pool" ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Community Pool</h2>
          <p className="text-xs text-white/40 mb-4">Pool entries for community sets. Remove individual cards from the pool here.</p>
          {poolLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
            </div>
          ) : pool.length === 0 ? (
            <p className="text-white/50 text-sm py-8 text-center">No community cards in the pool.</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {pool.map((c) => (
                <div key={c.characterId} className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-2">
                  <CardDisplay
                    card={{
                      profilePath: c.profilePath ?? "",
                      actorName: c.actorName,
                      characterName: c.characterName,
                      movieTitle: c.movieTitle,
                      rarity: c.rarity,
                      isFoil: false,
                      cardType: "community",
                    }}
                    compact
                    size="xs"
                  />
                  <div className="mt-2 flex flex-col gap-1">
                    <p className="text-[10px] font-medium text-white/80 truncate">{c.characterName || c.actorName}</p>
                    <p className="text-[9px] text-white/40 truncate">{c.movieTitle}</p>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromPool(c.characterId)}
                      disabled={removingFromPoolId === c.characterId}
                      className="mt-1 px-2 py-1 rounded text-[10px] font-medium text-red-400/90 hover:bg-red-500/10 border border-red-500/20 cursor-pointer disabled:opacity-50"
                    >
                      {removingFromPoolId === c.characterId ? "…" : "Remove"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : currentSets.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-12 text-center text-white/50 text-sm">
          No {tab} sets.
        </div>
      ) : (
        <div className="space-y-6">
          {currentSets.map((set) => (
            <div
              key={set.id}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white/90">{set.name}</h2>
                  <p className="text-sm text-white/50 mt-0.5">
                    by{" "}
                    <Link
                      href={`/profile/${set.creatorId}`}
                      className="text-purple-400 hover:text-purple-300"
                    >
                      {set.creatorName}
                    </Link>
                    {" · "}
                    {formatDate(set.createdAt)}
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    {set.cards?.length ?? 0} cards
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {tab === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApprove(set.id)}
                        disabled={actioningId === set.id}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-green-400/90 hover:bg-green-500/10 border border-green-500/20 hover:border-green-500/30 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {actioningId === set.id ? "…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeny(set.id)}
                        disabled={actioningId === set.id}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-red-400/90 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {actioningId === set.id ? "…" : "Deny"}
                      </button>
                      {removeConfirmId === set.id ? (
                        <span className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRemoveSet(set.id)}
                            disabled={actioningId === set.id}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 bg-red-500/20 border border-red-500/40 cursor-pointer disabled:opacity-50"
                          >
                            {actioningId === set.id ? "…" : "Confirm remove"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRemoveConfirmId(null)}
                            className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white/90"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRemoveConfirmId(set.id)}
                          disabled={actioningId === set.id}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-red-400/90 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </>
                  )}
                  {(tab === "published" || tab === "draft" || tab === "denied") && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditingSet(set)}
                        disabled={actioningId === set.id}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-purple-400/90 hover:bg-purple-500/10 border border-purple-500/20 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Edit
                      </button>
                      {removeConfirmId === set.id ? (
                        <span className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRemoveSet(set.id)}
                            disabled={actioningId === set.id}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 bg-red-500/20 border border-red-500/40 cursor-pointer disabled:opacity-50"
                          >
                            {actioningId === set.id ? "…" : "Confirm remove"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRemoveConfirmId(null)}
                            className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white/90"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRemoveConfirmId(set.id)}
                          disabled={actioningId === set.id}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-red-400/90 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {(set.cards ?? []).map((card, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-white/[0.08] overflow-hidden bg-white/[0.02]"
                  >
                    <div className="w-[72px]">
                      <CardDisplay
                        card={{
                          profilePath: card.profilePath,
                          actorName: card.actorName,
                          characterName: card.characterName,
                          movieTitle: set.name,
                          rarity: card.rarity,
                          isFoil: false,
                          cardType: "community",
                        }}
                        compact
                        size="xs"
                      />
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="text-[10px] font-medium text-white/80 truncate max-w-[72px]">
                        {card.characterName || card.actorName}
                      </p>
                      <p className="text-[9px] text-white/40 truncate max-w-[72px]">
                        {card.rarity}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingSet && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setEditingSet(null)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/[0.12] bg-[#0f0f14] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white/90">Edit set: {editingSet.name}</h3>
              <button type="button" onClick={() => setEditingSet(null)} className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10">×</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Set name</label>
                <input
                  type="text"
                  value={editingSet.name}
                  onChange={(e) => setEditingSet((s) => s ? { ...s, name: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white/90 text-sm"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs text-white/50">Cards (min 6)</p>
                  <button
                    type="button"
                    onClick={() => setEditingSet((s) => s ? { ...s, cards: sortCardsByRarity(s.cards ?? []) } : null)}
                    className="px-2 py-1 rounded text-xs text-white/60 hover:text-white/90 hover:bg-white/10"
                  >
                    Sort by rarity
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(editingSet.cards ?? []).map((card, i) => (
                    <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
                      <div className="aspect-[2/3] rounded overflow-hidden bg-white/5">
                        {card.profilePath ? (
                          <img src={card.profilePath} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">No image</div>
                        )}
                      </div>
                      <input
                        type="text"
                        value={card.characterName}
                        onChange={(e) => setEditingSet((s) => {
                          if (!s?.cards) return s;
                          const next = [...s.cards];
                          next[i] = { ...next[i], characterName: e.target.value };
                          return { ...s, cards: next };
                        })}
                        placeholder="Title"
                        className="w-full rounded px-2 py-1 text-xs bg-white/[0.04] border border-white/10 text-white/90"
                      />
                      <input
                        type="text"
                        value={card.actorName}
                        onChange={(e) => setEditingSet((s) => {
                          if (!s?.cards) return s;
                          const next = [...s.cards];
                          next[i] = { ...next[i], actorName: e.target.value };
                          return { ...s, cards: next };
                        })}
                        placeholder="Bottom text"
                        className="w-full rounded px-2 py-1 text-xs bg-white/[0.04] border border-white/10 text-white/90"
                      />
                      <input
                        type="text"
                        value={card.profilePath}
                        onChange={(e) => setEditingSet((s) => {
                          if (!s?.cards) return s;
                          const next = [...s.cards];
                          next[i] = { ...next[i], profilePath: e.target.value };
                          return { ...s, cards: next };
                        })}
                        placeholder="Image URL"
                        className="w-full rounded px-2 py-1 text-xs bg-white/[0.04] border border-white/10 text-white/90"
                      />
                      <select
                        value={card.rarity}
                        onChange={(e) => setEditingSet((s) => {
                          if (!s?.cards) return s;
                          const next = [...s.cards];
                          next[i] = { ...next[i], rarity: e.target.value as CommunitySetCard["rarity"] };
                          return { ...s, cards: next };
                        })}
                        className="w-full rounded px-2 py-1 text-xs bg-white/[0.04] border border-white/10 text-white/90 [color-scheme:dark]"
                      >
                        <option value="uncommon">Uncommon</option>
                        <option value="rare">Rare</option>
                        <option value="epic">Epic</option>
                        <option value="legendary">Legendary</option>
                      </select>
                      <div className="flex gap-1 pt-1">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => setEditingSet((s) => {
                            if (!s?.cards || i === 0) return s;
                            const next = [...s.cards];
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            return { ...s, cards: next };
                          })}
                          className="flex-1 px-2 py-1 rounded text-[10px] bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move left"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          disabled={i === (editingSet.cards?.length ?? 0) - 1}
                          onClick={() => setEditingSet((s) => {
                            if (!s?.cards || i >= s.cards.length - 1) return s;
                            const next = [...s.cards];
                            [next[i], next[i + 1]] = [next[i + 1], next[i]];
                            return { ...s, cards: next };
                          })}
                          className="flex-1 px-2 py-1 rounded text-[10px] bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move right"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-white/10 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingSet(null)} className="px-4 py-2 rounded-lg border border-white/20 text-white/70 hover:bg-white/15">Cancel</button>
              <button type="button" onClick={() => handleSaveEdit()} disabled={actioningId === editingSet.id} className="px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-50">
                {actioningId === editingSet.id ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
