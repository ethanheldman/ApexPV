import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Signup() {
  const { signup } = useAuth();
  const [form, setForm] = useState({
    handle: "",
    email: "",
    password: "",
    display_name: "",
    school: "",
    gender: "",
    level: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // BUG-27: autofocus the first field so leftover login autofill doesn't catch focus
    nameRef.current?.focus();
  }, []);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="mx-auto max-w-md px-5 pt-10">
      <div className="card p-6">
        <h1 className="font-display font-extrabold text-3xl tracking-tight">Create an account</h1>
        <p className="text-stone-500 text-sm mt-1">Start your vault journal in 30 seconds.</p>

        <form
          className="mt-6 space-y-3"
          autoComplete="off"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            setBusy(true);
            try {
              await signup({
                handle: form.handle,
                email: form.email,
                password: form.password,
                display_name: form.display_name,
                school: form.school || undefined,
                gender: (form.gender || undefined) as any,
                level: (form.level || undefined) as any,
              });
              nav("/", { replace: true });
            } catch (e: any) {
              setErr(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <div className="label mb-1">name</div>
            <input
              ref={nameRef}
              className="input"
              autoComplete="off"
              value={form.display_name}
              onChange={update("display_name")}
              required
            />
          </div>
          <div>
            <div className="label mb-1">handle</div>
            <input
              className="input"
              autoComplete="off"
              value={form.handle}
              onChange={update("handle")}
              required
              minLength={2}
              maxLength={24}
              pattern={`[^\\s/\\\\?#&%<>"]+`}
              title={`Letters, digits, dots, hyphens — anything except whitespace or / \\ ? # & % < > "`}
            />
            <div className="text-[11px] text-stone-500 mt-1">
              dots, dashes, underscores, emoji are all fine
            </div>
          </div>
          <div>
            <div className="label mb-1">email</div>
            <input
              className="input"
              autoComplete="off"
              type="email"
              value={form.email}
              onChange={update("email")}
              required
            />
          </div>
          <div>
            <div className="label mb-1">password (min 6)</div>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update("password")}
              required
              minLength={6}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="label mb-1">division</div>
              <select className="input" value={form.gender} onChange={update("gender")}>
                <option value="">— skip —</option>
                <option value="m">Men</option>
                <option value="f">Women</option>
                <option value="x">Non-binary</option>
              </select>
            </div>
            <div>
              <div className="label mb-1">level</div>
              <select className="input" value={form.level} onChange={update("level")}>
                <option value="">— skip —</option>
                <option value="hs">High School</option>
                <option value="college">College</option>
                <option value="open">Open</option>
                <option value="masters">Masters</option>
              </select>
            </div>
          </div>
          <div>
            <div className="label mb-1">school / club (optional)</div>
            <input
              className="input"
              autoComplete="off"
              value={form.school}
              onChange={update("school")}
            />
          </div>
          {err && <div className="text-rose-700 text-sm">{err}</div>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>

        <div className="text-center text-sm text-stone-500 mt-6">
          Already have one?{" "}
          <Link to="/login" className="font-semibold text-ink underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
