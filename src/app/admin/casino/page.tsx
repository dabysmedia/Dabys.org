"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type CasinoTab = "slots" | "blackjack" | "roulette" | "dabys-bets" | "lottery";

interface DabysBetsEvent {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  oddsA: number;
  oddsB: number;
  minBet: number;
  maxBet: number;
  isActive: boolean;
  createdAt: string;
}

interface LotterySettings {
  ticketCost: number;
  startingPool: number;
  houseTakePercent: number;
  scratchOff?: {
    cost: number;
    paytable: Record<string, number>;
    winChanceDenom?: Record<string, number>;
  };
}

interface CasinoGameSettings {
  slots: {
    minBet: number;
    maxBet: number;
    validBets: number[];
    paytable: Record<string, number>;
    paytable2oak: number;
  };
  blackjack: { minBet: number; maxBet: number; blackjackPayout: number };
  roulette: { minBet: number; maxBet: number; betStep: number; colorPayout: number; straightPayout: number };
}

export default function AdminCasinoPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const validTabs: CasinoTab[] = ["slots", "blackjack", "roulette", "lottery", "dabys-bets"];
  const initialTab: CasinoTab = validTabs.includes(tabParam as CasinoTab) ? (tabParam as CasinoTab) : "slots";
  const [activeTab, setActiveTab] = useState<CasinoTab>(initialTab);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white/90">Casino</h1>
          <p className="text-sm text-white/40 mt-1">Dabys Bets and Lottery</p>
        </div>
        <Link
          href="/casino"
          target="_blank"
          className="px-4 py-2 rounded-lg border border-purple-500/30 text-purple-300 text-sm font-medium hover:bg-purple-500/10 transition-all"
        >
          Open Casino &rarr;
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {(["slots", "blackjack", "roulette", "lottery", "dabys-bets"] as CasinoTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === tab
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "bg-white/[0.04] text-white/50 border border-white/[0.08] hover:text-white/70"
            }`}
          >
            {tab === "dabys-bets" ? "Dabys Bets" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300 text-sm">
          {success}
        </div>
      )}

      {activeTab === "slots" && (
        <SlotsSection
          onError={setError}
          onSuccess={(msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); }}
        />
      )}
      {activeTab === "blackjack" && (
        <BlackjackSection
          onError={setError}
          onSuccess={(msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); }}
        />
      )}
      {activeTab === "roulette" && (
        <RouletteSection
          onError={setError}
          onSuccess={(msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); }}
        />
      )}
      {activeTab === "dabys-bets" && (
        <DabysBetsSection
          onError={setError}
          onSuccess={(msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); }}
        />
      )}
      {activeTab === "lottery" && (
        <LotterySection
          onError={setError}
          onSuccess={(msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); }}
        />
      )}
    </div>
  );
}

function SlotsSection({ onError, onSuccess }: { onError: (s: string) => void; onSuccess: (s: string) => void }) {
  const [settings, setSettings] = useState<CasinoGameSettings["slots"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [minBet, setMinBet] = useState("5");
  const [maxBet, setMaxBet] = useState("100");
  const [validBetsStr, setValidBetsStr] = useState("5, 10, 25, 50, 100");
  const [pay7, setPay7] = useState("43");
  const [payBAR, setPayBAR] = useState("21");
  const [payStar, setPayStar] = useState("13");
  const [payBell, setPayBell] = useState("9");
  const [payCherry, setPayCherry] = useState("4");
  const [pay2oak, setPay2oak] = useState("0.25");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch("/api/admin/casino-settings");
      if (res.ok) {
        const data = await res.json();
        const s = data.slots;
        setSettings(s);
        setMinBet(String(s.minBet));
        setMaxBet(String(s.maxBet));
        setValidBetsStr(s.validBets.join(", "));
        setPay7(String(s.paytable?.["7"] ?? 43));
        setPayBAR(String(s.paytable?.BAR ?? 21));
        setPayStar(String(s.paytable?.star ?? 13));
        setPayBell(String(s.paytable?.bell ?? 9));
        setPayCherry(String(s.paytable?.cherry ?? 4));
        setPay2oak(String(s.paytable2oak ?? 0.25));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleSave() {
    onError("");
    const min = parseInt(minBet, 10);
    const max = parseInt(maxBet, 10);
    const bets = validBetsStr.split(/[\s,]+/).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n >= 1);
    const paytable = {
      "7": parseInt(pay7, 10) || 43,
      BAR: parseInt(payBAR, 10) || 21,
      star: parseInt(payStar, 10) || 13,
      bell: parseInt(payBell, 10) || 9,
      cherry: parseInt(payCherry, 10) || 4,
    };
    const paytable2oak = parseFloat(pay2oak) || 0.25;
    if (isNaN(min) || min < 1) {
      onError("Min bet must be at least 1");
      return;
    }
    if (isNaN(max) || max < min) {
      onError("Max bet must be >= min bet");
      return;
    }
    if (bets.length === 0) {
      onError("Valid bets must include at least one value");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/casino-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slots: { minBet: min, maxBet: max, validBets: bets, paytable, paytable2oak },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.slots);
        onSuccess("Slots settings saved!");
      } else {
        const err = await res.json();
        onError(err.error || "Failed to save");
      }
    } catch {
      onError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 max-w-xl">
      <h2 className="text-lg font-semibold text-white/80 mb-4">Slots</h2>
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/50 mb-1">Min Bet</label>
            <input
              type="number"
              min={1}
              value={minBet}
              onChange={(e) => setMinBet(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
            />
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">Max Bet</label>
            <input
              type="number"
              min={1}
              value={maxBet}
              onChange={(e) => setMaxBet(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-white/50 mb-1">Valid Bets (comma-separated)</label>
          <input
            value={validBetsStr}
            onChange={(e) => setValidBetsStr(e.target.value)}
            placeholder="5, 10, 25, 50, 100"
            className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
          />
        </div>
        <div className="border-t border-white/[0.08] pt-4">
          <p className="text-sm font-medium text-white/60 mb-2">Paytable (3-of-a-kind multiplier)</p>
          <p className="text-xs text-white/40 mb-2">Lower = higher house edge</p>
          <div className="grid grid-cols-5 gap-2">
            {[
              { k: "7", v: pay7, set: setPay7 },
              { k: "BAR", v: payBAR, set: setPayBAR },
              { k: "star", v: payStar, set: setPayStar },
              { k: "bell", v: payBell, set: setPayBell },
              { k: "cherry", v: payCherry, set: setPayCherry },
            ].map(({ k, v, set }) => (
              <div key={k}>
                <label className="block text-[10px] text-white/40 mb-0.5">{k}</label>
                <input
                  type="number"
                  min={0}
                  value={v}
                  onChange={(e) => set(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/10 rounded px-2 py-1.5 text-white/90 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="mt-2">
            <label className="block text-xs text-white/50 mb-1">2-of-a-kind multiplier</label>
            <input
              type="number"
              step={0.1}
              min={0}
              value={pay2oak}
              onChange={(e) => setPay2oak(e.target.value)}
              className="w-20 bg-white/[0.06] border border-white/10 rounded px-2 py-1.5 text-white/90 text-sm"
            />
          </div>
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Save Settings"}
      </button>
      {settings && (
        <p className="text-sm text-white/40 mt-4">Current: {settings.minBet}–{settings.maxBet} cr · 2oak: {settings.paytable2oak}×</p>
      )}
    </div>
  );
}

function BlackjackSection({ onError, onSuccess }: { onError: (s: string) => void; onSuccess: (s: string) => void }) {
  const [settings, setSettings] = useState<CasinoGameSettings["blackjack"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [minBet, setMinBet] = useState("2");
  const [maxBet, setMaxBet] = useState("500");
  const [blackjackPayout, setBlackjackPayout] = useState("1.5");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch("/api/admin/casino-settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.blackjack);
        setMinBet(String(data.blackjack.minBet));
        setMaxBet(String(data.blackjack.maxBet));
        setBlackjackPayout(String(data.blackjack.blackjackPayout ?? 1.5));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleSave() {
    onError("");
    const min = parseInt(minBet, 10);
    const max = parseInt(maxBet, 10);
    const payout = parseFloat(blackjackPayout) || 1.5;
    if (isNaN(min) || min < 2 || min % 2 !== 0) {
      onError("Min bet must be an even number ≥ 2");
      return;
    }
    if (isNaN(max) || max < min || max % 2 !== 0) {
      onError("Max bet must be an even number ≥ min bet");
      return;
    }
    if (payout < 1 || payout > 3) {
      onError("Blackjack payout must be 1–3 (1.5 = 3:2, 1.2 = 6:5)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/casino-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blackjack: { minBet: min, maxBet: max, blackjackPayout: payout },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.blackjack);
        onSuccess("Blackjack settings saved!");
      } else {
        const err = await res.json();
        onError(err.error || "Failed to save");
      }
    } catch {
      onError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 max-w-xl">
      <h2 className="text-lg font-semibold text-white/80 mb-4">Blackjack</h2>
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/50 mb-1">Min Bet (even)</label>
            <input
              type="number"
              min={2}
              step={2}
              value={minBet}
              onChange={(e) => setMinBet(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
            />
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">Max Bet (even)</label>
            <input
              type="number"
              min={2}
              step={2}
              value={maxBet}
              onChange={(e) => setMaxBet(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-white/50 mb-1">Blackjack Payout (profit multiplier)</label>
          <input
            type="number"
            step={0.1}
            min={1}
            max={3}
            value={blackjackPayout}
            onChange={(e) => setBlackjackPayout(e.target.value)}
            className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
          />
          <p className="text-xs text-white/40 mt-1">1.5 = 3:2 (standard), 1.2 = 6:5 (higher house edge). Total return = bet × (1 + payout).</p>
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Save Settings"}
      </button>
      {settings && (
        <p className="text-sm text-white/40 mt-4">Current: {settings.minBet}–{settings.maxBet} cr · BJ pays {settings.blackjackPayout}×</p>
      )}
    </div>
  );
}

function RouletteSection({ onError, onSuccess }: { onError: (s: string) => void; onSuccess: (s: string) => void }) {
  const [settings, setSettings] = useState<CasinoGameSettings["roulette"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [minBet, setMinBet] = useState("5");
  const [maxBet, setMaxBet] = useState("500");
  const [betStep, setBetStep] = useState("5");
  const [colorPayout, setColorPayout] = useState("2");
  const [straightPayout, setStraightPayout] = useState("35");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch("/api/admin/casino-settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.roulette);
        setMinBet(String(data.roulette.minBet));
        setMaxBet(String(data.roulette.maxBet));
        setBetStep(String(data.roulette.betStep));
        setColorPayout(String(data.roulette.colorPayout ?? 2));
        setStraightPayout(String(data.roulette.straightPayout ?? 35));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleSave() {
    onError("");
    const min = parseInt(minBet, 10);
    const max = parseInt(maxBet, 10);
    const step = parseInt(betStep, 10);
    const color = parseInt(colorPayout, 10);
    const straight = parseInt(straightPayout, 10);
    if (isNaN(min) || min < 1) {
      onError("Min bet must be at least 1");
      return;
    }
    if (isNaN(max) || max < min) {
      onError("Max bet must be ≥ min bet");
      return;
    }
    if (isNaN(step) || step < 1) {
      onError("Bet step must be at least 1");
      return;
    }
    if (isNaN(color) || color < 1 || color > 10) {
      onError("Color payout must be 1–10");
      return;
    }
    if (isNaN(straight) || straight < 10 || straight > 50) {
      onError("Straight payout must be 10–50");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/casino-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roulette: { minBet: min, maxBet: max, betStep: step, colorPayout: color, straightPayout: straight },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.roulette);
        onSuccess("Roulette settings saved!");
      } else {
        const err = await res.json();
        onError(err.error || "Failed to save");
      }
    } catch {
      onError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 max-w-xl">
      <h2 className="text-lg font-semibold text-white/80 mb-4">Roulette</h2>
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/50 mb-1">Min Bet</label>
            <input
              type="number"
              min={1}
              value={minBet}
              onChange={(e) => setMinBet(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
            />
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">Max Bet</label>
            <input
              type="number"
              min={1}
              value={maxBet}
              onChange={(e) => setMaxBet(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-white/50 mb-1">Bet Step</label>
          <input
            type="number"
            min={1}
            value={betStep}
            onChange={(e) => setBetStep(e.target.value)}
            className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
          />
        </div>
        <div className="border-t border-white/[0.08] pt-4">
          <p className="text-sm font-medium text-white/60 mb-2">Odds</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/50 mb-1">Red/Black payout (×)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={colorPayout}
                onChange={(e) => setColorPayout(e.target.value)}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
              <p className="text-xs text-white/40 mt-1">2 = even money. Lower = higher house edge.</p>
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Straight up payout (×)</label>
              <input
                type="number"
                min={10}
                max={50}
                value={straightPayout}
                onChange={(e) => setStraightPayout(e.target.value)}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
              <p className="text-xs text-white/40 mt-1">35 = 35:1. Lower = higher house edge.</p>
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Save Settings"}
      </button>
      {settings && (
        <p className="text-sm text-white/40 mt-4">Current: {settings.minBet}–{settings.maxBet} cr · Red/Black: {settings.colorPayout}× · Straight: {settings.straightPayout}×</p>
      )}
    </div>
  );
}

function DabysBetsSection({ onError, onSuccess }: { onError: (s: string) => void; onSuccess: (s: string) => void }) {
  const [events, setEvents] = useState<DabysBetsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSideA, setNewSideA] = useState("");
  const [newSideB, setNewSideB] = useState("");
  const [newOddsA, setNewOddsA] = useState(1.9);
  const [newOddsB, setNewOddsB] = useState(1.9);
  const [newMinBet, setNewMinBet] = useState(5);
  const [newMaxBet, setNewMaxBet] = useState(500);
  const [newIsActive, setNewIsActive] = useState(true);
  const [editEvent, setEditEvent] = useState<DabysBetsEvent | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSideA, setEditSideA] = useState("");
  const [editSideB, setEditSideB] = useState("");
  const [editOddsA, setEditOddsA] = useState(1.9);
  const [editOddsB, setEditOddsB] = useState(1.9);
  const [editMinBet, setEditMinBet] = useState(5);
  const [editMaxBet, setEditMaxBet] = useState(500);
  const [editIsActive, setEditIsActive] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      const res = await fetch("/api/admin/dabys-bets");
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleAdd() {
    onError("");
    if (!newTitle.trim() || !newSideA.trim() || !newSideB.trim()) {
      onError("Title, side A, and side B are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/dabys-bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          sideA: newSideA.trim(),
          sideB: newSideB.trim(),
          oddsA: newOddsA,
          oddsB: newOddsB,
          minBet: newMinBet,
          maxBet: newMaxBet,
          isActive: newIsActive,
        }),
      });
      if (res.ok) {
        const event = await res.json();
        setEvents([...events, event]);
        setShowAddForm(false);
        setNewTitle("");
        setNewSideA("");
        setNewSideB("");
        setNewOddsA(1.9);
        setNewOddsB(1.9);
        setNewMinBet(5);
        setNewMaxBet(500);
        setNewIsActive(true);
        onSuccess("Event added!");
      } else {
        const err = await res.json();
        onError(err.error || "Failed to add");
      }
    } catch {
      onError("Failed to add");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(e: DabysBetsEvent) {
    setEditEvent(e);
    setEditTitle(e.title);
    setEditSideA(e.sideA);
    setEditSideB(e.sideB);
    setEditOddsA(e.oddsA);
    setEditOddsB(e.oddsB);
    setEditMinBet(e.minBet);
    setEditMaxBet(e.maxBet);
    setEditIsActive(e.isActive);
  }

  async function handleUpdate() {
    if (!editEvent) return;
    onError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/dabys-bets/${editEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          sideA: editSideA.trim(),
          sideB: editSideB.trim(),
          oddsA: editOddsA,
          oddsB: editOddsB,
          minBet: editMinBet,
          maxBet: editMaxBet,
          isActive: editIsActive,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setEvents(events.map((ev) => (ev.id === editEvent.id ? updated : ev)));
        setEditEvent(null);
        onSuccess("Event updated!");
      } else {
        const err = await res.json();
        onError(err.error || "Failed to update");
      }
    } catch {
      onError("Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this event?")) return;
    onError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/dabys-bets/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEvents(events.filter((e) => e.id !== id));
        setEditEvent(null);
        onSuccess("Event deleted");
      } else {
        const err = await res.json();
        onError(err.error || "Failed to delete");
      }
    } catch {
      onError("Failed to delete");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-6">
        <button
          onClick={() => { setShowAddForm(!showAddForm); onError(""); }}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all cursor-pointer"
        >
          {showAddForm ? "Cancel" : "Add Event"}
        </button>
      </div>

      {showAddForm && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 mb-8">
          <h2 className="text-lg font-semibold text-white/80 mb-4">New Event</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-white/50 mb-1">Title</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Dabys Bowl Finals"
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="text-sm text-white/50">Active</label>
              <input
                type="checkbox"
                checked={newIsActive}
                onChange={(e) => setNewIsActive(e.target.checked)}
                className="rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Side A</label>
              <input
                value={newSideA}
                onChange={(e) => setNewSideA(e.target.value)}
                placeholder="Team Alpha"
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Odds A</label>
              <input
                type="number"
                step={0.1}
                min={1.01}
                value={newOddsA}
                onChange={(e) => setNewOddsA(parseFloat(e.target.value) || 1.9)}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Side B</label>
              <input
                value={newSideB}
                onChange={(e) => setNewSideB(e.target.value)}
                placeholder="Team Beta"
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Odds B</label>
              <input
                type="number"
                step={0.1}
                min={1.01}
                value={newOddsB}
                onChange={(e) => setNewOddsB(parseFloat(e.target.value) || 1.9)}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Min Bet</label>
              <input
                type="number"
                min={1}
                value={newMinBet}
                onChange={(e) => setNewMinBet(parseInt(e.target.value, 10) || 5)}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Max Bet</label>
              <input
                type="number"
                min={newMinBet}
                value={newMaxBet}
                onChange={(e) => setNewMaxBet(parseInt(e.target.value, 10) || 500)}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? "..." : "Add Event"}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
        {events.length === 0 ? (
          <div className="p-12 text-center text-white/40">
            No events yet. Add one above to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase">Title</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase">Side A / Odds</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase">Side B / Odds</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase">Min / Max</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase">Active</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white/90 font-medium">{e.title}</td>
                    <td className="px-4 py-3 text-white/70">{e.sideA} <span className="text-white/40">({e.oddsA}x)</span></td>
                    <td className="px-4 py-3 text-white/70">{e.sideB} <span className="text-white/40">({e.oddsB}x)</span></td>
                    <td className="px-4 py-3 text-white/60">{e.minBet} / {e.maxBet}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${e.isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/40"}`}>
                        {e.isActive ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(e)}
                        className="text-purple-400 hover:text-purple-300 text-sm mr-3 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="text-red-400 hover:text-red-300 text-sm cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !saving && setEditEvent(null)}
        >
          <div
            className="rounded-2xl border border-white/10 bg-[#1a1a2e] p-6 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white/90 mb-4">Edit Event</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-white/50 mb-1">Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/50 mb-1">Side A</label>
                  <input
                    value={editSideA}
                    onChange={(e) => setEditSideA(e.target.value)}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/50 mb-1">Odds A</label>
                  <input
                    type="number"
                    step={0.1}
                    value={editOddsA}
                    onChange={(e) => setEditOddsA(parseFloat(e.target.value) || 1.9)}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/50 mb-1">Side B</label>
                  <input
                    value={editSideB}
                    onChange={(e) => setEditSideB(e.target.value)}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/50 mb-1">Odds B</label>
                  <input
                    type="number"
                    step={0.1}
                    value={editOddsB}
                    onChange={(e) => setEditOddsB(parseFloat(e.target.value) || 1.9)}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/50 mb-1">Min Bet</label>
                  <input
                    type="number"
                    min={1}
                    value={editMinBet}
                    onChange={(e) => setEditMinBet(parseInt(e.target.value, 10) || 5)}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/50 mb-1">Max Bet</label>
                  <input
                    type="number"
                    min={editMinBet}
                    value={editMaxBet}
                    onChange={(e) => setEditMaxBet(parseInt(e.target.value, 10) || 500)}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded cursor-pointer"
                />
                <label htmlFor="editActive" className="text-sm text-white/70 cursor-pointer">Active (visible in casino)</label>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => !saving && setEditEvent(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {saving ? "..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LotterySection({ onError, onSuccess }: { onError: (s: string) => void; onSuccess: (s: string) => void }) {
  const [settings, setSettings] = useState<LotterySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ticketCost, setTicketCost] = useState("25");
  const [startingPool, setStartingPool] = useState("0");
  const [houseTakePercent, setHouseTakePercent] = useState("0");
  const [scratchCost, setScratchCost] = useState("10");
  const [scratchPayJACKPOT, setScratchPayJACKPOT] = useState("50");
  const [scratchPayDIAMOND, setScratchPayDIAMOND] = useState("20");
  const [scratchPayGOLD, setScratchPayGOLD] = useState("10");
  const [scratchPaySTAR, setScratchPaySTAR] = useState("5");
  const [scratchPayCLOVER, setScratchPayCLOVER] = useState("3");
  const [scratchPayLUCKY, setScratchPayLUCKY] = useState("1");
  const [scratchOddsJACKPOT, setScratchOddsJACKPOT] = useState("200");
  const [scratchOddsDIAMOND, setScratchOddsDIAMOND] = useState("100");
  const [scratchOddsGOLD, setScratchOddsGOLD] = useState("50");
  const [scratchOddsSTAR, setScratchOddsSTAR] = useState("25");
  const [scratchOddsCLOVER, setScratchOddsCLOVER] = useState("15");
  const [scratchOddsLUCKY, setScratchOddsLUCKY] = useState("10");
  const [scratchLoseWeight, setScratchLoseWeight] = useState("4");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch("/api/admin/lottery-settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setTicketCost(String(data.ticketCost));
        setStartingPool(String(data.startingPool));
        setHouseTakePercent(String(data.houseTakePercent));
        const so = data.scratchOff ?? {};
        setScratchCost(String(so.cost ?? 10));
        setScratchPayJACKPOT(String(so.paytable?.JACKPOT ?? 50));
        setScratchPayDIAMOND(String(so.paytable?.DIAMOND ?? 20));
        setScratchPayGOLD(String(so.paytable?.GOLD ?? 10));
        setScratchPaySTAR(String(so.paytable?.STAR ?? 5));
        setScratchPayCLOVER(String(so.paytable?.CLOVER ?? 3));
        setScratchPayLUCKY(String(so.paytable?.LUCKY ?? 1));
        const odds = so.winChanceDenom;
        setScratchOddsJACKPOT(String(odds?.JACKPOT ?? 200));
        setScratchOddsDIAMOND(String(odds?.DIAMOND ?? 100));
        setScratchOddsGOLD(String(odds?.GOLD ?? 50));
        setScratchOddsSTAR(String(odds?.STAR ?? 25));
        setScratchOddsCLOVER(String(odds?.CLOVER ?? 15));
        setScratchOddsLUCKY(String(odds?.LUCKY ?? 10));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleSave() {
    onError("");
    const tc = parseInt(ticketCost, 10);
    const sp = parseInt(startingPool, 10);
    const ht = parseInt(houseTakePercent, 10);
    const sc = parseInt(scratchCost, 10);
    if (isNaN(tc) || tc < 1) {
      onError("Ticket cost must be at least 1");
      return;
    }
    if (isNaN(sp) || sp < 0) {
      onError("Starting pool must be 0 or more");
      return;
    }
    if (isNaN(ht) || ht < 0 || ht > 100) {
      onError("House take must be 0–100%");
      return;
    }
    if (isNaN(sc) || sc < 1) {
      onError("Scratch-off cost must be at least 1");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/lottery-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketCost: tc,
          startingPool: sp,
          houseTakePercent: ht,
          scratchOff: {
            cost: sc,
            paytable: {
              JACKPOT: parseInt(scratchPayJACKPOT, 10) || 50,
              DIAMOND: parseInt(scratchPayDIAMOND, 10) || 20,
              GOLD: parseInt(scratchPayGOLD, 10) || 10,
              STAR: parseInt(scratchPaySTAR, 10) || 5,
              CLOVER: parseInt(scratchPayCLOVER, 10) || 3,
              LUCKY: parseInt(scratchPayLUCKY, 10) || 1,
            },
            winChanceDenom: {
              JACKPOT: Math.max(1, parseInt(scratchOddsJACKPOT, 10) || 200),
              DIAMOND: Math.max(1, parseInt(scratchOddsDIAMOND, 10) || 100),
              GOLD: Math.max(1, parseInt(scratchOddsGOLD, 10) || 50),
              STAR: Math.max(1, parseInt(scratchOddsSTAR, 10) || 25),
              CLOVER: Math.max(1, parseInt(scratchOddsCLOVER, 10) || 15),
              LUCKY: Math.max(1, parseInt(scratchOddsLUCKY, 10) || 10),
            },
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        onSuccess("Settings saved!");
      } else {
        const err = await res.json();
        onError(err.error || "Failed to save");
      }
    } catch {
      onError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Clear all tickets for the current draw? Prize pool will reset to starting pool. This cannot be undone.")) return;
    onError("");
    setResetting(true);
    try {
      const res = await fetch("/api/admin/lottery/reset", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data.message || "Lottery reset!");
      } else {
        onError(data.error || "Failed to reset");
      }
    } catch {
      onError("Failed to reset");
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 max-w-xl">
        <h2 className="text-lg font-semibold text-white/80 mb-4">Lottery Settings</h2>
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm text-white/50 mb-1">Ticket Cost (credits)</label>
            <input
              type="number"
              min={1}
              value={ticketCost}
              onChange={(e) => setTicketCost(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
            />
            <p className="text-xs text-white/40 mt-1">Credits per ticket. Minimum 1.</p>
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">Starting Pool (credits)</label>
            <input
              type="number"
              min={0}
              value={startingPool}
              onChange={(e) => setStartingPool(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
            />
            <p className="text-xs text-white/40 mt-1">Base credits added to each draw&apos;s prize pool. 0 = tickets only.</p>
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">House Take (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={houseTakePercent}
              onChange={(e) => setHouseTakePercent(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
            />
            <p className="text-xs text-white/40 mt-1">0 = winner gets full pool. 10 = house keeps 10%, winner gets 90%.</p>
          </div>
        </div>

        <div className="border-t border-white/[0.08] pt-6 mt-6">
          <h3 className="text-base font-semibold text-white/70 mb-4">Scratch-off Tickets</h3>
          <p className="text-xs text-white/40 mb-4">12 panels · Match 3+ of same symbol to win. Losing tickets show symbols but no winning combo.</p>
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm text-white/50 mb-1">Cost (credits per ticket)</label>
              <input
                type="number"
                min={1}
                value={scratchCost}
                onChange={(e) => setScratchCost(e.target.value)}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
            </div>
            <p className="text-xs text-white/40 mb-3">Payout (×) and win odds (1 in N) per symbol. Higher N = rarer. Total win chance = sum of 1/N.</p>
            <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                    <th className="text-left py-2.5 px-3 text-white/50 font-medium">Symbol</th>
                    <th className="text-left py-2.5 px-3 text-white/50 font-medium">Payout (×)</th>
                    <th className="text-left py-2.5 px-3 text-white/50 font-medium">Odds (1 in N)</th>
                    <th className="text-left py-2.5 px-3 text-white/50 font-medium">Chance</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: "JACKPOT", label: "JACKPOT", pay: scratchPayJACKPOT, setPay: setScratchPayJACKPOT, odds: scratchOddsJACKPOT, setOdds: setScratchOddsJACKPOT },
                    { key: "DIAMOND", label: "DIAMOND", pay: scratchPayDIAMOND, setPay: setScratchPayDIAMOND, odds: scratchOddsDIAMOND, setOdds: setScratchOddsDIAMOND },
                    { key: "GOLD", label: "GOLD", pay: scratchPayGOLD, setPay: setScratchPayGOLD, odds: scratchOddsGOLD, setOdds: setScratchOddsGOLD },
                    { key: "STAR", label: "STAR", pay: scratchPaySTAR, setPay: setScratchPaySTAR, odds: scratchOddsSTAR, setOdds: setScratchOddsSTAR },
                    { key: "CLOVER", label: "CLOVER", pay: scratchPayCLOVER, setPay: setScratchPayCLOVER, odds: scratchOddsCLOVER, setOdds: setScratchOddsCLOVER },
                    { key: "LUCKY", label: "LUCKY", pay: scratchPayLUCKY, setPay: setScratchPayLUCKY, odds: scratchOddsLUCKY, setOdds: setScratchOddsLUCKY },
                  ].map(({ key, label, pay, setPay, odds, setOdds }) => (
                    <tr key={key} className="border-b border-white/[0.06] last:border-b-0">
                      <td className="py-2 px-3 text-white/70 font-medium">{label}</td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min={0}
                          value={pay}
                          onChange={(e) => setPay(e.target.value)}
                          className="w-full max-w-[80px] bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white/90 text-sm"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min={1}
                          value={odds}
                          onChange={(e) => setOdds(e.target.value)}
                          className="w-full max-w-[80px] bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white/90 text-sm"
                        />
                      </td>
                      <td className="py-2 px-3 text-white/60 text-sm">
                        {(() => {
                          const n = Math.max(1, parseInt(odds, 10) || 1);
                          const pct = 100 / n;
                          return pct >= 1 ? `${pct.toFixed(1)}%` : pct >= 0.1 ? `${pct.toFixed(2)}%` : `${pct.toFixed(3)}%`;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(() => {
              const sum = (1 / Math.max(1, parseInt(scratchOddsJACKPOT, 10) || 200)) +
                (1 / Math.max(1, parseInt(scratchOddsDIAMOND, 10) || 100)) +
                (1 / Math.max(1, parseInt(scratchOddsGOLD, 10) || 50)) +
                (1 / Math.max(1, parseInt(scratchOddsSTAR, 10) || 25)) +
                (1 / Math.max(1, parseInt(scratchOddsCLOVER, 10) || 15)) +
                (1 / Math.max(1, parseInt(scratchOddsLUCKY, 10) || 10));
              return (
                <p className="text-xs text-white/40 mt-2">
                  Total win chance: {(100 * sum).toFixed(1)}%
                </p>
              );
            })()}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>

      {settings && (
        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 max-w-xl">
          <h3 className="text-sm font-medium text-white/50 mb-2">Current values</h3>
          <p className="text-white/70">
            Ticket: {settings.ticketCost} cr · Starting pool: {settings.startingPool} cr · House take: {settings.houseTakePercent}%
          </p>
          {settings.scratchOff && (
            <p className="text-white/70 mt-1">
              Scratch-off: {settings.scratchOff.cost} cr · 12 panels · Match 3+ · Per-symbol odds
            </p>
          )}
          <div className="mt-6 pt-6 border-t border-white/[0.08]">
            <button
              onClick={handleReset}
              disabled={resetting}
              className="px-4 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {resetting ? "Resetting…" : "Reset Weekly Lottery"}
            </button>
            <p className="text-xs text-white/40 mt-2">Clears all tickets for the current draw. Prize pool resets to starting pool.</p>
          </div>
        </div>
      )}
    </div>
  );
}
