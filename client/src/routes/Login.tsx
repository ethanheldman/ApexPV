import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import { mmToFtIn } from "../lib/format";

type DemoSummary = {
  handle: string;
  display_name: string;
  school: string | null;
  pr_height_mm: number | null;
  level: string | null;
};

export default function Login() {
  const { login } = useAuth();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<DemoSummary[] | null>(null);
  const nav = useNavigate();
  const loc = useLocation() as any;

  useEffect(() => {
    api<DemoSummary[]>("/api/users/demo/summary")
      .then(setDemo)
      .catch(() => setDemo([]));
  }, []);

  const doLogin = async (h: string) => {
    setErr(null);
    setBusy(true);
    try {
      await login(h, "apex1234");
      nav(loc.state?.from ?? "/", { replace: true });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-5 pt-10">
      <div className="card p-6">
        <h1 className="font-display font-extrabold text-3xl tracking-tight">Welcome back</h1>
        <p className="text-text-secondary text-sm mt-1">
          Log a vault, share a PR, or keep it private — your call.
        </p>

        <form
          className="mt-6 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            setBusy(true);
            try {
              await login(handle, password);
              nav(loc.state?.from ?? "/", { replace: true });
            } catch (e: any) {
              setErr(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <div className="label mb-1">handle or email</div>
            <input
              autoFocus
              className="input"
              autoComplete="username"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="mona"
            />
          </div>
          <div>
            <div className="label mb-1">password</div>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {err && <div className="text-rose-700 text-sm">{err}</div>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-2 text-text-tertiary text-xs">
          <div className="flex-1 h-px bg-bg-raised" />
          <span>or pick a demo profile</span>
          <div className="flex-1 h-px bg-bg-raised" />
        </div>

        {!demo ? (
          <div className="text-text-tertiary text-sm text-center py-4">loading…</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {demo.map((u) => (
              <button
                key={u.handle}
                onClick={() => doLogin(u.handle)}
                disabled={busy}
                className="text-left rounded-xl border border-border-subtle p-3 hover:bg-bg-raised/30 disabled:opacity-50"
              >
                <div className="font-semibold text-sm">{u.display_name}</div>
                <div className="text-[11px] text-text-secondary">
                  {u.pr_height_mm ? `${mmToFtIn(u.pr_height_mm)} PR` : "no PR yet"}
                  {u.school && ` · ${u.school}`}
                </div>
                <div className="text-[11px] text-text-tertiary mt-1">@{u.handle}</div>
              </button>
            ))}
          </div>
        )}

        <div className="text-center text-sm text-text-secondary mt-6">
          New here?{" "}
          <Link to="/signup" className="font-semibold text-text-primary underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
