import { useEffect, useState } from "react";
import { getTickets, getWalletMe, logout, me } from "../lib/authClient";

function formatCurrency(cents, currency = "ZAR") {
  const value = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(value);
  } catch (_err) {
    return `R ${value.toFixed(2)}`;
  }
}

export default function DashboardPage({ onLoggedOut }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [meResp, walletResp, ticketResp] = await Promise.all([
          me(),
          getWalletMe(),
          getTickets({ status: "PAID" }),
        ]);
        if (cancelled) return;
        setProfile(meResp?.user || null);
        setWallet(walletResp?.wallet || null);
        setTickets(Array.isArray(ticketResp?.tickets) ? ticketResp.tickets : []);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "Failed to load dashboard data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    onLoggedOut();
  };

  return (
    <main className="dash-shell">
      <header className="dash-top">
        <div>
          <p className="eyebrow">CapeConnect React</p>
          <h1>Dashboard</h1>
        </div>
        <button className="ghost" onClick={handleLogout}>Logout</button>
      </header>

      {loading ? <p>Loading dashboard...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {!loading && !error ? (
        <section className="dash-grid">
          <article className="card">
            <h2>Profile</h2>
            <p><strong>Name:</strong> {profile?.fullName || "-"}</p>
            <p><strong>Email:</strong> {profile?.email || "-"}</p>
            <p><strong>Role:</strong> {profile?.role || "-"}</p>
          </article>

          <article className="card">
            <h2>Wallet</h2>
            <p><strong>Balance:</strong> {formatCurrency(wallet?.balance_cents, wallet?.currency || "ZAR")}</p>
            <p><strong>Currency:</strong> {wallet?.currency || "ZAR"}</p>
          </article>

          <article className="card card-wide">
            <h2>Active Tickets ({tickets.length})</h2>
            {tickets.length ? (
              <ul className="ticket-list">
                {tickets.slice(0, 8).map((t) => (
                  <li key={t.id}>
                    <span>{t.product_name || t.productName || "Ticket"}</span>
                    <span>{t.operator}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No paid tickets found.</p>
            )}
          </article>
        </section>
      ) : null}
    </main>
  );
}
