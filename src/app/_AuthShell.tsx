/** Centred card used by the sign-in, first-run setup and password pages. */
export function AuthShell({
  title,
  intro,
  error,
  ok,
  children,
  footer,
}: {
  title: string;
  intro?: React.ReactNode;
  error?: string;
  ok?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-lg font-semibold text-slate-900">
            SACVIN <span className="text-emerald-600">Global Plastics</span> Lead Engine
          </div>
          <div className="text-xs text-slate-500 mt-1">
            SACVIN Nigeria Limited &amp; Veeglow Engineering Solutions — internal tool
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {intro && <div className="mt-2 text-sm text-slate-600">{intro}</div>}

          {error && (
            <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          )}
          {ok && (
            <p className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {ok}
            </p>
          )}

          <div className="mt-5">{children}</div>
        </div>

        {footer && <div className="mt-4 text-center text-xs text-slate-500">{footer}</div>}
      </div>
    </div>
  );
}

export const fieldClass =
  "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

export const buttonClass =
  "w-full rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2";

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="block text-sm font-medium text-slate-700">{children}</span>;
}
