"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page">
      <section className="error" role="alert">
        <h2>Coś poszło nie tak</h2>
        <p>{error.message || "Nieznany błąd renderowania."}</p>
        {error.digest && <p className="muted">Identyfikator błędu w logach Vercel: {error.digest}</p>}
        <button className="btn" onClick={reset}>
          Spróbuj ponownie
        </button>
      </section>
    </main>
  );
}
