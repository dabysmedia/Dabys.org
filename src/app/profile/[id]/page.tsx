"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import ImageCropModal from "@/components/ImageCropModal";
import { CardDisplay } from "@/components/CardDisplay";
import { BadgePill } from "@/components/BadgePill";

interface LocalUser {
  id: string;
  name: string;
}

interface ProfileData {
  avatarUrl: string;
  bannerUrl: string;
  bio: string;
  featuredCardIds?: string[];
  displayedBadgeWinnerId?: string | null;
  displayedBadgeShopItemId?: string | null;
  favoriteMovieTmdbId?: number | null;
  favoriteMovieSnapshot?: { title: string; posterUrl: string; backdropUrl: string; year: string; letterboxdUrl: string } | null;
}

interface FeaturedCard {
  id: string;
  rarity: string;
  isFoil: boolean;
  actorName: string;
  characterName: string;
  movieTitle: string;
  profilePath: string;
  cardType?: string;
}

interface DisplayedBadge {
  winnerId?: string;
  shopItemId?: string;
  movieTitle: string;
  name?: string;
  imageUrl?: string;
  isHolo?: boolean;
}

interface CompletedBadge {
  winnerId?: string;
  shopItemId?: string;
  movieTitle: string;
  name?: string;
  imageUrl?: string;
  posterUrl?: string;
  isHolo?: boolean;
}

type BadgeSelection = null | { type: "winner"; id: string } | { type: "shop"; id: string };

interface FavoriteMovie {
  title: string;
  posterUrl: string;
  backdropUrl: string;
  year: string;
  /** Link to winner page when favourite is a site winner. */
  winnerId?: string | null;
  /** Link to Letterboxd when favourite is from TMDB and not a winner. */
  letterboxdUrl?: string | null;
  stars?: number | null;
  thumbsUp?: boolean | null;
}

interface Stats {
  totalSubmissions: number;
  totalWins: number;
  totalRatings: number;
  totalComments: number;
  avgStars: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
  favoriteMovie: FavoriteMovie | null;
  skipsEarned: number;
  skipsUsed: number;
  skipsAvailable: number;
}

interface RatingEntry {
  id: string;
  winnerId: string;
  title: string;
  posterUrl: string;
  year: string;
  stars: number;
  thumbsUp: boolean;
  createdAt: string;
}

interface SubEntry {
  id: string;
  movieTitle: string;
  posterUrl: string;
  letterboxdUrl: string;
  year?: string;
  weekTheme: string;
  weekId: string;
  createdAt: string;
  submissionCount?: number;
}

interface WinEntry {
  winnerId: string;
  movieTitle: string;
  posterUrl: string;
  weekTheme: string;
  publishedAt: string;
}

interface CommentEntry {
  id: string;
  winnerId: string;
  movieTitle: string;
  moviePosterUrl: string;
  text: string;
  mediaUrl: string;
  mediaType: string;
  createdAt: string;
}

interface WatchlistEntry {
  id: string;
  userId: string;
  tmdbId: number;
  movieTitle: string;
  posterUrl: string;
  letterboxdUrl: string;
  year?: string;
  addedAt: string;
}

interface TmdbSearchResult {
  id: number;
  title: string;
  year: string;
  posterUrl: string;
  overview: string;
}

