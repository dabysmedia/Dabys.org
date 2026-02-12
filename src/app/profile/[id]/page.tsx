"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import ImageCropModal from "@/components/ImageCropModal";
import Header from "@/components/Header";
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
  winnerId: string;
  movieTitle: string;
  isHolo?: boolean;
}

interface CompletedBadge {
  winnerId: string;
  movieTitle: string;
  isHolo?: boolean;
}

interface FavoriteMovie {
  title: string;
  posterUrl: string;
  backdropUrl: string;
  year: string;
  winnerId: string;
  stars: number;
  thumbsUp: boolean;
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
  profile: ProfileData;
  stats: Stats;
  ratings: RatingEntry[];
  submissions: SubEntry[];
  weeksWon: WinEntry[];
  comments: CommentEntry[];
  watchlist: WatchlistEntry[];
  featuredCards?: FeaturedCard[];
  displayedBadge?: DisplayedBadge | null;
  displayedBadges?: DisplayedBadge[];
  completedWinnerIds?: string[];
  completedBadges?: CompletedBadge[];
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

  // Featured collection modal
  const [showFeaturedModal, setShowFeaturedModal] = useState(false);
  const [featuredSelecting, setFeaturedSelecting] = useState<string[]>([]);
  const [featuredSaving, setFeaturedSaving] = useState(false);
  const [userCardsForFeatured, setUserCardsForFeatured] = useState<FeaturedCard[]>([]);

  // Badges modal
  const [badgesSelecting, setBadgesSelecting] = useState<string | null>(null);

  // Credits (for profile user)
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

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
          displayedBadgeWinnerId: badgesSelecting,
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

