import { Link } from "react-router-dom";

export default function NotFound({
  subject = "page",
  detail,
}: {
  subject?: string;
  detail?: string;
}) {
  return (
    <div className="mx-auto max-w-md px-5 pt-20 pb-10 text-center">
      <div className="font-display font-extrabold text-7xl tracking-tight text-text-disabled">
        404
      </div>
      <h1 className="font-display font-bold text-2xl tracking-tight mt-2">
        Couldn't find that {subject}.
      </h1>
      {detail && <p className="text-text-secondary text-sm mt-2">{detail}</p>}
      <div className="flex justify-center gap-2 mt-6">
        <Link to="/" className="btn-primary">Back to Feed</Link>
        <Link to="/discover" className="btn-ghost">Discover</Link>
      </div>
    </div>
  );
}