interface FullProfile {
  user: { id: string; name: string };
  hasPin?: boolean;
  profile: ProfileData;
  stats: Stats;
  ratings: RatingEntry[];
  submissions: SubEntry[];
  weeksWon: WinEntry[];
  comments: CommentEntry[];
  watchlist: WatchlistEntry[];
  codexCards?: FeaturedCard[];
  displayedBadge?: DisplayedBadge | null;
  displayedBadges?: DisplayedBadge[];
  completedWinnerIds?: string[];
  completedBadges?: CompletedBadge[];
  featuredCards?: FeaturedCard[];
}

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;

  const [currentUser, setCurrentUser] = useState<LocalUser | null>(null);
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<string>("");
  const [data, setData] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"submissions" | "wins" | "comments" | "watchlist">("submissions");

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editBannerUrl, setEditBannerUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Crop modals
  const [cropTarget, setCropTarget] = useState<"avatar" | "banner" | null>(null);

  // Ratings modal
  const [showRatingsModal, setShowRatingsModal] = useState(false);

  // Watchlist add — TMDB search
  const [watchlistSearchQuery, setWatchlistSearchQuery] = useState("");
  const [watchlistSearchResults, setWatchlistSearchResults] = useState<TmdbSearchResult[]>([]);
  const [watchlistSearchLoading, setWatchlistSearchLoading] = useState(false);
  const [watchlistShowDropdown, setWatchlistShowDropdown] = useState(false);
  const [watchlistAdding, setWatchlistAdding] = useState(false);
  const watchlistSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchlistDropdownRef = useRef<HTMLDivElement>(null);


  // Badges modal: null = none, { type, id } = winner or shop badge
  const [badgesSelecting, setBadgesSelecting] = useState<BadgeSelection>(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);

  // View codex modal (when viewing another user's profile)
  const [showCodexModal, setShowCodexModal] = useState(false);
  type CodexViewSortKey = "set" | "name" | "rarity";
  const [codexViewSort, setCodexViewSort] = useState<CodexViewSortKey>("set");

  // Feature cards (pick from codex, max 6) — edit state
  const [showFeaturedCardsModal, setShowFeaturedCardsModal] = useState(false);
  const [editFeaturedCharacterIds, setEditFeaturedCharacterIds] = useState<string[]>([]);

  // Favorite movie (TMDB search when editing)
  const [showFavoriteMovieModal, setShowFavoriteMovieModal] = useState(false);
  const [favoriteMovieSearchQuery, setFavoriteMovieSearchQuery] = useState("");
  const [favoriteMovieSearchResults, setFavoriteMovieSearchResults] = useState<TmdbSearchResult[]>([]);
  const [favoriteMovieSearchLoading, setFavoriteMovieSearchLoading] = useState(false);
  const [favoriteMovieSelecting, setFavoriteMovieSelecting] = useState<{
    tmdbId: number;
    title: string;
    posterUrl: string;
    backdropUrl: string;
    year: string;
    letterboxdUrl: string;
  } | null>(null);
  const favoriteMovieSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Credits (for profile user)
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  // PIN (edit own profile)
  const [editCurrentPin, setEditCurrentPin] = useState("");
  const [editNewPin, setEditNewPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState("");

  const isOwnProfile = currentUser?.id === profileId;

  useEffect(() => {
    const cached = localStorage.getItem("dabys_user");
    if (cached) {
      try {
        setCurrentUser(JSON.parse(cached));
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Fetch current user's avatar for header (so it shows on every profile, not only own)
  useEffect(() => {
    if (!currentUser?.id) {
      setCurrentUserAvatarUrl("");
      return;
    }
    let cancelled = false;
    fetch(`/api/users/${currentUser.id}/profile`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.profile?.avatarUrl) setCurrentUserAvatarUrl(json.profile.avatarUrl);
        else if (!cancelled) setCurrentUserAvatarUrl("");
      })
      .catch(() => {
        if (!cancelled) setCurrentUserAvatarUrl("");
      });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const loadProfile = useCallback(async () => {
    if (!profileId) return;
    try {
      const res = await fetch(`/api/users/${profileId}/profile`);
      if (!res.ok) {
        router.replace("/");
        return;
      }
      const json: FullProfile = await res.json();
      setData(json);
      setEditBio(json.profile.bio);
      setEditAvatarUrl(json.profile.avatarUrl);
      setEditBannerUrl(json.profile.bannerUrl);
      if (json.profile.favoriteMovieTmdbId != null && json.profile.favoriteMovieSnapshot) {
        setFavoriteMovieSelecting({
          tmdbId: json.profile.favoriteMovieTmdbId,
          ...json.profile.favoriteMovieSnapshot,
        });
      } else {
        setFavoriteMovieSelecting(null);
      }
    } catch {
      router.replace("/");
    }
  }, [profileId, router]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loadProfile().finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [loadProfile]);

  // Watchlist: TMDB search debounce
  useEffect(() => {
    if (!watchlistSearchQuery.trim() || watchlistSearchQuery.trim().length < 2) {
      setWatchlistSearchResults([]);
      setWatchlistShowDropdown(false);
      return;
    }
    if (watchlistSearchTimeoutRef.current) clearTimeout(watchlistSearchTimeoutRef.current);
    watchlistSearchTimeoutRef.current = setTimeout(async () => {
      setWatchlistSearchLoading(true);
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(watchlistSearchQuery.trim())}`);
        const result = await res.json();
        setWatchlistSearchResults(result.results || []);
        setWatchlistShowDropdown(true);
      } catch {
        setWatchlistSearchResults([]);
      } finally {
        setWatchlistSearchLoading(false);
      }
    }, 300);
    return () => {
      if (watchlistSearchTimeoutRef.current) clearTimeout(watchlistSearchTimeoutRef.current);
    };
  }, [watchlistSearchQuery]);

  // Favorite movie: TMDB search debounce
  useEffect(() => {
    if (!showFavoriteMovieModal || !favoriteMovieSearchQuery.trim() || favoriteMovieSearchQuery.trim().length < 2) {
      setFavoriteMovieSearchResults([]);
      return;
    }
    if (favoriteMovieSearchTimeoutRef.current) clearTimeout(favoriteMovieSearchTimeoutRef.current);
    favoriteMovieSearchTimeoutRef.current = setTimeout(async () => {
      setFavoriteMovieSearchLoading(true);
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(favoriteMovieSearchQuery.trim())}`);
        const result = await res.json();
        setFavoriteMovieSearchResults(result.results || []);
      } catch {
        setFavoriteMovieSearchResults([]);
      } finally {
        setFavoriteMovieSearchLoading(false);
      }
    }, 300);
    return () => {
      if (favoriteMovieSearchTimeoutRef.current) clearTimeout(favoriteMovieSearchTimeoutRef.current);
    };
  }, [showFavoriteMovieModal, favoriteMovieSearchQuery]);

  // Watchlist: close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (watchlistDropdownRef.current && !watchlistDropdownRef.current.contains(e.target as Node)) {
        setWatchlistShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch credits for the profile user
  useEffect(() => {
    if (!data?.user?.id) {
      setCreditBalance(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/credits?userId=${encodeURIComponent(data.user.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && typeof d?.balance === "number") setCreditBalance(d.balance);
        else if (!cancelled) setCreditBalance(0);
      })
      .catch(() => {
        if (!cancelled) setCreditBalance(null);
      });
    return () => { cancelled = true; };
  }, [data?.user?.id]);

  // Refresh profile credits when global credits change (e.g. after buying pack)
  useEffect(() => {
    if (!isOwnProfile || !data?.user?.id) return;
    const handler = () => {
      fetch(`/api/credits?userId=${encodeURIComponent(data.user.id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (typeof d?.balance === "number") setCreditBalance(d.balance); })
        .catch(() => {});
    };
    window.addEventListener("dabys-credits-refresh", handler);
    return () => window.removeEventListener("dabys-credits-refresh", handler);
  }, [isOwnProfile, data?.user?.id]);

  async function addToWatchlist(tmdbId: number) {
    if (!currentUser || currentUser.id !== profileId) return;
    setWatchlistAdding(true);
    try {
      const res = await fetch(`/api/tmdb/movie/${tmdbId}`);
      if (!res.ok) return;
      const movie = await res.json();
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          tmdbId: movie.tmdbId,
          movieTitle: movie.title,
          posterUrl: movie.posterUrl,
          letterboxdUrl: movie.letterboxdUrl || "",
          year: movie.year,
        }),
      });
      setWatchlistSearchQuery("");
      setWatchlistSearchResults([]);
      setWatchlistShowDropdown(false);
      await loadProfile();
    } finally {
      setWatchlistAdding(false);
    }
  }

  async function removeFromWatchlist(tmdbId: number) {
    if (!currentUser || currentUser.id !== profileId) return;
    await fetch(`/api/watchlist?userId=${currentUser.id}&tmdbId=${tmdbId}`, { method: "DELETE" });
    await loadProfile();
  }

  function handleCropComplete(url: string) {
    if (cropTarget === "avatar") setEditAvatarUrl(url);
    else if (cropTarget === "banner") setEditBannerUrl(url);
    setCropTarget(null);
  }

  async function saveProfile() {
    setSaving(true);
    try {
      await fetch(`/api/users/${profileId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: editBio,
          avatarUrl: editAvatarUrl,
          bannerUrl: editBannerUrl,
          displayedBadgeWinnerId: badgesSelecting?.type === "winner" ? badgesSelecting.id : null,
          displayedBadgeShopItemId: badgesSelecting?.type === "shop" ? badgesSelecting.id : null,
          featuredCardIds: editFeaturedCharacterIds,
          favoriteMovieTmdbId: favoriteMovieSelecting?.tmdbId ?? null,
          favoriteMovieSnapshot: favoriteMovieSelecting
            ? { title: favoriteMovieSelecting.title, posterUrl: favoriteMovieSelecting.posterUrl, backdropUrl: favoriteMovieSelecting.backdropUrl, year: favoriteMovieSelecting.year, letterboxdUrl: favoriteMovieSelecting.letterboxdUrl }
            : null,
        }),
      });
      // Reload profile
      const res = await fetch(`/api/users/${profileId}/profile`);
      if (res.ok) setData(await res.json());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function savePin() {
    if (!profileId) return;
    setPinError("");
    setPinSaving(true);
    try {
      const res = await fetch(`/api/users/${profileId}/pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPin: editCurrentPin,
          newPin: editNewPin,
        }),
      });
      if (res.ok) {
        setEditCurrentPin("");
        setEditNewPin("");
        setData((prev) => (prev ? { ...prev, hasPin: !!editNewPin.trim() } : null));
      } else {
        const d = await res.json();
        setPinError(d.error || "Failed to update PIN");
      }
    } catch {
      setPinError("Something went wrong");
    } finally {
      setPinSaving(false);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  const {
    user,
    profile,
    stats,
    ratings,
    submissions,
    weeksWon,
    comments,
    watchlist = [],
    codexCards = [],
    featuredCards = [],
    displayedBadge = null,
    displayedBadges = [],
    completedWinnerIds = [],
    completedBadges = [],
  } = data;

  return (
    <div className="min-h-screen">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-purple-600/10 blur-[160px]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[140px]" />
      </div>

      {/* Banner */}
      <div className="relative z-10 h-48 sm:h-64 overflow-hidden bg-gradient-to-br from-purple-900/60 via-indigo-900/60 to-violet-900/60 group/banner">
        {(editing ? editBannerUrl : profile.bannerUrl) ? (
          <img
            src={editing ? editBannerUrl : profile.bannerUrl}
            alt="Banner"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/80 via-indigo-900/60 to-violet-900/80" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />
        {isOwnProfile && editing && (
          <button
            onClick={() => setCropTarget("banner")}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/banner:opacity-100 transition-opacity cursor-pointer"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/50 border border-white/10 text-white/70 text-sm backdrop-blur-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Change Banner
            </div>
          </button>
        )}
      </div>

      {/* Profile content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 -mt-16">

        {/* Avatar + Name + Bio */}
        <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-end mb-8">
          <div className="relative group shrink-0">
            {(editing ? editAvatarUrl : profile.avatarUrl) ? (
              <img
                src={editing ? editAvatarUrl : profile.avatarUrl}
                alt={user.name}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border-4 border-[#0a0a0f] shadow-xl shadow-purple-500/10"
              />
            ) : (
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-bold border-4 border-[#0a0a0f] shadow-xl shadow-purple-500/10">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            {isOwnProfile && editing && (
              <button
                onClick={() => setCropTarget("avatar")}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0 pb-1">
            <div className="flex flex-wrap items-center gap-2 gap-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white/95">{user.name}</h1>
              {displayedBadge && <BadgePill movieTitle={displayedBadge.movieTitle} isHolo={displayedBadge.isHolo} />}
            </div>
            {!editing ? (
              <p className="text-white/40 text-sm mt-1 max-w-md">
                {profile.bio || (isOwnProfile ? "No bio yet. Click edit to add one." : "No bio yet.")}
              </p>
            ) : (
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="Write something about yourself..."
                className="mt-2 w-full max-w-md rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 resize-none"
              />
            )}
          </div>

          {isOwnProfile && (
            <div className="shrink-0">
              {!editing ? (
                <button
                  onClick={() => {
                    setEditing(true);
                    setEditFeaturedCharacterIds(profile.featuredCardIds ?? []);
                    setBadgesSelecting(
                      profile.displayedBadgeShopItemId
                        ? { type: "shop", id: profile.displayedBadgeShopItemId }
                        : profile.displayedBadgeWinnerId
                          ? { type: "winner", id: profile.displayedBadgeWinnerId }
                          : null
                    );
                  }}
                  className="px-4 py-2 text-xs font-medium text-white/60 border border-white/10 rounded-lg hover:bg-white/[0.04] hover:text-white/80 transition-all cursor-pointer"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditBio(profile.bio);
                      setEditAvatarUrl(profile.avatarUrl);
                      setEditBannerUrl(profile.bannerUrl);
                      setEditCurrentPin("");
                      setEditNewPin("");
                      setPinError("");
                      setEditFeaturedCharacterIds(profile.featuredCardIds ?? []);
                      setFavoriteMovieSelecting(
                        profile.favoriteMovieTmdbId != null && profile.favoriteMovieSnapshot
                          ? { tmdbId: profile.favoriteMovieTmdbId, ...profile.favoriteMovieSnapshot }
                          : null
                      );
                      setBadgesSelecting(
                        profile.displayedBadgeShopItemId
                          ? { type: "shop", id: profile.displayedBadgeShopItemId }
                          : profile.displayedBadgeWinnerId
                            ? { type: "winner", id: profile.displayedBadgeWinnerId }
                            : null
                      );
                    }}
                    className="px-3 py-2 text-xs font-medium text-white/40 border border-white/10 rounded-lg hover:bg-white/[0.04] hover:text-white/60 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="px-4 py-2 text-xs font-medium bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-500 hover:to-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Equip Badge + Feature cards + Choose favourite movie (edit only) */}
        {isOwnProfile && editing && (
          <div className="mb-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowBadgeModal(true)}
              className="px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 text-sm font-medium hover:bg-amber-500/15 hover:border-amber-500/50 transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <span>Equip Badge</span>
              {displayedBadge && (
                <BadgePill movieTitle={displayedBadge.movieTitle} isHolo={displayedBadge.isHolo} className="opacity-90" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowFeaturedCardsModal(true)}
              className="px-4 py-2.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-sm font-medium hover:bg-cyan-500/15 hover:border-cyan-500/50 transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <span>Feature cards</span>
              {editFeaturedCharacterIds.length > 0 && (
                <span className="text-cyan-400/80">({editFeaturedCharacterIds.length}/6)</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowFavoriteMovieModal(true);
                setFavoriteMovieSearchQuery("");
                setFavoriteMovieSearchResults([]);
              }}
              className="px-4 py-2.5 rounded-xl border border-pink-500/40 bg-pink-500/10 text-pink-300 text-sm font-medium hover:bg-pink-500/15 hover:border-pink-500/50 transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <span>{favoriteMovieSelecting ? "Change favourite movie" : "Choose favourite movie"}</span>
              {favoriteMovieSelecting && (
                <span className="text-pink-400/80 truncate max-w-[120px]">{favoriteMovieSelecting.title}</span>
              )}
            </button>
            {favoriteMovieSelecting && (
              <button
                type="button"
                onClick={() => setFavoriteMovieSelecting(null)}
                className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white/50 text-sm hover:bg-white/10 hover:text-white/70 transition-colors cursor-pointer"
              >
                Clear favourite
              </button>
            )}
          </div>
        )}

        {/* Login PIN (edit only, own profile) */}
        {isOwnProfile && editing && data && (
          <div className="mb-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
            <h3 className="text-sm font-medium text-white/70 mb-3">Login PIN</h3>
            <p className="text-white/40 text-xs mb-3">
              Set or change the PIN you enter when logging in. Leave new PIN blank to remove it.
            </p>
            <div className="flex flex-wrap gap-3 items-end">
              {data.hasPin && (
                <div>
                  <label className="block text-[11px] text-white/40 mb-1">Current PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Current PIN"
                    value={editCurrentPin}
                    onChange={(e) => setEditCurrentPin(e.target.value)}
                    className="w-28 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-purple-500/40"
                  />
                </div>
              )}
              <div>
                <label className="block text-[11px] text-white/40 mb-1">{data.hasPin ? "New PIN" : "Set PIN"}</label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={data.hasPin ? "New PIN" : "PIN"}
                  value={editNewPin}
                  onChange={(e) => setEditNewPin(e.target.value)}
                  className="w-28 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-purple-500/40"
                />
              </div>
              <button
                type="button"
                onClick={savePin}
                disabled={pinSaving}
                className="px-4 py-2 rounded-lg border border-purple-500/40 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/15 disabled:opacity-50 cursor-pointer"
              >
                {pinSaving ? "Saving…" : data.hasPin ? "Update PIN" : "Set PIN"}
              </button>
            </div>
            {pinError && <p className="text-red-400/80 text-xs mt-2">{pinError}</p>}
          </div>
        )}

        {/* Favorite Movie hero */}
        {stats.favoriteMovie && (() => {
          const fm = stats.favoriteMovie!;
          const Wrapper = fm.winnerId ? Link : "a";
          const wrapperProps = fm.winnerId
            ? { href: `/winners/${fm.winnerId}` }
            : { href: fm.letterboxdUrl ?? "#", target: "_blank", rel: "noopener noreferrer" as const };
          return (
          <Wrapper
            {...wrapperProps}
            className="group block relative rounded-2xl overflow-hidden border border-white/[0.08] mb-6 hover:border-pink-500/20 transition-all"
          >
            {/* Backdrop */}
            <div className="absolute inset-0">
              {stats.favoriteMovie.backdropUrl ? (
                <img src={stats.favoriteMovie.backdropUrl} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              ) : stats.favoriteMovie.posterUrl ? (
                <img src={stats.favoriteMovie.posterUrl} alt="" className="w-full h-full object-cover blur-sm scale-110" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-900/40 to-purple-900/40" />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/50" />
            </div>

            <div className="relative flex items-center gap-5 p-5 sm:p-6">
              {/* Poster */}
              <div className="shrink-0 w-20 sm:w-24 aspect-[2/3] rounded-xl overflow-hidden border border-white/10 shadow-xl shadow-pink-500/10">
                {stats.favoriteMovie.posterUrl ? (
                  <img src={stats.favoriteMovie.posterUrl} alt={stats.favoriteMovie.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-pink-900/30 to-purple-900/30 flex items-center justify-center text-white/10 text-2xl font-bold">
                    {stats.favoriteMovie.title.charAt(0)}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <svg className="w-4 h-4 text-pink-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                  <span className="text-[11px] uppercase tracking-widest text-pink-400/60 font-medium">Favorite Movie</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white/95 truncate group-hover:text-pink-200 transition-colors">
                  {stats.favoriteMovie.title}
                </h3>
                {stats.favoriteMovie.year && (
                  <p className="text-sm text-white/30 mt-0.5">{stats.favoriteMovie.year}</p>
                )}
                {stats.favoriteMovie.stars != null && (
                <div className="flex items-center gap-3 mt-2.5">
                  {/* Stars */}
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => {
                      const starVal = stats.favoriteMovie!.stars ?? 0;
                      const filled = starVal >= s;
                      const half = !filled && starVal >= s - 0.5;
                      return (
                        <div key={s} className="relative w-4 h-4">
                          <svg className="w-4 h-4 text-white/10" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          {filled && (
                            <svg className="absolute inset-0 w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          )}
                          {half && (
                            <svg className="absolute inset-0 w-4 h-4 text-yellow-400" viewBox="0 0 24 24">
                              <defs><clipPath id={`fav-half-${s}`}><rect x="0" y="0" width="12" height="24" /></clipPath></defs>
                              <path clipPath={`url(#fav-half-${s})`} fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                    <span className="text-xs text-yellow-400/50 ml-1 font-medium">{stats.favoriteMovie!.stars}</span>
                  </div>
                  {/* Thumb */}
                  {stats.favoriteMovie!.thumbsUp != null && (stats.favoriteMovie!.thumbsUp ? (
                    <span className="flex items-center gap-1 text-green-400/60 text-xs">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2 20h2V8H2v12zm22-9a2 2 0 00-2-2h-6.31l.95-4.57.03-.32a1.5 1.5 0 00-.44-1.06L15.17 2 8.59 8.59A1.98 1.98 0 008 10v10a2 2 0 002 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" /></svg>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-400/60 text-xs">
                      <svg className="w-3.5 h-3.5 rotate-180" fill="currentColor" viewBox="0 0 24 24"><path d="M2 20h2V8H2v12zm22-9a2 2 0 00-2-2h-6.31l.95-4.57.03-.32a1.5 1.5 0 00-.44-1.06L15.17 2 8.59 8.59A1.98 1.98 0 008 10v10a2 2 0 002 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" /></svg>
                    </span>
                  ))}
                </div>
                )}
              </div>
            </div>
          </Wrapper>
          );
        })()}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Weeks Won" value={stats.totalWins} icon="trophy" />
          <StatCard
            label="Avg Rating"
            value={stats.avgStars ? `${stats.avgStars} / 5` : "—"}
            icon="star"
            onClick={() => setShowRatingsModal(true)}
          />
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <svg className="w-4 h-4 text-cyan-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              <span className="text-[11px] uppercase tracking-widest text-white/25 font-medium">Skips</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-cyan-400">{stats.skipsAvailable}</span>
              {stats.skipsUsed > 0 && (
                <span className="text-[11px] text-white/20">({stats.skipsUsed} used)</span>
              )}
            </div>
          </div>
          {isOwnProfile ? (
            <Link
              href="/cards"
              className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 hover:border-sky-400/40 hover:bg-sky-400/15 transition-colors block"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <svg className="w-4 h-4 text-sky-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[11px] uppercase tracking-widest text-white/25 font-medium">Credits</span>
              </div>
              <p className="text-xl font-bold text-sky-300">{creditBalance ?? "—"}</p>
            </Link>
          ) : (
            <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <svg className="w-4 h-4 text-sky-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[11px] uppercase tracking-widest text-white/25 font-medium">Credits</span>
              </div>
              <p className="text-xl font-bold text-sky-300">{creditBalance ?? "—"}</p>
            </div>
          )}
        </div>

        {/* Feature cards — pick from codex, up to 6 */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] uppercase tracking-widest text-white/25 font-medium">Feature cards</h3>
            <div className="flex items-center gap-2">
              {isOwnProfile && editing && (
                <button
                  type="button"
                  onClick={() => setShowFeaturedCardsModal(true)}
                  className="text-xs font-medium text-cyan-400/90 hover:text-cyan-400 border border-cyan-500/30 rounded-lg px-3 py-1.5 hover:bg-cyan-500/10 transition-colors"
                >
                  Edit featured
                </button>
              )}
              <button
                onClick={() => setShowCodexModal(true)}
                className="text-xs font-medium text-sky-400/90 hover:text-sky-400 border border-sky-500/30 rounded-lg px-3 py-1.5 hover:bg-sky-500/10 transition-colors"
              >
                View codex
              </button>
            </div>
          </div>
          {(() => {
            const displayedFeatured = isOwnProfile && editing
              ? editFeaturedCharacterIds
                  .map((id) => codexCards.find((c) => c.id === id))
                  .filter((c): c is FeaturedCard => c != null)
              : featuredCards;
            if (displayedFeatured.length === 0) {
              return (
                <p className="text-sm text-white/40">
                  {isOwnProfile
                    ? "No featured cards yet. Click Edit featured to pick up to 6 cards from your Codex."
                    : "No featured cards."}
                </p>
              );
            }
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {displayedFeatured.map((card) => (
                  <div key={card.id} className="relative w-full max-w-[120px] group">
                    <CardDisplay card={card} />
                    {isOwnProfile && editing && (
                      <button
                        type="button"
                        onClick={() => setEditFeaturedCharacterIds((prev) => prev.filter((id) => id !== card.id))}
                        className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-red-500/90 hover:bg-red-500 border border-white/20 text-white flex items-center justify-center text-xs font-bold shadow-lg opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white cursor-pointer transition-opacity"
                        aria-label={`Remove ${card.characterName || card.actorName} from featured`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Achievements — full-size badges (codex style) */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 mb-6">
          <h3 className="text-[11px] uppercase tracking-widest text-white/25 font-medium mb-4">Achievements</h3>
          {completedBadges.length === 0 ? (
            <p className="text-sm text-white/40">
              No badges yet. Complete card sets in the Codex (discover all 6 cards for a movie) or buy badges in the Shop.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {completedBadges.map((b) => {
                const isWinner = !!b.winnerId;
                const imageUrl = isWinner ? (b.posterUrl ?? "") : (b.imageUrl ?? "");
                const key = isWinner ? `w-${b.winnerId}` : `s-${b.shopItemId}`;
                return (
                  <div
                    key={key}
                    className="rounded-xl overflow-hidden border border-amber-500/30 bg-amber-500/5 transition-all hover:ring-2 hover:ring-amber-400/40"
                    style={{ aspectRatio: "1" }}
                  >
                    <div className="relative w-full h-full flex flex-col items-center justify-center p-3">
                      {imageUrl ? (
                        <>
                          <img
                            src={imageUrl}
                            alt=""
                            className="w-full h-full object-cover absolute inset-0"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                        </>
                      ) : (
                        <div className="w-full h-full absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                          <svg className="w-10 h-10 text-amber-400/80" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </div>
                      )}
                      <span className="relative z-10 text-xs font-medium text-center line-clamp-2 mt-auto text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {b.movieTitle || b.name || "Badge"}
                      </span>
                      {b.isHolo && (
                        <span
                          className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                          style={{
                            background: "linear-gradient(90deg, #ec4899, #f59e0b, #10b981, #3b82f6, #8b5cf6)",
                            boxShadow: "0 0 6px rgba(255,255,255,0.5)",
                          }}
                        >
                          HOLO
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Thumbs summary */}
        {stats.totalRatings > 0 && (
          <div className="flex items-center gap-4 mb-8 text-sm">
            <span className="flex items-center gap-1.5 text-green-400/70">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2 20h2V8H2v12zm22-9a2 2 0 00-2-2h-6.31l.95-4.57.03-.32a1.5 1.5 0 00-.44-1.06L15.17 2 8.59 8.59A1.98 1.98 0 008 10v10a2 2 0 002 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" /></svg>
              {stats.thumbsUpCount}
            </span>
            <span className="flex items-center gap-1.5 text-red-400/70">
              <svg className="w-4 h-4 rotate-180" fill="currentColor" viewBox="0 0 24 24"><path d="M2 20h2V8H2v12zm22-9a2 2 0 00-2-2h-6.31l.95-4.57.03-.32a1.5 1.5 0 00-.44-1.06L15.17 2 8.59 8.59A1.98 1.98 0 008 10v10a2 2 0 002 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" /></svg>
              {stats.thumbsDownCount}
            </span>
            <span className="text-white/20">|</span>
            <span className="text-white/40">{stats.totalRatings} movies rated</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-white/[0.06]">
          {([
            { key: "submissions" as const, label: "Submissions", count: submissions.length },
            { key: "wins" as const, label: "Wins", count: weeksWon.length },
            { key: "comments" as const, label: "Comments", count: comments.length },
            ...(isOwnProfile ? [{ key: "watchlist" as const, label: "Watchlist", count: watchlist.length }] : []),
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium transition-all cursor-pointer relative ${
                activeTab === tab.key
                  ? "text-white/90"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key
                    ? "bg-purple-500/20 text-purple-300"
                    : "bg-white/[0.04] text-white/25"
                }`}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mb-20">
          {/* Submissions library */}
          {activeTab === "submissions" && (
            submissions.length === 0 ? (
              <EmptyState icon="film" text="No submissions yet" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {submissions.map((s) => (
                  <div key={s.id} className="group relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] hover:border-white/10 transition-all">
                    <div className="aspect-[2/3] relative overflow-hidden bg-gradient-to-br from-purple-900/30 to-indigo-900/30">
                      {s.posterUrl ? (
                        <img src={s.posterUrl} alt={s.movieTitle} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/10 text-3xl font-bold">{s.movieTitle.charAt(0)}</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                      <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                        {s.weekTheme && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/20 border border-purple-500/25 text-purple-300 backdrop-blur-sm">
                            {s.weekTheme}
                          </span>
                        )}
                        {s.submissionCount != null && s.submissionCount > 1 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm border bg-white/15 border-white/25 text-white/90" title="Submitted this movie multiple times">
                            {s.submissionCount}×
                          </span>
                        )}
                      </div>
                    </div>
                    {s.letterboxdUrl && (
                      <a href={s.letterboxdUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-20 cursor-pointer" aria-label={`View ${s.movieTitle} on Letterboxd`} onClick={(e) => { e.preventDefault(); window.open(s.letterboxdUrl, "_blank", "noopener,noreferrer"); }} />
                    )}
                    <div className="p-3">
                      <h4 className="text-sm font-semibold text-white/90 truncate">{s.movieTitle}</h4>
                      <p className="text-[11px] text-white/30 mt-0.5">{s.year || ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Wins */}
          {activeTab === "wins" && (
            weeksWon.length === 0 ? (
              <EmptyState icon="trophy" text="No wins yet" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {weeksWon.map((w) => (
                  <Link href={`/winners/${w.winnerId}`} key={w.winnerId} className="group relative rounded-xl overflow-hidden border border-amber-500/10 bg-white/[0.02] hover:border-amber-500/25 transition-all">
                    <div className="aspect-[2/3] relative overflow-hidden bg-gradient-to-br from-amber-900/30 to-orange-900/30">
                      {w.posterUrl ? (
                        <img src={w.posterUrl} alt={w.movieTitle} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-amber-400/10 text-3xl font-bold">{w.movieTitle.charAt(0)}</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 border border-amber-500/25 text-amber-300 backdrop-blur-sm">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172" /></svg>
                        Winner
                      </div>
                      {w.weekTheme && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/20 border border-purple-500/25 text-purple-300 backdrop-blur-sm">
                          {w.weekTheme}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <h4 className="text-sm font-semibold text-white/90 truncate">{w.movieTitle}</h4>
                      <p className="text-[11px] text-white/30 mt-0.5">
                        {new Date(w.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {/* Comments timeline */}
          {activeTab === "comments" && (
            comments.length === 0 ? (
              <EmptyState icon="chat" text="No comments yet" />
            ) : (
              <div className="space-y-4">
                {comments.map((c) => (
                  <Link
                    href={`/winners/${c.winnerId}`}
                    key={c.id}
                    className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/10 hover:bg-white/[0.03] transition-all"
                  >
                    <div className="flex items-start gap-3">
                      {/* Tiny movie poster */}
                      <div className="w-10 h-14 rounded-md overflow-hidden shrink-0 bg-gradient-to-br from-purple-900/30 to-indigo-900/30">
                        {c.moviePosterUrl ? (
                          <img src={c.moviePosterUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-white/70">{user.name}</span>
                          <span className="text-[11px] text-white/20">&middot;</span>
                          <span className="text-[11px] text-white/25">{timeAgo(c.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-purple-400/60 mb-1.5">
                          on <span className="text-purple-400/80 font-medium">{c.movieTitle}</span>
                        </p>
                        <p className="text-sm text-white/70 leading-relaxed">{c.text}</p>
                        {c.mediaUrl && c.mediaType === "gif" && (
                          <div className="mt-2 rounded-lg overflow-hidden max-w-xs">
                            <iframe src={c.mediaUrl} className="w-full h-40" frameBorder="0" allowFullScreen />
                          </div>
                        )}
                        {c.mediaUrl && c.mediaType === "image" && (
                          <div className="mt-2 rounded-lg overflow-hidden max-w-xs">
                            <img src={c.mediaUrl} alt="" className="w-full object-cover rounded-lg" />
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {/* Watchlist — own profile only */}
          {activeTab === "watchlist" && isOwnProfile && (
            <div className="space-y-6">
              <p className="text-white/40 text-sm">
                Save movies you want to suggest in a future week. When submissions open, pick one from here or search as usual.
              </p>

              {/* Add movie — TMDB search */}
              <div ref={watchlistDropdownRef} className="relative max-w-md">
                <label className="block text-[11px] uppercase tracking-widest text-white/30 font-medium mb-2">Add movie</label>
                <div className="relative">
                  <input
                    type="text"
                    value={watchlistSearchQuery}
                    onChange={(e) => setWatchlistSearchQuery(e.target.value)}
                    onFocus={() => { if (watchlistSearchResults.length > 0) setWatchlistShowDropdown(true); }}
                    placeholder="Search for a movie..."
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors pr-10"
                    autoComplete="off"
                  />
                  {watchlistSearchLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                    </div>
                  )}
                  {!watchlistSearchLoading && watchlistSearchQuery.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setWatchlistSearchQuery(""); setWatchlistSearchResults([]); setWatchlistShowDropdown(false); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors cursor-pointer"
                      aria-label="Clear"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {watchlistShowDropdown && watchlistSearchResults.length > 0 && (
                  <div className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-white/[0.1] bg-[#1a1a2e]/95 backdrop-blur-xl shadow-2xl">
                    {watchlistSearchResults.map((r) => {
                      const inList = watchlist.some((w) => w.tmdbId === r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => !inList && addToWatchlist(r.id)}
                          disabled={inList || watchlistAdding}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.06] transition-colors text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {r.posterUrl ? (
                            <img src={r.posterUrl} alt={r.title} className="w-10 h-14 rounded object-cover flex-shrink-0 bg-white/5" />
                          ) : (
                            <div className="w-10 h-14 rounded bg-white/5 flex items-center justify-center flex-shrink-0 text-white/10 text-lg font-bold">{r.title.charAt(0)}</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white/80 truncate">{r.title}</p>
                            <p className="text-xs text-white/30">{r.year || "Unknown year"}</p>
                          </div>
                          {inList && (
                            <span className="text-[10px] text-green-400/70 font-medium shrink-0">In list</span>
                          )}
                          {!inList && watchlistAdding && (
                            <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {watchlistShowDropdown && watchlistSearchResults.length === 0 && !watchlistSearchLoading && watchlistSearchQuery.trim().length >= 2 && (
                  <div className="absolute z-30 mt-1 w-full rounded-xl border border-white/[0.1] bg-[#1a1a2e]/95 backdrop-blur-xl shadow-2xl px-4 py-6 text-center">
                    <p className="text-white/30 text-sm">No movies found. Try a different search.</p>
                  </div>
                )}
              </div>

              {/* Watchlist grid */}
              {watchlist.length === 0 ? (
                <EmptyState icon="bookmark" text="No movies in your watchlist yet" />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {watchlist.map((w) => (
                    <div
                      key={w.id}
                      className="group relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] hover:border-white/10 transition-all"
                    >
                      <div className="aspect-[2/3] relative overflow-hidden bg-gradient-to-br from-purple-900/30 to-indigo-900/30">
                        {w.posterUrl ? (
                          <img src={w.posterUrl} alt={w.movieTitle} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/10 text-3xl font-bold">{w.movieTitle.charAt(0)}</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFromWatchlist(w.tmdbId); }}
                          className="absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-black/50 border border-white/10 text-white/50 hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer"
                          aria-label={`Remove ${w.movieTitle} from watchlist`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      {w.letterboxdUrl && (
                        <a
                          href={w.letterboxdUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 z-10 cursor-pointer"
                          aria-label={`View ${w.movieTitle} on Letterboxd`}
                        />
                      )}
                      <div className="p-3 relative z-0">
                        <h4 className="text-sm font-semibold text-white/90 truncate">{w.movieTitle}</h4>
                        <p className="text-[11px] text-white/30 mt-0.5">{w.year || ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Ratings modal */}
      {showRatingsModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowRatingsModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="w-full max-w-xl max-h-[80vh] rounded-2xl border border-white/[0.08] bg-[var(--background,#050509)] shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                <div>
                  <h2 className="text-sm font-semibold text-white/80 uppercase tracking-widest">
                    Your Ratings
                  </h2>
                  <p className="text-xs text-white/30 mt-0.5">
                    Ranked from highest to lowest
                  </p>
                </div>
                <button
                  onClick={() => setShowRatingsModal(false)}
                  className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                {ratings.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm text-white/40">
                      You haven&apos;t rated any winners yet.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {ratings.map((r, idx) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
                      >
                        <span className="w-6 text-xs font-semibold text-white/30 tabular-nums text-center">
                          #{idx + 1}
                        </span>
                        <a
                          href={`/winners/${r.winnerId}`}
                          onClick={(e) => {
                            e.preventDefault();
                            window.open(`/winners/${r.winnerId}`, "_blank", "noopener,noreferrer");
                          }}
                          className="flex items-center gap-3 flex-1 min-w-0 group cursor-pointer"
                        >
                          <div className="w-10 h-14 rounded-md overflow-hidden bg-gradient-to-br from-purple-900/40 to-indigo-900/40 flex-shrink-0 border border-white/[0.06]">
                            {r.posterUrl ? (
                              <img src={r.posterUrl} alt={r.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/10 text-xs font-bold">
                                {r.title.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-white/85 truncate group-hover:text-purple-200 transition-colors">
                                {r.title}
                              </p>
                              {r.year && (
                                <span className="text-[11px] text-white/30 flex-shrink-0">
                                  {r.year}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => {
                                  const starVal = r.stars;
                                  const filled = starVal >= s;
                                  const half = !filled && starVal >= s - 0.5;
                                  return (
                                    <div key={s} className="relative w-3.5 h-3.5">
                                      <svg className="w-3.5 h-3.5 text-white/10" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                      </svg>
                                      {filled && (
                                        <svg className="absolute inset-0 w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                        </svg>
                                      )}
                                      {half && (
                                        <svg className="absolute inset-0 w-3.5 h-3.5 text-yellow-400" viewBox="0 0 24 24">
                                          <defs>
                                            <clipPath id={`profile-rating-half-${r.id}-${s}`}>
                                              <rect x="0" y="0" width="12" height="24" />
                                            </clipPath>
                                          </defs>
                                          <path
                                            clipPath={`url(#profile-rating-half-${r.id}-${s})`}
                                            fill="currentColor"
                                            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                          />
                                        </svg>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              <span className="text-[11px] text-yellow-400/70 font-medium tabular-nums">
                                {r.stars.toFixed(1)} / 5
                              </span>
                              <span className="text-[11px] text-white/25">
                                &middot; {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        </a>
                        <span className="ml-1">
                          {r.thumbsUp ? (
                            <span className="text-green-400/70 text-lg leading-none">👍</span>
                          ) : (
                            <span className="text-red-400/70 text-lg leading-none">👎</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* View codex modal (another user's codex) */}
      {/* Feature cards modal — pick from codex (max 6) */}
      {showFeaturedCardsModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFeaturedCardsModal(false)}
            aria-hidden
          />
          <div
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl max-h-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col"
            role="dialog"
            aria-label="Feature cards"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <h3 className="text-lg font-bold text-white/90">Feature cards</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-white/50">{editFeaturedCharacterIds.length} / 6 selected</span>
                <button
                  onClick={() => setShowFeaturedCardsModal(false)}
                  className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 min-h-0">
              <p className="text-sm text-white/50 mb-4">Pick up to 6 cards from your Codex to feature on your profile. Click a card to add or remove.</p>
              {codexCards.length === 0 ? (
                <p className="text-sm text-white/40 text-center py-8">No cards in your Codex yet. Upload cards from your inventory to the Codex first.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                  {codexCards.map((card) => {
                    const isSelected = editFeaturedCharacterIds.includes(card.id);
                    const canAdd = !isSelected && editFeaturedCharacterIds.length < 6;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setEditFeaturedCharacterIds((prev) => prev.filter((id) => id !== card.id));
                          } else if (canAdd) {
                            setEditFeaturedCharacterIds((prev) => [...prev, card.id]);
                          }
                        }}
                        className={`relative w-full max-w-[140px] mx-auto rounded-xl overflow-hidden ring-2 transition-all cursor-pointer focus:outline-none focus:ring-cyan-400 ${
                          isSelected ? "ring-cyan-400/80 ring-offset-2 ring-offset-[#0a0a0f]" : "ring-transparent hover:ring-white/20"
                        } ${!isSelected && !canAdd ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        <CardDisplay card={card} />
                        {isSelected && (
                          <span className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg" aria-hidden>
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setShowFeaturedCardsModal(false)}
                className="w-full px-4 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-medium hover:bg-cyan-500/30 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {showCodexModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCodexModal(false)}
            aria-hidden
          />
          <div
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl max-h-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col"
            role="dialog"
            aria-label="View codex"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 flex-wrap gap-3">
              <h3 className="text-lg font-bold text-white/90">{user.name}&apos;s codex</h3>
              <div className="flex items-center gap-2">
                {(["set", "name", "rarity"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCodexViewSort(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      codexViewSort === key
                        ? "bg-sky-500/20 border border-sky-400/50 text-sky-300"
                        : "bg-white/[0.06] border border-white/[0.12] text-white/70 hover:bg-white/[0.1] hover:text-white/90"
                    }`}
                  >
                    {key === "set" ? "Set" : key === "name" ? "Name" : "Rarity"}
                  </button>
                ))}
                <button
                  onClick={() => setShowCodexModal(false)}
                  className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 min-h-0">
              {codexCards.length === 0 ? (
                <p className="text-sm text-white/40 text-center py-8">No cards discovered in this codex.</p>
              ) : (() => {
                const rarityOrder: Record<string, number> = { legendary: 4, epic: 3, rare: 2, uncommon: 1 };
                if (codexViewSort === "set") {
                  const bySet = new Map<string, FeaturedCard[]>();
                  for (const card of codexCards) {
                    const key = card.movieTitle || "Unknown";
                    if (!bySet.has(key)) bySet.set(key, []);
                    bySet.get(key)!.push(card);
                  }
                  const rarityOrder: Record<string, number> = { legendary: 4, epic: 3, rare: 2, uncommon: 1 };
                  const sets = Array.from(bySet.entries())
                    .map(([title, cards]) => ({
                      title,
                      cards: [...cards].sort(
                        (a, b) => (rarityOrder[b.rarity] ?? 0) - (rarityOrder[a.rarity] ?? 0)
                      ),
                    }))
                    .sort((a, b) => {
                      if (a.cards.length !== b.cards.length) return b.cards.length - a.cards.length;
                      return a.title.localeCompare(b.title);
                    });
                  return (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                      {sets.flatMap((set, setIndex) => [
                        setIndex > 0 ? (
                          <div key={`codex-break-${setIndex}`} className="col-span-full border-t border-white/10 mt-2 mb-2 pt-2" aria-hidden />
                        ) : null,
                        <div key={`codex-set-${setIndex}`} className="col-span-full text-xs font-medium text-white/40 uppercase tracking-wider mb-1">
                          {set.title}
                        </div>,
                        ...set.cards.map((card) => (
                          <div key={card.id} className="w-full max-w-[140px] mx-auto">
                            <CardDisplay card={card} />
                          </div>
                        )),
                      ])}
                    </div>
                  );
                }
                const sorted =
                  codexViewSort === "name"
                    ? [...codexCards].sort((a, b) =>
                        (a.characterName || a.actorName || "").localeCompare(b.characterName || b.actorName || "")
                      )
                    : [...codexCards].sort(
                        (a, b) => (rarityOrder[b.rarity] ?? 0) - (rarityOrder[a.rarity] ?? 0)
                      );
                return (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                    {sorted.map((card) => (
                      <div key={card.id} className="w-full max-w-[140px] mx-auto">
                        <CardDisplay card={card} />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* Choose favourite movie modal */}
      {showFavoriteMovieModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFavoriteMovieModal(false)}
            aria-hidden
          />
          <div
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden"
            role="dialog"
            aria-label="Choose favourite movie"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/10">
              <h3 className="text-lg font-bold text-white/90">Choose favourite movie</h3>
              <p className="text-sm text-white/50 mt-1">Search TMDB to pick a movie to display on your profile.</p>
            </div>
            <div className="p-4">
              <input
                type="text"
                value={favoriteMovieSearchQuery}
                onChange={(e) => setFavoriteMovieSearchQuery(e.target.value)}
                placeholder="Search movies..."
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-pink-500/40"
                autoFocus
              />
              <div className="mt-3 max-h-64 overflow-y-auto space-y-2 scrollbar-autocomplete">
                {favoriteMovieSearchLoading && (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-pink-400/30 border-t-pink-400 rounded-full animate-spin" />
                  </div>
                )}
                {!favoriteMovieSearchLoading && favoriteMovieSearchQuery.trim().length >= 2 && favoriteMovieSearchResults.length === 0 && (
                  <p className="text-sm text-white/40 text-center py-4">No results. Try a different search.</p>
                )}
                {!favoriteMovieSearchLoading &&
                  favoriteMovieSearchResults.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/tmdb/movie/${m.id}`);
                          if (!res.ok) return;
                          const movie = await res.json();
                          setFavoriteMovieSelecting({
                            tmdbId: movie.tmdbId,
                            title: movie.title,
                            posterUrl: movie.posterUrl || "",
                            backdropUrl: movie.backdropUrl || "",
                            year: movie.year || "",
                            letterboxdUrl: movie.letterboxdUrl || "",
                          });
                          setShowFavoriteMovieModal(false);
                        } catch { /* ignore */ }
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-white/[0.08] hover:border-pink-500/30 hover:bg-pink-500/10 transition-colors cursor-pointer text-left"
                    >
                      {m.posterUrl ? (
                        <img src={m.posterUrl} alt="" className="w-10 h-14 object-cover rounded flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-14 rounded bg-white/5 flex items-center justify-center text-white/20 text-xs flex-shrink-0">?</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white/90 truncate">{m.title}</p>
                        {m.year && <p className="text-xs text-white/40">{m.year}</p>}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
            <div className="p-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowFavoriteMovieModal(false)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {/* Equip Badge modal */}
      {showBadgeModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowBadgeModal(false)}
            aria-hidden
          />
          <div
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden"
            role="dialog"
            aria-label="Equip Badge"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/10">
              <h3 className="text-lg font-bold text-white/90">Equip Badge</h3>
              <p className="text-sm text-white/50 mt-1">Choose a badge to show next to your name.</p>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setBadgesSelecting(null)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    badgesSelecting === null
                      ? "border-amber-500/50 bg-amber-500/10"
                      : "border-white/[0.08] hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="text-sm text-white/60">None (unequip badge)</span>
                </button>
                {completedBadges
                  .filter((b) => b.winnerId || b.shopItemId)
                  .map((b) => {
                    const isWinner = !!b.winnerId;
                    const selectionValue: BadgeSelection = isWinner
                      ? { type: "winner", id: b.winnerId! }
                      : { type: "shop", id: b.shopItemId! };
                    const selected =
                      badgesSelecting?.type === selectionValue.type &&
                      badgesSelecting.id === selectionValue.id;
                    const key = isWinner ? `w-${b.winnerId}` : `s-${b.shopItemId}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setBadgesSelecting(selectionValue)}
                        className={`w-full flex items-center justify-center gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                          selected
                            ? "border-amber-500/50 bg-amber-500/10"
                            : "border-white/[0.08] hover:bg-white/[0.06]"
                        }`}
                      >
                        <div className="flex items-center justify-center min-h-[32px]">
                          <BadgePill movieTitle={b.movieTitle} isHolo={b.isHolo} />
                        </div>
                      </button>
                    );
                  })}
              </div>
              {completedBadges.length === 0 && (
                <p className="text-sm text-white/40 text-center py-4">No badges yet. Complete card sets or buy badges in the Shop.</p>
              )}
            </div>
            <div className="p-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowBadgeModal(false)}
                className="w-full px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-medium hover:bg-amber-500/30 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {/* Crop modals */}
      <ImageCropModal
        open={cropTarget === "avatar"}
        onClose={() => setCropTarget(null)}
        onComplete={handleCropComplete}
        aspect={1}
        title="Edit Profile Picture"
        cropShape="round"
      />
      <ImageCropModal
        open={cropTarget === "banner"}
        onClose={() => setCropTarget(null)}
        onComplete={handleCropComplete}
        aspect={3}
        title="Edit Banner"
      />
    </div>
  );
}

// ─── Helper components ───────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  small,
  onClick,
}: {
  label: string;
  value: string | number;
  icon?: string;
  small?: boolean;
  onClick?: () => void;
}) {
  const iconEl =
    icon === "trophy" ? (
      <svg className="w-4 h-4 text-amber-400/60" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172" /></svg>
    ) : icon === "star" ? (
      <svg className="w-4 h-4 text-yellow-400/60" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
    ) : icon === "heart" ? (
      <svg className="w-4 h-4 text-pink-400/60" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
    ) : null;

  const clickable = !!onClick;

  return (
    <div
      className={`rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 ${
        clickable ? "cursor-pointer hover:border-purple-500/40 hover:bg-white/[0.04] transition-colors" : ""
      }`}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {iconEl}
        <span className="text-[11px] uppercase tracking-widest text-white/25 font-medium">{label}</span>
      </div>
      <p className={`font-bold text-white/80 ${small ? "text-sm truncate" : "text-xl"}`}>{value}</p>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-white/15">
      {icon === "film" && (
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
      )}
      {icon === "trophy" && (
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497" /></svg>
      )}
      {icon === "chat" && (
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
      )}
      {icon === "bookmark" && (
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
      )}
      <p className="text-sm">{text}</p>
    </div>
  );
}
