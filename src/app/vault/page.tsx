"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface VaultVideo {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  thumbnailUrl?: string;
  order: number;
  featured: boolean;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: { videoId: string; events?: { onStateChange?: (e: { data: number }) => void } }
      ) => { destroy: () => void };
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

function VaultVideoCard({
  video,
  userId,
  alreadyClaimed,
  creditsPerWatch,
  minWatchSeconds,
  onClaimed,
}: {
  video: VaultVideo;
  userId: string;
  alreadyClaimed: boolean;
  creditsPerWatch: number;
  minWatchSeconds: number;
  onClaimed: () => void;
}) {
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerRef = useRef<InstanceType<NonNullable<typeof window.YT>["Player"]> | null>(null);
  const containerId = `yt-player-${video.id}`;

  const canClaim = !alreadyClaimed && watchSeconds >= minWatchSeconds;

  // Load YouTube IFrame API
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.YT?.Player) {
      setApiReady(true);
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript?.parentNode?.insertBefore(tag, firstScript);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      setApiReady(true);
    };
  }, []);

  // Create player and handle state changes (player always created so video can be re-watched; credits only on first claim)
  useEffect(() => {
    if (!apiReady || !video.youtubeId) return;
    const YT = window.YT;
    if (!YT?.Player) return;

    const el = document.getElementById(containerId);
    if (!el) return;

    const player = new YT.Player(containerId, {
      videoId: video.youtubeId,
      events: {
        onStateChange(e: { data: number }) {
          const PLAYING = 1;
          const PAUSED = 2;
          const ENDED = 0;
          if (e.data === ENDED) {
            setIsPlaying(false);
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          } else if (e.data === PLAYING) {
            setIsPlaying(true);
            setHasStarted(true);
            if (!timerRef.current) {
              timerRef.current = setInterval(() => {
                setWatchSeconds((s) => s + 1);
              }, 1000);
            }
          } else if (e.data === PAUSED) {
            setIsPlaying(false);
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
        },
      },
    });
    playerRef.current = player as unknown as InstanceType<NonNullable<typeof window.YT>["Player"]>;

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [apiReady, video.youtubeId, video.id]);

  async function handleClaim() {
    if (!canClaim || claiming) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await fetch("/api/vault/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, videoId: video.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onClaimed();
        window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta: data.creditsAwarded } }));
      } else {
        setClaimError(data.message || "Could not claim credits");
      }
    } catch {
      setClaimError("Something went wrong");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
      <div className="aspect-video bg-black relative">
        <div id={containerId} className="w-full h-full" />
        {video.featured && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-medium uppercase tracking-wider">
            Featured
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-lg font-semibold text-white/90">{video.title}</h3>
        {video.description && (
          <p className="text-white/50 text-sm mt-1">{video.description}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {alreadyClaimed ? (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Credits claimed
            </span>
          ) : (
            <>
              {watchSeconds < minWatchSeconds ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-white/40 text-sm">
                    {isPlaying ? (
                      <>Watching: {watchSeconds}s / {minWatchSeconds}s</>
                    ) : hasStarted ? (
                      <>Paused — timer stopped. Play to continue.</>
                    ) : (
                      <>Press play to start. Timer only runs while playing (no pause or skip).</>
                    )}
                  </span>
                  <span className="text-white/30 text-xs">
                    {minWatchSeconds - watchSeconds}s more to unlock claim
                  </span>
                </div>
              ) : (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {claiming ? (
                    <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  Claim {creditsPerWatch} credits
                </button>
              )}
            </>
          )}
          {claimError && (
            <span className="text-red-400/80 text-sm">{claimError}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VaultPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [videos, setVideos] = useState<VaultVideo[]>([]);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [creditsPerWatch, setCreditsPerWatch] = useState(25);
  const [minWatchMinutes, setMinWatchMinutes] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) {
      router.replace("/login");
      return;
    }
    try {
      const u = JSON.parse(cached) as { id: string; name: string };
      setUser(u);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/vault")
      .then((r) => (r.ok ? r.json() : { videos: [], creditsPerWatch: 25 }))
      .then((data: { videos?: VaultVideo[]; creditsPerWatch?: number; vaultMinWatchMinutes?: number }) => {
        setVideos(Array.isArray(data.videos) ? data.videos : []);
        setCreditsPerWatch(typeof data.creditsPerWatch === "number" ? data.creditsPerWatch : 25);
        setMinWatchMinutes(typeof data.vaultMinWatchMinutes === "number" ? data.vaultMinWatchMinutes : 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/vault/claimed?userId=${encodeURIComponent(user.id)}`)
      .then((r) => (r.ok ? r.json() : { claimedVideoIds: [] }))
      .then((data) => setClaimedIds(new Set(data.claimedVideoIds || [])))
      .catch(() => {});
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  const handleClaimed = (videoId: string) => {
    setClaimedIds((prev) => new Set(prev).add(videoId));
  };

  const featured = videos.filter((v) => v.featured);
  const other = videos.filter((v) => !v.featured);

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-purple-600/10 blur-[160px]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[140px]" />
      </div>

      <main className="relative z-10 px-4 sm:px-6 py-8 sm:py-10">
        <div className="max-w-4xl mx-auto mb-8">
          <h1
            className="text-2xl sm:text-3xl font-bold text-white/90 font-card-title"
            style={{ fontFamily: "'Libre Baskerville', serif" }}
          >
            The Vault
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Original Dabys Media content. Watch to earn credits — first watch per video only.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : videos.length === 0 ? (
          <div className="max-w-4xl mx-auto rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-12 text-center">
            <p className="text-white/50">No videos in the Vault yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {featured.length > 0 && (
              <section className="w-full max-w-[min(100%,1400px)] mx-auto">
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
                  Featured
                </h2>
                <div className="w-full">
                  {featured.map((v) => (
                    <VaultVideoCard
                      key={v.id}
                      video={v}
                      userId={user.id}
                      alreadyClaimed={claimedIds.has(v.id)}
                      creditsPerWatch={creditsPerWatch}
                      minWatchSeconds={minWatchMinutes * 60}
                      onClaimed={() => handleClaimed(v.id)}
                    />
                  ))}
                </div>
              </section>
            )}
            {other.length > 0 && (
              <section className="max-w-4xl mx-auto">
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
                  More from Dabys Media
                </h2>
                <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
                  {other.map((v) => (
                    <VaultVideoCard
                      key={v.id}
                      video={v}
                      userId={user.id}
                      alreadyClaimed={claimedIds.has(v.id)}
                      creditsPerWatch={creditsPerWatch}
                      minWatchSeconds={minWatchMinutes * 60}
                      onClaimed={() => handleClaimed(v.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
