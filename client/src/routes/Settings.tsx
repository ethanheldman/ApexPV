import { useEffect, useRef, useState } from "react";
import { api, getToken } from "../api";
import { useAuth } from "../auth";
import Avatar from "../components/Avatar";
import NumberField from "../components/NumberField";
import type { User } from "../types";

type StepResult = {
  experience: string;
  stride_in: number;
  steps: number;
  mid_mark_in: number;
  mid_mark_ft: number;
  full_approach_in: number;
  full_approach_ft: number;
  recommended_pole_weight_lb: number;
  recommended_pole_length_ft: number;
  caveat: string;
};

export default function Settings() {
  const { user, refresh } = useAuth();
  const [profile, setProfile] = useState({
    display_name: "",
    bio: "",
    school: "",
    gender: "" as string,
    level: "" as string,
    email: "",
    avatar_url: "",
    height_cm: "" as number | "",
    weight_lb: "" as number | "",
    unit_pref: "imperial" as "imperial" | "metric",
  });
  const [pw, setPw] = useState({ current: "", next: "" });
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [stepExp, setStepExp] = useState<"beginner" | "intermediate" | "advanced" | "elite">("intermediate");
  const [stepResult, setStepResult] = useState<StepResult | null>(null);
  const [stepErr, setStepErr] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoErr(null);
    if (!file.type.startsWith("image/")) {
      setPhotoErr("That doesn't look like an image.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setPhotoErr("File is over 50MB.");
      return;
    }
    setUploadingPhoto(true);
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/uploads/image");
        const tok = getToken();
        if (tok) xhr.setRequestHeader("Authorization", `Bearer ${tok}`);
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const j = JSON.parse(xhr.responseText);
              resolve(j.url);
            } catch {
              reject(new Error("bad response"));
            }
          } else {
            try {
              const j = JSON.parse(xhr.responseText);
              reject(new Error(j.error ?? `HTTP ${xhr.status}`));
            } catch {
              reject(new Error(`HTTP ${xhr.status}`));
            }
          }
        };
        xhr.onerror = () => reject(new Error("network error"));
        const form = new FormData();
        form.append("file", file);
        xhr.send(form);
      });
      // Save immediately so the avatar is live without requiring "Save profile".
      await api<User>("/api/auth/me", {
        method: "PATCH",
        json: { avatar_url: url },
      });
      setProfile((p) => ({ ...p, avatar_url: url }));
      await refresh();
      flash("Profile picture updated.");
    } catch (e: any) {
      setPhotoErr(e.message ?? "upload failed");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const removePhoto = async () => {
    setProfile((p) => ({ ...p, avatar_url: "" }));
    await api<User>("/api/auth/me", {
      method: "PATCH",
      json: { avatar_url: null },
    });
    await refresh();
    flash("Profile picture removed.");
  };

  useEffect(() => {
    if (!user) return;
    setProfile({
      display_name: user.display_name,
      bio: user.bio ?? "",
      school: user.school ?? "",
      gender: user.gender ?? "",
      level: user.level ?? "",
      email: user.email ?? "",
      avatar_url: user.avatar_url ?? "",
      height_cm: user.height_cm ?? "",
      weight_lb: user.weight_lb ?? "",
      unit_pref: user.unit_pref ?? "imperial",
    });
  }, [user]);

  const flash = (m: string) => {
    setSavedFlash(m);
    setTimeout(() => setSavedFlash(null), 2000);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await api<User>("/api/auth/me", {
        method: "PATCH",
        json: {
          display_name: profile.display_name,
          bio: profile.bio || null,
          school: profile.school || null,
          gender: profile.gender || null,
          level: profile.level || null,
          email: profile.email || undefined,
          avatar_url: profile.avatar_url || null,
          height_cm: profile.height_cm === "" ? null : Number(profile.height_cm),
          weight_lb: profile.weight_lb === "" ? null : Number(profile.weight_lb),
          unit_pref: profile.unit_pref,
        },
      });
      await refresh();
      flash("Profile saved.");
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await api("/api/auth/me/password", {
        method: "POST",
        json: { current: pw.current, next: pw.next },
      });
      setPw({ current: "", next: "" });
      flash("Password updated.");
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const runStepCalc = async () => {
    setStepErr(null);
    setStepResult(null);
    if (!profile.height_cm || !profile.weight_lb) {
      setStepErr("Add your height (cm) and weight (lb) above first, then save.");
      return;
    }
    try {
      const r = await api<StepResult>(
        `/api/calc/step?height_cm=${profile.height_cm}&weight_lb=${profile.weight_lb}&experience=${stepExp}`,
      );
      setStepResult(r);
    } catch (e: any) {
      setStepErr(e.message);
    }
  };

  if (!user) return null;

  // Helper for height in/cm conversion shown in the body-stats fields
  const heightFtIn = profile.height_cm
    ? (() => {
        const inches = Number(profile.height_cm) / 2.54;
        const ft = Math.floor(inches / 12);
        const inc = Math.round((inches - ft * 12) * 4) / 4;
        return `${ft}'${inc}"`;
      })()
    : "—";

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-5 pt-6 pb-10 space-y-6">
      <h1 className="font-display font-extrabold text-3xl tracking-tight">Settings</h1>

      <form onSubmit={saveProfile} className="card p-5 space-y-3">
        <div className="label">Profile</div>
        <div className="flex items-start gap-4 mb-1">
          <Avatar
            seed={user.avatar_seed ?? user.handle}
            url={profile.avatar_url || user.avatar_url}
            size={72}
          />
          <div className="flex-1 space-y-2">
            <div className="label">profile picture</div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPhotoSelected}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="btn-ghost text-sm !py-2"
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? "Uploading…" : "📷 Choose photo"}
              </button>
              {profile.avatar_url && (
                <button
                  type="button"
                  onClick={removePhoto}
                  className="text-xs text-rose-700 hover:underline self-center"
                  disabled={uploadingPhoto}
                >
                  remove
                </button>
              )}
            </div>
            {photoErr && <div className="text-rose-700 text-xs">{photoErr}</div>}
            <details className="text-xs text-text-secondary">
              <summary className="cursor-pointer hover:text-text-primary">
                …or paste a URL
              </summary>
              <input
                type="url"
                className="input mt-2 text-sm"
                value={profile.avatar_url}
                onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
                placeholder="https://…"
              />
            </details>
          </div>
        </div>
        <div>
          <div className="label mb-1">name</div>
          <input
            className="input"
            value={profile.display_name}
            onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
            required
            maxLength={60}
          />
        </div>
        <div>
          <div className="label mb-1">bio</div>
          <textarea
            className="input min-h-[60px] resize-none"
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            maxLength={280}
          />
        </div>
        <div>
          <div className="label mb-1">school / club</div>
          <input
            className="input"
            value={profile.school}
            onChange={(e) => setProfile({ ...profile, school: e.target.value })}
            maxLength={80}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">division</div>
            <select
              className="input"
              value={profile.gender}
              onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
            >
              <option value="">— skip —</option>
              <option value="m">Men</option>
              <option value="f">Women</option>
            </select>
          </div>
          <div>
            <div className="label mb-1">level</div>
            <select
              className="input"
              value={profile.level}
              onChange={(e) => setProfile({ ...profile, level: e.target.value })}
            >
              <option value="">— skip —</option>
              <option value="hs">High School</option>
              <option value="college">College</option>
              <option value="open">Open</option>
              <option value="masters">Masters</option>
            </select>
          </div>
        </div>
        <div>
          <div className="label mb-1">email</div>
          <input
            className="input"
            type="email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
          />
        </div>

        <div className="border-t border-border-subtle pt-3">
          <div className="label mb-2">Body stats (used by the step calculator)</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label mb-1">height (cm) {profile.height_cm && <span className="font-normal text-text-tertiary">· {heightFtIn}</span>}</div>
              <NumberField
                className="input"
                min={120}
                max={230}
                value={profile.height_cm}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    height_cm: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <div className="label mb-1">weight (lb)</div>
              <NumberField
                className="input"
                min={60}
                max={400}
                value={profile.weight_lb}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    weight_lb: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border-subtle pt-3">
          <div className="label mb-2">Display unit</div>
          <div className="grid grid-cols-2 gap-2">
            {(["imperial", "metric"] as const).map((u) => (
              <button
                type="button"
                key={u}
                onClick={() => setProfile({ ...profile, unit_pref: u })}
                className={
                  "py-2 rounded-xl text-sm font-semibold capitalize " +
                  (profile.unit_pref === u
                    ? "bg-bg-sunken text-text-primary"
                    : "bg-bg-raised text-text-primary hover:bg-bg-raised")
                }
              >
                {u === "imperial" ? "Feet / inches" : "Meters"}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-text-secondary mt-1">
            All heights across the app render in this unit. Flip back any time.
          </p>
        </div>

        <button className="btn-primary w-full">Save profile</button>
      </form>

      <div className="card p-5 space-y-3">
        <div className="label">Step calculator</div>
        <p className="text-xs text-text-secondary">
          Heuristic from body height + weight. Trust your coach over a calculator.
        </p>
        <div>
          <div className="label mb-1">experience</div>
          <div className="grid grid-cols-4 gap-2">
            {(["beginner", "intermediate", "advanced", "elite"] as const).map((e) => (
              <button
                key={e}
                onClick={() => setStepExp(e)}
                className={
                  "py-1.5 rounded-lg text-xs font-semibold capitalize " +
                  (stepExp === e
                    ? "bg-accent text-white"
                    : "bg-bg-raised text-text-primary hover:bg-bg-raised")
                }
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <button onClick={runStepCalc} className="btn-primary w-full">
          Calculate my step
        </button>
        {stepErr && <div className="text-rose-700 text-sm">{stepErr}</div>}
        {stepResult && (
          <div className="rounded-xl bg-bg-raised/30 p-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Approach" value={`${stepResult.steps} steps`} />
              <Stat label="Stride length" value={`${stepResult.stride_in.toFixed(1)}"`} />
              <Stat label="Mid-mark" value={`~${stepResult.mid_mark_ft}'`} sub={`(${stepResult.mid_mark_in}")`} />
              <Stat label="Full approach" value={`~${stepResult.full_approach_ft}'`} sub={`(${stepResult.full_approach_in}")`} />
              <Stat label="Pole weight rec" value={`${stepResult.recommended_pole_weight_lb} lb`} />
              <Stat label="Pole length rec" value={`${stepResult.recommended_pole_length_ft}'`} />
            </div>
            <p className="text-[11px] text-text-secondary mt-3 italic">{stepResult.caveat}</p>
          </div>
        )}
      </div>

      <form onSubmit={savePassword} className="card p-5 space-y-3">
        <div className="label">Change password</div>
        <input
          className="input"
          type="password"
          placeholder="current password"
          autoComplete="current-password"
          value={pw.current}
          onChange={(e) => setPw({ ...pw, current: e.target.value })}
        />
        <input
          className="input"
          type="password"
          placeholder="new password (min 6)"
          autoComplete="new-password"
          value={pw.next}
          onChange={(e) => setPw({ ...pw, next: e.target.value })}
          minLength={6}
        />
        <button className="btn-primary w-full" disabled={!pw.current || pw.next.length < 6}>
          Update password
        </button>
      </form>

      <div className="card p-5">
        <div className="label mb-2">Account</div>
        <div className="text-sm text-text-secondary">
          Handle: <span className="font-mono">@{user.handle}</span> (cannot be changed in this build)
        </div>
      </div>

      {err && <div className="text-rose-700 text-sm">{err}</div>}
      {savedFlash && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-bg-sunken text-text-primary rounded-xl px-4 py-2 text-sm shadow-lg">
          {savedFlash}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="font-display font-bold text-lg">{value}</div>
      {sub && <div className="text-[11px] text-text-tertiary">{sub}</div>}
    </div>
  );
}
