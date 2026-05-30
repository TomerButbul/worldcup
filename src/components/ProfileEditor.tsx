"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveProfile } from "@/app/dashboard/actions";
import { playPop } from "@/lib/sound";
import Avatar from "@/components/Avatar";

export default function ProfileEditor({
  userId,
  displayName,
  teamName,
  avatarUrl,
}: {
  userId: string;
  displayName: string;
  teamName: string | null;
  avatarUrl: string | null;
}) {
  const [name, setName] = useState(displayName);
  const [team, setTeam] = useState(teamName ?? "");
  const [avatar, setAvatar] = useState<string | null>(avatarUrl);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3_000_000) {
      setMsg("Image too large (max 3MB)");
      return;
    }
    setUploading(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "png";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = data.publicUrl;
      const res = await saveProfile({ avatar_url: url });
      if (!res.ok) throw new Error(res.error);
      setAvatar(url);
      playPop();
      setMsg("Picture updated!");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveProfile({ display_name: name, team_name: team });
      setMsg(res.ok ? "Saved!" : (res.error ?? "Error"));
    });
  }

  const inputClass =
    "w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-chalk outline-none placeholder:text-chalk-dim focus:border-grass focus:ring-2 focus:ring-grass/30";

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="mb-4 font-display text-chalk">Your profile</h2>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="group relative rounded-full"
            title="Change picture"
          >
            <Avatar url={avatar} name={team || name} size={72} />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs text-white opacity-0 transition group-hover:opacity-100">
              {uploading ? "…" : "Edit"}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onPickFile}
            className="hidden"
          />
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-chalk-dim">Manager name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-chalk-dim">Team name</label>
            <input
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="e.g. The Goal Diggers"
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={pending}
              className="rounded-xl bg-grass px-4 py-1.5 text-sm font-semibold text-night glow-grass transition hover:brightness-110 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save profile"}
            </button>
            {msg && <span className="text-xs text-chalk-dim">{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
