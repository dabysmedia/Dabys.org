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

type TabId = "pending" | "published" | "draft" | "denied";

export default function AdminCommunityCardsPage() {
  const [tab, setTab] = useState<TabId>("pending");
  const [pending, setPending] = useState<CommunitySetWithCreator[]>([]);
  const [published, setPublished] = useState<CommunitySetWithCreator[]>([]);
  const [draft, setDraft] = useState<CommunitySetWithCreator[]>([]);
  const [denied, setDenied] = useState<CommunitySetWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

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
  ];

  const currentSets =
    tab === "pending"
      ? pending
      : tab === "published"
        ? published
        : tab === "draft"
          ? draft
          : denied;

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
            {t.count > 0 && (
              <span className="ml-1.5 text-xs opacity-80">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {currentSets.length === 0 ? (
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
                {tab === "pending" && (
                  <div className="flex gap-2 shrink-0">
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
                  </div>
                )}
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
    </div>
  );
}
