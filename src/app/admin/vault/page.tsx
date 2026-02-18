"use client";

import { useEffect, useState } from "react";

interface VaultVideo {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  thumbnailUrl?: string;
  order: number;
  featured: boolean;
}

export default function AdminVaultPage() {
  const [videos, setVideos] = useState<VaultVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    youtubeId: "",
    order: "0",
    featured: true,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<VaultVideo>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/admin/vault");
      if (res.ok) {
        const data = await res.json();
        setVideos(Array.isArray(data) ? data : []);
      } else {
        setError("Failed to load videos");
      }
    } catch {
      setError("Failed to load videos");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          youtubeId: form.youtubeId.trim() || undefined,
          youtubeUrl: form.youtubeId.trim() || undefined,
          order: parseInt(form.order, 10) || 0,
          featured: form.featured,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setVideos((prev) => [...prev, data].sort((a, b) => a.order - b.order));
        setForm({ title: "", description: "", youtubeId: "", order: String(videos.length), featured: false });
      } else {
        setError(data.error || "Failed to add video");
      }
    } catch {
      setError("Failed to add video");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editingId || !editForm) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/vault", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editForm }),
      });
      const data = await res.json();
      if (res.ok) {
        setVideos((prev) =>
          prev.map((v) => (v.id === id ? data : v)).sort((a, b) => a.order - b.order)
        );
        setEditingId(null);
        setEditForm({});
      } else {
        setError(data.error || "Failed to update video");
      }
    } catch {
      setError("Failed to update video");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this video from the Vault?")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/vault?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setVideos((prev) => prev.filter((v) => v.id !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to delete video");
      }
    } catch {
      setError("Failed to delete video");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(v: VaultVideo) {
    setEditingId(v.id);
    setEditForm({
      title: v.title,
      description: v.description,
      youtubeId: v.youtubeId,
      order: v.order,
      featured: v.featured,
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white/90">Vault</h1>
        <p className="text-sm text-white/50 mt-1">
          Manage original Dabys Media videos shown on the Vault page. Users earn credits for first watch.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Add form */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-4">Add Video</h2>
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-white/40 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Video title"
              className="w-full px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 placeholder-white/30 outline-none focus:border-purple-500/40"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Short description"
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 placeholder-white/30 outline-none focus:border-purple-500/40 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">YouTube URL or Video ID</label>
            <input
              type="text"
              value={form.youtubeId}
              onChange={(e) => setForm((f) => ({ ...f, youtubeId: e.target.value }))}
              placeholder="https://youtube.com/watch?v=... or VIDEO_ID"
              className="w-full px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 placeholder-white/30 outline-none focus:border-purple-500/40"
              required
            />
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-white/40 mb-1">Order</label>
              <input
                type="number"
                min={0}
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-purple-500/40"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
                className="rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
              />
              <span className="text-sm text-white/60">Featured</span>
            </label>
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="px-5 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Adding…" : "Add Video"}
            </button>
          </div>
        </form>
      </div>

      {/* Video list */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest px-6 py-4 border-b border-white/[0.06]">
          Videos ({videos.length})
        </h2>
        {videos.length === 0 ? (
          <div className="p-12 text-center text-white/40 text-sm">No videos yet. Add one above.</div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {videos.map((v) => (
              <div
                key={v.id}
                className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center"
              >
                <div className="flex-1 min-w-0">
                  {editingId === v.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editForm.title ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                        placeholder="Title"
                      />
                      <input
                        type="text"
                        value={editForm.youtubeId ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, youtubeId: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                        placeholder="YouTube ID or URL"
                      />
                      <div className="flex gap-3 items-center">
                        <input
                          type="number"
                          min={0}
                          value={editForm.order ?? 0}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, order: parseInt(e.target.value, 10) || 0 }))
                          }
                          className="w-20 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                        />
                        <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.featured ?? false}
                            onChange={(e) => setEditForm((f) => ({ ...f, featured: e.target.checked }))}
                            className="rounded border-white/20 bg-white/5 text-purple-500"
                          />
                          Featured
                        </label>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white/90">{v.title}</h3>
                        {v.featured && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-400/30">
                            Featured
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white/50 mt-0.5 truncate">
                        youtube.com/watch?v={v.youtubeId}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {editingId === v.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdate(v.id)}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-emerald-600/80 text-white text-sm font-medium hover:bg-emerald-500/80 disabled:opacity-50 cursor-pointer"
                      >
                        {saving ? "…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingId(null); setEditForm({}); }}
                        className="px-4 py-2 rounded-lg border border-white/20 text-white/60 text-sm hover:bg-white/5 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(v)}
                        className="px-4 py-2 rounded-lg border border-white/20 text-white/60 text-sm hover:bg-white/5 cursor-pointer"
                      >
                        Edit
                      </button>
                      <a
                        href={`/vault`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-lg border border-white/20 text-white/60 text-sm hover:bg-white/5"
                      >
                        View
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(v.id)}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 cursor-pointer disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