  async function saveFeaturedCards() {
    setFeaturedSaving(true);
    try {
      await fetch(`/api/users/${profileId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featuredCardIds: featuredSelecting.slice(0, 6) }),
      });
      const res = await fetch(`/api/users/${profileId}/profile`);
      if (res.ok) setData(await res.json());
      setShowFeaturedModal(false);
    } finally {
      setFeaturedSaving(false);
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

      <Header />

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
              <>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  maxLength={300}
                  rows={2}
                  placeholder="Write something about yourself..."
                  className="mt-2 w-full max-w-md rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 resize-none"
                />
                {completedBadges.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] uppercase tracking-widest text-white/40 mb-2">Display badge</p>
                    <p className="text-xs text-white/50 mb-2">Choose one badge to show next to your name.</p>
                    <div className="space-y-1.5">
                      <label className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${badgesSelecting === null ? "border-amber-500/50 bg-amber-500/10" : "border-white/10 hover:bg-white/[0.04]"}`}>
                        <input type="radio" name="displayedBadge" checked={badgesSelecting === null} onChange={() => setBadgesSelecting(null)} className="border-white/30" />
                        <span className="text-sm text-white/60">None</span>
                      </label>
                      {completedBadges.map((b) => {
                        const wid = b.winnerId;
                        const selected = badgesSelecting === wid;
                        return (
                          <label
                            key={wid}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selected ? "border-amber-500/50 bg-amber-500/10" : "border-white/10 hover:bg-white/[0.04]"}`}
                          >
                            <input type="radio" name="displayedBadge" checked={selected} onChange={() => setBadgesSelecting(wid)} className="border-white/30" />
                            <BadgePill movieTitle={b.movieTitle} isHolo={b.isHolo} />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {isOwnProfile && (
            <div className="shrink-0">
              {!editing ? (
                <button
                  onClick={() => { setEditing(true); setBadgesSelecting(profile.displayedBadgeWinnerId ?? null); }}
                  className="px-4 py-2 text-xs font-medium text-white/60 border border-white/10 rounded-lg hover:bg-white/[0.04] hover:text-white/80 transition-all cursor-pointer"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditing(false); setEditBio(profile.bio); setEditAvatarUrl(profile.avatarUrl); setEditBannerUrl(profile.bannerUrl); setBadgesSelecting(profile.displayedBadgeWinnerId ?? null); }}
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

        {/* Favorite Movie hero */}
        {stats.favoriteMovie && (
          <Link
            href={`/winners/${stats.favoriteMovie.winnerId}`}
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
                <div className="flex items-center gap-3 mt-2.5">
                  {/* Stars */}
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => {
                      const starVal = stats.favoriteMovie!.stars;
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
                  {stats.favoriteMovie.thumbsUp ? (
                    <span className="flex items-center gap-1 text-green-400/60 text-xs">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2 20h2V8H2v12zm22-9a2 2 0 00-2-2h-6.31l.95-4.57.03-.32a1.5 1.5 0 00-.44-1.06L15.17 2 8.59 8.59A1.98 1.98 0 008 10v10a2 2 0 002 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" /></svg>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-400/60 text-xs">
                      <svg className="w-3.5 h-3.5 rotate-180" fill="currentColor" viewBox="0 0 24 24"><path d="M2 20h2V8H2v12zm22-9a2 2 0 00-2-2h-6.31l.95-4.57.03-.32a1.5 1.5 0 00-.44-1.06L15.17 2 8.59 8.59A1.98 1.98 0 008 10v10a2 2 0 002 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" /></svg>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        )}

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
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-amber-500/40 hover:bg-white/[0.04] transition-colors block"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <svg className="w-4 h-4 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[11px] uppercase tracking-widest text-white/25 font-medium">Credits</span>
              </div>
              <p className="text-xl font-bold text-amber-400">{creditBalance ?? "—"}</p>
            </Link>
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <svg className="w-4 h-4 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[11px] uppercase tracking-widest text-white/25 font-medium">Credits</span>
              </div>
              <p className="text-xl font-bold text-amber-400">{creditBalance ?? "—"}</p>
            </div>
          )}
        </div>

        {/* Featured Collection */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] uppercase tracking-widest text-white/25 font-medium">Featured Collection</h3>
            {isOwnProfile && (
              <button
                onClick={() => {
                  setShowFeaturedModal(true);
                  setFeaturedSelecting(profile.featuredCardIds ?? []);
                  fetch(`/api/cards?userId=${profileId}`)
                    .then((r) => r.json())
                    .then((cards: FeaturedCard[]) => setUserCardsForFeatured(cards))
                    .catch(() => setUserCardsForFeatured([]));
                }}
                className="text-xs text-amber-400/80 hover:text-amber-400 transition-colors"
              >
                Edit
              </button>
            )}
          </div>
          {featuredCards.length === 0 ? (
            <p className="text-sm text-white/40">
              {isOwnProfile ? "No featured cards yet. Click Edit to add up to 6 from your collection." : "No featured cards."}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {featuredCards.map((card) => (
                <div key={card.id} className="w-full max-w-[120px]">
                  <CardDisplay card={card} />
                </div>
              ))}
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

      {/* Featured Collection modal */}
      {showFeaturedModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFeaturedModal(false)}
            aria-hidden
          />
          <div
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-[var(--background)] shadow-2xl overflow-hidden"
            role="dialog"
            aria-label="Edit featured collection"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-bold text-white/90 mb-4">Featured Collection</h3>
              <p className="text-sm text-white/50 mb-4">Select up to 6 cards to display (click to toggle)</p>
              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto scrollbar-autocomplete mb-4">
                {userCardsForFeatured.map((card) => {
                  const selected = featuredSelecting.includes(card.id!);
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        setFeaturedSelecting((prev) =>
                          selected ? prev.filter((id) => id !== card.id) : prev.length < 6 ? [...prev, card.id!] : prev
                        );
                      }}
                      className={`text-left rounded-lg border overflow-hidden transition-all ${
                        selected ? "ring-2 ring-amber-500 border-amber-500/50" : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="aspect-[2/3] relative">
                        {card.profilePath ? (
                          <img src={card.profilePath} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20 text-2xl font-bold">
                            {card.actorName?.charAt(0) ?? "?"}
                          </div>
                        )}
                        {selected && (
                          <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center">
                            ✓
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/60 truncate px-1 py-0.5">{card.actorName}</p>
                    </button>
                  );
                })}
              </div>
              {userCardsForFeatured.length === 0 && (
                <p className="text-sm text-white/40 mb-4">No cards in your collection. Buy packs in Cards to get started.</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFeaturedModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-white/70 hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button
                  onClick={saveFeaturedCards}
                  disabled={featuredSaving}
                  className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 disabled:opacity-50"
                >
                  {featuredSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Badges modal */}
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

      {/* Footer */}
      <ProfileFooter />
    </div>
  );
}

function ProfileFooter() {
  const router = useRouter();
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAdminError("");
    setAdminLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (res.ok) { router.push("/admin"); }
      else { setAdminError("Wrong password"); setAdminPassword(""); }
    } catch { setAdminError("Something went wrong"); }
    finally { setAdminLoading(false); }
  }

  return (
    <footer className="relative z-10 border-t border-white/[0.04] mt-16">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col items-center gap-4">
        <button onClick={() => { setAdminOpen(!adminOpen); setAdminError(""); setAdminPassword(""); }} className="text-white/10 text-[11px] hover:text-white/30 transition-colors cursor-pointer">Admin Panel</button>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out w-full max-w-xs ${adminOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
          <form onSubmit={handleAdminLogin} className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-3">
            <div className="flex gap-2">
              <input type="password" placeholder="Password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors" />
              <button type="submit" disabled={adminLoading || !adminPassword} className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                {adminLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Go"}
              </button>
            </div>
            {adminError && <p className="text-red-400/80 text-xs mt-2">{adminError}</p>}
          </form>
        </div>
        <p className="text-white/8 text-[10px] tracking-widest uppercase">Dabys Media Group</p>
      </div>
    </footer>
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
