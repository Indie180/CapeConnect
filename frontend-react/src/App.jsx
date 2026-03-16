import { useState, useEffect, useCallback, useRef } from "react";

// ─── Operator definitions ─────────────────────────────────────────────────────
const OPS = {
  myciti: {
    id: "myciti",
    name: "MyCiTi",
    fullName: "MyCiTi Bus Service",
    tagline: "Cape Town's rapid transit network",
    logo: "🚌",
    primary: "#0051A0",
    accent: "#E5001E",
    gradient: "linear-gradient(135deg, #0051A0 0%, #002D5C 60%, #001020 100%)",
    sidebarBg: "#001830",
    fares: { ADULT: 14, CHILD: 7, SENIOR: 7, STUDENT: 9, DISABILITY: 7 },
    routes: [
      { id: 1, num: "101", name: "City – Airport", from: "Cape Town Station", to: "CT International Airport", tickets: 1842 },
      { id: 2, num: "102", name: "City – Sea Point", from: "Cape Town Station", to: "Sea Point Promenade", tickets: 3201 },
      { id: 3, num: "103", name: "City – Blouberg", from: "Cape Town Station", to: "Bloubergstrand", tickets: 987 },
      { id: 4, num: "104", name: "City – Gardens", from: "Cape Town Station", to: "Gardens Centre", tickets: 2145 },
    ],
    sampleRoutes: ["City → Airport", "City → Sea Point", "City → Blouberg"],
  },
  ga: {
    id: "ga",
    name: "Golden Arrow",
    fullName: "Golden Arrow Bus Services",
    tagline: "Serving Cape Town since 1861",
    logo: "🚍",
    primary: "#B8860B",
    accent: "#F5A800",
    gradient: "linear-gradient(135deg, #8B6914 0%, #5C4510 60%, #2A1F06 100%)",
    sidebarBg: "#1A1200",
    fares: { ADULT: 10, CHILD: 5, SENIOR: 5, STUDENT: 7, DISABILITY: 5 },
    routes: [
      { id: 5, num: "001", name: "City – Mitchell's Plain", from: "Cape Town Station", to: "Mitchell's Plain Town Centre", tickets: 5421 },
      { id: 6, num: "002", name: "City – Khayelitsha", from: "Cape Town Station", to: "Khayelitsha Terminal", tickets: 6102 },
      { id: 7, num: "003", name: "City – Bellville", from: "Cape Town Station", to: "Bellville Terminus", tickets: 2890 },
      { id: 8, num: "004", name: "City – Somerset West", from: "Cape Town Station", to: "Somerset West", tickets: 1340 },
    ],
    sampleRoutes: ["City → Mitchell's Plain", "City → Khayelitsha", "City → Bellville"],
  },
};

// ─── Mock data generators ─────────────────────────────────────────────────────
function makeMockData(op) {
  const o = OPS[op];
  const fare = o.fares.ADULT;
  return {
    wallet: { balance: op === "myciti" ? 247.50 : 183.00, status: "ACTIVE" },
    tickets: [
      { id: 101, route: o.routes[0], fare_type: "ADULT", amount: fare, status: "ACTIVE", date: new Date(Date.now() - 86400000) },
      { id: 102, route: o.routes[1], fare_type: "ADULT", amount: fare, status: "USED", date: new Date(Date.now() - 172800000) },
      { id: 103, route: o.routes[2], fare_type: "STUDENT", amount: o.fares.STUDENT, status: "USED", date: new Date(Date.now() - 259200000) },
    ],
    transactions: [
      { id: 1, type: "TOPUP", amount: 200, desc: "Top-up via payment gateway", date: new Date(Date.now() - 86400000) },
      { id: 2, type: "PURCHASE", amount: fare, desc: `Ticket — Route ${o.routes[0].num}`, date: new Date(Date.now() - 172800000) },
      { id: 3, type: "TOPUP", amount: 150, desc: "Top-up via payment gateway", date: new Date(Date.now() - 259200000) },
      { id: 4, type: "PURCHASE", amount: fare, desc: `Ticket — Route ${o.routes[1].num}`, date: new Date(Date.now() - 345600000) },
      { id: 5, type: "PURCHASE", amount: o.fares.STUDENT, desc: `Ticket — Route ${o.routes[2].num}`, date: new Date(Date.now() - 432000000) },
    ],
    analytics: {
      tickets24h: op === "myciti" ? 847 : 1203,
      revenue24h: op === "myciti" ? 11858 : 12030,
      activeUsers: op === "myciti" ? 234 : 412,
      monthRevenue: op === "myciti" ? 142600 : 198400,
      monthTickets: op === "myciti" ? 10186 : 19840,
      avgFare: fare,
      chart: Array.from({ length: 14 }, (_, i) => ({
        day: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString("en-ZA", { weekday: "short" }),
        val: Math.round((op === "myciti" ? 8000 : 12000) + Math.random() * 6000),
      })),
    },
    users: [
      { id: "u1", name: "Sarah Dlamini", email: "sarah@demo.co.za", role: "USER", status: "ACTIVE", balance: 247.50 },
      { id: "u2", name: "John Smith", email: "john@demo.co.za", role: "USER", status: "ACTIVE", balance: 82.00 },
      { id: "u3", name: "Amahle Zulu", email: "amahle@demo.co.za", role: "USER", status: "BLOCKED", balance: 0 },
      { id: "u4", name: "Thabo Nkosi", email: "thabo@demo.co.za", role: "USER", status: "ACTIVE", balance: 135.50 },
    ],
  };
}

// ─── Tiny UI primitives ───────────────────────────────────────────────────────
function Btn({ children, variant = "primary", op, size = "md", loading, disabled, onClick, style }) {
  const c = op?.primary || "#0051A0";
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    fontWeight: 700, letterSpacing: "0.02em", borderRadius: 10, border: "2px solid transparent",
    transition: "all 0.15s", cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.55 : 1, fontFamily: "inherit",
    ...(size === "sm" ? { padding: "5px 12px", fontSize: 12 }
      : size === "lg" ? { padding: "13px 28px", fontSize: 15 }
      : { padding: "9px 20px", fontSize: 13 }),
    ...style,
  };
  const v = {
    primary: { background: c, color: "#fff", borderColor: c },
    danger:  { background: "#dc2626", color: "#fff", borderColor: "#dc2626" },
    ghost:   { background: "transparent", color: c, borderColor: c },
    subtle:  { background: "#f0f2f5", color: "#374151", borderColor: "#e4e7ec" },
    success: { background: "#16a34a", color: "#fff", borderColor: "#16a34a" },
  };
  return (
    <button style={{ ...base, ...v[variant] }} disabled={disabled || loading} onClick={onClick}>
      {loading && <span style={{ width: 12, height: 12, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
      {children}
    </button>
  );
}

function Card({ children, style, p = 20 }) {
  return <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e4e7ec", padding: p, boxShadow: "0 1px 4px rgba(0,0,0,.07)", ...style }}>{children}</div>;
}

function Stat({ icon, label, value, accent, sub }) {
  return (
    <Card>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent || "#111827" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

function Badge({ label }) {
  const m = {
    ACTIVE:   ["#DCFCE7","#15803D"], USED:    ["#F1F5F9","#64748B"],
    BLOCKED:  ["#FEE2E2","#DC2626"], PENDING: ["#FEF9C3","#A16207"],
    ADMIN:    ["#EDE9FE","#7C3AED"], USER:    ["#F1F5F9","#475569"],
    EXPIRED:  ["#FEE2E2","#DC2626"],
  };
  const [bg, c] = m[label] || ["#f0f2f5", "#6b7280"];
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 99, fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", background: bg, color: c, textTransform: "uppercase" }}>{label}</span>;
}

function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  const bg = type === "error" ? "#dc2626" : "#16a34a";
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: 13, background: bg, color: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,.25)", animation: "fadein 0.2s ease", display: "flex", alignItems: "center", gap: 8 }}>
      {type === "error" ? "✗" : "✓"} {msg}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ op, nav, active, onNav, user, onLogout }) {
  return (
    <div style={{ width: 232, background: op.sidebarBg, display: "flex", flexDirection: "column", flexShrink: 0, borderRight: `1px solid ${op.primary}30` }}>
      {/* Brand */}
      <div style={{ padding: "24px 20px 18px", borderBottom: `1px solid ${op.primary}25` }}>
        <div style={{ fontSize: 26, marginBottom: 8 }}>{op.logo}</div>
        <div style={{ fontWeight: 900, fontSize: 17, color: "#fff", letterSpacing: "-0.01em" }}>{op.name}</div>
        <div style={{ fontSize: 10, color: `${op.primary}99`, fontWeight: 700, marginTop: 2, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {user?.role === "ADMIN" ? "Admin Portal" : "Passenger"}
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        {nav.map(({ id, icon, label }) => {
          const active_ = active === id;
          return (
            <button key={id} onClick={() => onNav(id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 11,
              padding: "10px 13px", borderRadius: 10, border: "none",
              background: active_ ? `${op.primary}28` : "transparent",
              color: active_ ? "#fff" : "rgba(255,255,255,0.42)",
              fontWeight: active_ ? 700 : 500, fontSize: 13, cursor: "pointer",
              marginBottom: 2, textAlign: "left", transition: "all 0.12s",
              borderLeft: `2px solid ${active_ ? op.primary : "transparent"}`,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              {label}
            </button>
          );
        })}
      </div>

      {/* User footer */}
      <div style={{ padding: "14px 16px 20px", borderTop: `1px solid ${op.primary}20` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: `${op.primary}50`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#fff", flexShrink: 0 }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.32)", marginTop: 1 }}>{user?.role}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ width: "100%", padding: "7px 0", borderRadius: 8, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.38)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", border: `1px solid ${op.primary}20`, cursor: "pointer" }}>
          SIGN OUT
        </button>
      </div>
    </div>
  );
}

// ─── Operator pick screen ─────────────────────────────────────────────────────
function OperatorPicker({ onPick }) {
  const [hov, setHov] = useState(null);
  return (
    <div style={{ minHeight: "100vh", background: "#080A0F", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, position: "relative", overflow: "hidden" }}>
      {/* Dot grid */}
      <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} width="100%" height="100%">
        <defs><pattern id="d" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="15" cy="15" r="1.2" fill="white" opacity="0.04"/></pattern></defs>
        <rect width="100%" height="100%" fill="url(#d)"/>
      </svg>

      <div style={{ position: "relative", textAlign: "center", marginBottom: 56 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚌</div>
        <h1 style={{ fontSize: 46, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 12 }}>CapeConnect</h1>
        <p style={{ color: "rgba(255,255,255,0.32)", fontSize: 16 }}>Choose your bus service to get started</p>
      </div>

      <div style={{ display: "flex", gap: 24, width: "100%", maxWidth: 760, position: "relative" }}>
        {Object.values(OPS).map(op => {
          const h = hov === op.id;
          return (
            <button key={op.id}
              onMouseEnter={() => setHov(op.id)}
              onMouseLeave={() => setHov(null)}
              onClick={() => onPick(op.id)}
              style={{
                flex: 1, borderRadius: 22, overflow: "hidden", cursor: "pointer",
                border: `2px solid ${h ? op.primary : "rgba(255,255,255,0.07)"}`,
                background: "transparent", transition: "all 0.28s cubic-bezier(0.4,0,0.2,1)",
                transform: h ? "translateY(-8px)" : "none",
                boxShadow: h ? `0 32px 64px ${op.primary}50` : "0 4px 28px rgba(0,0,0,.6)",
              }}
            >
              {/* Top gradient panel */}
              <div style={{ padding: "40px 32px 28px", background: op.gradient, position: "relative", overflow: "hidden" }}>
                <svg style={{ position: "absolute", right: -32, top: -32, opacity: 0.07, pointerEvents: "none" }} width="190" height="190">
                  <circle cx="95" cy="95" r="80" fill="none" stroke="white" strokeWidth="20"/>
                  <circle cx="95" cy="95" r="48" fill="none" stroke="white" strokeWidth="14"/>
                </svg>
                <div style={{ position: "relative" }}>
                  <div style={{ fontSize: 44, marginBottom: 16 }}>{op.logo}</div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 6 }}>{op.name}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{op.tagline}</div>
                </div>
              </div>

              {/* Bottom info panel */}
              <div style={{ padding: "22px 28px", background: "#111318" }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.22)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Sample routes</div>
                {op.sampleRoutes.map(r => (
                  <div key={r} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: op.primary, flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{r}</div>
                  </div>
                ))}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)" }}>Adult fare</span>
                  <span style={{ fontWeight: 900, color: op.accent, fontSize: 22 }}>R{op.fares.ADULT}</span>
                </div>
                <div style={{ marginTop: 14, textAlign: "center", fontSize: 13, fontWeight: 700, color: h ? op.primary : "rgba(255,255,255,0.22)", transition: "color 0.2s" }}>
                  Select {op.name} →
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p style={{ position: "relative", marginTop: 40, fontSize: 11, color: "rgba(255,255,255,0.16)" }}>Admin login available after selecting an operator</p>
    </div>
  );
}

// ─── Auth form ────────────────────────────────────────────────────────────────
function AuthForm({ opId, onLogin, onBack }) {
  const op = OPS[opId];
  const [tab, setTab] = useState("passenger");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const DInput = ({ label, ...p }) => {
    const [f, setF] = useState(false);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</label>
        <input onFocus={() => setF(true)} onBlur={() => setF(false)}
          style={{ padding: "11px 15px", borderRadius: 10, border: `1.5px solid ${f ? op.primary : "rgba(255,255,255,0.1)"}`, fontSize: 14, color: "#fff", background: "rgba(255,255,255,0.06)", outline: "none", transition: "border-color 0.15s", fontFamily: "inherit" }}
          {...p}
        />
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      {/* Left brand panel */}
      <div style={{ flex: 1, background: op.gradient, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 52, minWidth: 0 }}>
        <svg style={{ position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none" }} width="100%" height="100%">
          <defs><pattern id="gg" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.8"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#gg)"/>
        </svg>
        <svg style={{ position: "absolute", right: -80, bottom: -80, opacity: 0.06, pointerEvents: "none" }} width="380" height="380">
          <circle cx="190" cy="190" r="155" fill="none" stroke="white" strokeWidth="28"/>
          <circle cx="190" cy="190" r="90" fill="none" stroke="white" strokeWidth="18"/>
          <circle cx="190" cy="190" r="46" fill="none" stroke="white" strokeWidth="11"/>
        </svg>

        <div style={{ position: "relative" }}>
          <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 36, color: "rgba(255,255,255,0.45)", fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", cursor: "pointer" }}>
            ← Choose operator
          </button>
          <div style={{ fontSize: 52, marginBottom: 18 }}>{op.logo}</div>
          <h1 style={{ fontSize: 54, fontWeight: 900, color: "#fff", lineHeight: 0.95, letterSpacing: "-0.03em", marginBottom: 18 }}>{op.name}</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, maxWidth: 260, lineHeight: 1.7 }}>{op.tagline}</p>
        </div>

        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Fare breakdown</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(op.fares).map(([type, amt]) => (
              <div key={type} style={{ textAlign: "center", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)" }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: op.accent }}}>R{amt}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>{type}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ width: 460, background: "#0C0E14", display: "flex", alignItems: "center", justifyContent: "center", padding: 48, flexShrink: 0 }}>
        <div style={{ width: "100%" }}>
          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 4, marginBottom: 36 }}>
            {[["passenger","Passenger"], ["register","Register"], ["admin","Admin"]].map(([id, lbl]) => (
              <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "9px 4px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, letterSpacing: "0.04em", transition: "all 0.18s", background: tab === id ? op.primary : "transparent", color: tab === id ? "#fff" : "rgba(255,255,255,0.35)", fontFamily: "inherit" }}>
                {lbl}
              </button>
            ))}
          </div>

          {tab === "passenger" && (
            <>
              <h2 style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Welcome back</h2>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginBottom: 28 }}>Sign in to your {op.name} account</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <DInput label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/>
                <DInput label="Password" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••"/>
                <Btn op={op} size="lg" style={{ width: "100%", marginTop: 4 }} onClick={() => onLogin("passenger", opId)}>Sign In to {op.name}</Btn>
              </div>
            </>
          )}

          {tab === "register" && (
            <>
              <h2 style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Create account</h2>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginBottom: 28 }}>Join {op.name} — get digital tickets instantly</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <DInput label="Full Name" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith"/>
                <DInput label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/>
                <DInput label="Password" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="At least 8 characters"/>
                <Btn op={op} size="lg" style={{ width: "100%", marginTop: 4 }} onClick={() => onLogin("passenger", opId)}>Create {op.name} Account</Btn>
              </div>
            </>
          )}

          {tab === "admin" && (
            <>
              <h2 style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Admin Portal</h2>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginBottom: 28 }}>{op.name} operator management</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <DInput label="Admin Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@capeconnect.co.za"/>
                <DInput label="Password" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••"/>
                <Btn op={op} size="lg" style={{ width: "100%", marginTop: 4 }} onClick={() => onLogin("admin", opId)}>Enter Admin Portal</Btn>
              </div>
            </>
          )}

          <p style={{ textAlign: "center", marginTop: 28, fontSize: 11, color: "rgba(255,255,255,0.15)" }}>Demo: any values · Password: Admin1234!</p>
        </div>
      </div>
    </div>
  );
}

// ─── Passenger pages ───────────────────────────────────────────────────────────
function PaxDashboard({ op, data, toast }) {
  const { wallet, tickets } = data;
  const active = tickets.filter(t => t.status === "ACTIVE");
  return (
    <div className="ani">
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>Good day 👋</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 28 }}>{op.name} · {new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}</p>

      {/* Wallet hero */}
      <div style={{ borderRadius: 20, padding: "30px 34px", marginBottom: 22, background: op.gradient, color: "#fff", position: "relative", overflow: "hidden" }}>
        <svg style={{ position: "absolute", right: -24, top: -24, opacity: 0.07, pointerEvents: "none" }} width="200" height="200">
          <circle cx="100" cy="100" r="84" fill="none" stroke="white" strokeWidth="20"/>
          <circle cx="100" cy="100" r="50" fill="none" stroke="white" strokeWidth="14"/>
        </svg>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", opacity: 0.6, textTransform: "uppercase", marginBottom: 6 }}>Wallet Balance</div>
        <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 20 }}>R{wallet.balance.toFixed(2)}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={() => toast("Top-up flow — connect to backend", "success")} style={{ background: "rgba(255,255,255,0.18)", color: "#fff", borderColor: "rgba(255,255,255,0.25)" }}>+ Top Up</Btn>
          <Btn style={{ background: "transparent", color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.18)" }}>View History</Btn>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28 }}>
        <Stat icon="🎫" label="Active Tickets" value={active.length}/>
        <Stat icon="🗺️" label="Trips This Month" value={tickets.length} sub="Last 30 days"/>
        <Stat icon="💳" label="Wallet Status" value={wallet.status}/>
      </div>

      {/* Quick actions */}
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Quick Actions</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
        {[["🎫","Buy Ticket"], ["🗺️","Plan Journey"], ["📋","My Tickets"], ["👤","Profile"]].map(([icon, lbl]) => (
          <Card key={lbl} style={{ textAlign: "center", padding: "18px 12px", cursor: "pointer" }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontWeight: 700, fontSize: 12 }}>{lbl}</div>
          </Card>
        ))}
      </div>

      {/* Recent tickets */}
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Recent Tickets</h2>
      <Card p={0} style={{ overflow: "hidden" }}>
        {tickets.map((t, i) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "14px 18px", gap: 14, borderBottom: i < tickets.length - 1 ? "1px solid #f0f2f5" : "none" }}>
            <div style={{ width: 3, height: 38, borderRadius: 2, background: op.primary, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{t.route.num} — {t.route.name}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{t.fare_type} · R{t.amount.toFixed(2)}</div>
            </div>
            <Badge label={t.status}/>
          </div>
        ))}
      </Card>
    </div>
  );
}

function PaxWallet({ op, data }) {
  const { wallet, transactions } = data;
  const total = transactions.length;
  const topped = transactions.filter(t => t.type === "TOPUP").reduce((a, t) => a + t.amount, 0);
  const spent  = transactions.filter(t => t.type === "PURCHASE").reduce((a, t) => a + t.amount, 0);
  return (
    <div className="ani">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Wallet</h1>
        <Btn op={op}>+ Top Up</Btn>
      </div>

      <div style={{ borderRadius: 20, padding: "26px 32px", marginBottom: 22, background: op.gradient, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.6, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Available Balance</div>
          <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.02em" }}>R{wallet.balance.toFixed(2)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, opacity: 0.55, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Status</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{wallet.status}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28 }}>
        <Stat icon="↑" label="Total Topped Up" value={`R${topped.toFixed(2)}`}/>
        <Stat icon="↓" label="Total Spent" value={`R${spent.toFixed(2)}`}/>
        <Stat icon="≡" label="Transactions" value={total}/>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Transaction History</h2>
      <Card p={0} style={{ overflow: "hidden" }}>
        {transactions.map((t, i) => {
          const isC = t.type === "TOPUP";
          const col = isC ? "#16a34a" : "#dc2626";
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "13px 18px", gap: 14, borderBottom: i < transactions.length - 1 ? "1px solid #f0f2f5" : "none" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${col}15`, color: col, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 17, flexShrink: 0 }}>{isC ? "↑" : "↓"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.desc}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{t.date.toLocaleString("en-ZA")}</div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 14, color: col }}>{isC ? "+" : "−"}R{t.amount.toFixed(2)}</div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function PaxBuyTicket({ op, data, toast }) {
  const { wallet, } = data;
  const [routeId, setRouteId] = useState("");
  const [fareType, setFareType] = useState("ADULT");
  const price = op.fares[fareType] || 0;
  const canAfford = wallet.balance >= price;
  const route = op.routes.find(r => String(r.id) === routeId);

  return (
    <div className="ani" style={{ maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>Buy a Ticket</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 28 }}>Select your {op.name} route and fare type.</p>

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Route picker */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: "0.09em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Route</label>
            <select value={routeId} onChange={e => setRouteId(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${routeId ? op.primary : "#e4e7ec"}`, fontSize: 13, background: "#fff", color: "#111827", outline: "none" }}>
              <option value="">— Select a route —</option>
              {op.routes.map(r => <option key={r.id} value={r.id}>{r.num} — {r.name}</option>)}
            </select>
          </div>

          {route && (
            <div style={{ padding: "12px 14px", background: `${op.primary}08`, borderRadius: 10, border: `1px solid ${op.primary}20`, fontSize: 12, color: "#374151" }}>
              <strong>{route.from}</strong> → <strong>{route.to}</strong>
            </div>
          )}

          {/* Fare type */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: "0.09em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Fare Type</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {Object.entries(op.fares).map(([type, amt]) => (
                <button key={type} onClick={() => setFareType(type)} style={{ padding: "10px 8px", borderRadius: 10, border: `2px solid ${fareType === type ? op.primary : "#e4e7ec"}`, background: fareType === type ? `${op.primary}08` : "#fff", cursor: "pointer", textAlign: "center", transition: "all 0.12s" }}>
                  <div style={{ fontWeight: 900, fontSize: 16, color: fareType === type ? op.primary : "#374151" }}>R{amt}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{type}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          {routeId && (
            <div style={{ padding: "14px 16px", background: "#f8f9fb", borderRadius: 12, border: "1px solid #e4e7ec" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Ticket price</span>
                <span style={{ fontWeight: 900, fontSize: 16 }}>R{price.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Wallet balance</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: canAfford ? "#16a34a" : "#dc2626" }}>R{wallet.balance.toFixed(2)}</span>
              </div>
            </div>
          )}

          {!canAfford && routeId && (
            <div style={{ padding: "10px 14px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 10, fontSize: 12, color: "#dc2626" }}>
              ⚠ Insufficient balance. Please top up your wallet first.
            </div>
          )}

          <Btn op={op} size="lg" disabled={!routeId || !canAfford} onClick={() => toast(`✅ Ticket purchased! Route ${route?.num}`, "success")} style={{ width: "100%" }}>
            {routeId ? `Purchase Ticket — R${price.toFixed(2)}` : "Select a route to continue"}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

function PaxTickets({ op, data }) {
  return (
    <div className="ani">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>My Tickets</h1>
        <Btn op={op} size="sm">+ Buy Ticket</Btn>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {data.tickets.map(t => (
          <Card key={t.id} style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: op.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff", flexShrink: 0, letterSpacing: "-0.01em" }}>
              {t.route.num}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{t.route.name}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{t.route.from} → {t.route.to}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{t.fare_type} · {t.date.toLocaleDateString("en-ZA")}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <Badge label={t.status}/>
              <div style={{ fontWeight: 900, fontSize: 16, marginTop: 6 }}>R{t.amount.toFixed(2)}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Admin pages ───────────────────────────────────────────────────────────────
function AdminDash({ op, data }) {
  const { analytics } = data;
  const maxVal = Math.max(...analytics.chart.map(d => d.val));
  return (
    <div className="ani">
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>Analytics Dashboard</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 28 }}>{op.name} · Last 30 days</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        <Stat icon="🎫" label="Tickets (24h)" value={analytics.tickets24h.toLocaleString()}/>
        <Stat icon="💰" label="Revenue (24h)" value={`R${analytics.revenue24h.toLocaleString()}`}/>
        <Stat icon="👤" label="Active Users" value={analytics.activeUsers}/>
        <Stat icon="⚠️" label="Fraud Flags" value={2} accent="#dc2626"/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        <Stat icon="📈" label="Monthly Revenue" value={`R${analytics.monthRevenue.toLocaleString()}`}/>
        <Stat icon="🎟️" label="Monthly Tickets" value={analytics.monthTickets.toLocaleString()}/>
        <Stat icon="🧑‍🤝‍🧑" label="Unique Riders" value={(analytics.monthTickets * 0.34).toFixed(0)}/>
        <Stat icon="💳" label="Avg Fare" value={`R${analytics.avgFare.toFixed(2)}`}/>
      </div>

      {/* Revenue chart */}
      <Card style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 18 }}>Daily Revenue — Last 14 Days</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 110 }}>
          {analytics.chart.map((d, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ width: "100%", background: `${op.primary}CC`, borderRadius: "4px 4px 0 0", height: `${(d.val / maxVal) * 95}px`, transition: "height 0.3s", minHeight: 4 }} title={`R${d.val.toLocaleString()}`}/>
              <div style={{ fontSize: 9, color: "#9ca3af", transform: "rotate(-35deg)", transformOrigin: "center", whiteSpace: "nowrap" }}>{d.day}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Route performance */}
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Route Performance</h2>
      <Card p={0} style={{ overflow: "hidden" }}>
        {op.routes.map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", padding: "13px 18px", gap: 14, borderBottom: i < op.routes.length - 1 ? "1px solid #f0f2f5" : "none" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${op.primary}15`, color: op.primary, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, flexShrink: 0 }}>{r.num}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{r.from} → {r.to}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{r.tickets.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: "#9ca3af" }}>tickets sold</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function AdminUsers({ op, toast }) {
  const [users, setUsers] = useState(makeMockData(op.id).users);
  const [search, setSearch] = useState("");
  const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === "BLOCKED" ? "ACTIVE" : "BLOCKED" } : u));
    toast("User status updated", "success");
  };

  return (
    <div className="ani">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Users</h1>
        <div style={{ fontSize: 12, color: "#6b7280" }}>{filtered.length} passengers</div>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e4e7ec", fontSize: 13, outline: "none", marginBottom: 16, background: "#fff" }}/>
      <Card p={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr auto", padding: "10px 18px", background: "#f8f9fb", borderBottom: "1px solid #e4e7ec", fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: "0.09em", textTransform: "uppercase", gap: 12 }}>
          <div>Name</div><div>Email</div><div>Balance</div><div>Status</div><div>Action</div>
        </div>
        {filtered.map((u, i) => (
          <div key={u.id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr auto", padding: "13px 18px", alignItems: "center", borderBottom: i < filtered.length - 1 ? "1px solid #f0f2f5" : "none", gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</div>
            <div style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>R{u.balance.toFixed(2)}</div>
            <Badge label={u.status}/>
            <Btn size="sm" variant={u.status === "BLOCKED" ? "success" : "danger"} onClick={() => toggle(u.id)}>
              {u.status === "BLOCKED" ? "Unblock" : "Block"}
            </Btn>
          </div>
        ))}
      </Card>
    </div>
  );
}

function AdminRoutes({ op, toast }) {
  const [routes, setRoutes] = useState(op.routes.map(r => ({ ...r, active: true })));
  const toggle = (id) => {
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
    toast("Route status updated", "success");
  };
  return (
    <div className="ani">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Routes</h1>
        <Btn op={op} onClick={() => toast("New route form — add details", "success")}>+ New Route</Btn>
      </div>
      <Card p={0} style={{ overflow: "hidden" }}>
        {routes.map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", padding: "14px 18px", gap: 14, borderBottom: i < routes.length - 1 ? "1px solid #f0f2f5" : "none" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: r.active ? `${op.primary}15` : "#f0f2f5", color: r.active ? op.primary : "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, flexShrink: 0 }}>{r.num}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{r.from} → {r.to}</div>
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "right", minWidth: 80 }}>{r.tickets.toLocaleString()} tickets</div>
            <Badge label={r.active ? "ACTIVE" : "INACTIVE"}/>
            <Btn size="sm" variant={r.active ? "danger" : "success"} onClick={() => toggle(r.id)}>{r.active ? "Disable" : "Enable"}</Btn>
          </div>
        ))}
      </Card>
    </div>
  );
}

function AdminWallets({ op, toast }) {
  const [sel, setSel] = useState(null);
  const [amt, setAmt] = useState("");
  const passengers = makeMockData(op.id).users;
  return (
    <div className="ani">
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 20 }}>Wallet Management</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
        <Stat icon="💰" label={`Total Balance (${op.name})`} value={`R${passengers.reduce((a, u) => a + u.balance, 0).toFixed(2)}`}/>
        <Stat icon="👤" label="Active Wallets" value={passengers.filter(u => u.status === "ACTIVE").length}/>
      </div>
      <Card p={0} style={{ overflow: "hidden" }}>
        {passengers.map((u, i) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", padding: "14px 18px", gap: 14, borderBottom: i < passengers.length - 1 ? "1px solid #f0f2f5" : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{u.email}</div>
            </div>
            <Badge label={u.status}/>
            <div style={{ fontWeight: 900, fontSize: 16, minWidth: 80, textAlign: "right" }}>R{u.balance.toFixed(2)}</div>
            <Btn size="sm" variant="subtle" onClick={() => setSel(u)}>Adjust</Btn>
          </div>
        ))}
      </Card>

      {sel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <Card style={{ width: 380 }}>
            <h3 style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Adjust Wallet</h3>
            <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 18 }}>{sel.name} · Current: R{sel.balance.toFixed(2)}</p>
            <input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder="e.g. 50 (add) or -20 (deduct)" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e4e7ec", fontSize: 13, marginBottom: 16, outline: "none" }}/>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn op={op} onClick={() => { toast(`Wallet adjusted by R${amt || 0}`, "success"); setSel(null); setAmt(""); }}>Apply</Btn>
              <Btn variant="subtle" onClick={() => setSel(null)}>Cancel</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Shell / App ──────────────────────────────────────────────────────────────
const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Inter', system-ui, sans-serif; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  .ani { animation: fadein 0.22s ease; }
  ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
  button { font-family: inherit; }
`;

export default function App() {
  const [screen, setScreen] = useState("pick");   // pick | auth | app
  const [opId, setOpId] = useState(null);
  const [role, setRole] = useState(null);
  const [page, setPage] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);

  const op = opId ? OPS[opId] : null;
  const data = opId ? makeMockData(opId) : null;

  const handlePick = (id) => { setOpId(id); setScreen("auth"); };

  const handleLogin = (r, id) => {
    setRole(r); setOpId(id);
    setPage(r === "admin" ? "analytics" : "dashboard");
    setScreen("app");
  };

  const logout = () => { setScreen("pick"); setOpId(null); setRole(null); setPage(null); };

  // Nav config
  const paxNav = [
    { id: "dashboard", icon: "🏠", label: "Dashboard" },
    { id: "tickets",   icon: "🎫", label: "My Tickets" },
    { id: "buy",       icon: "🛒", label: "Buy Ticket" },
    { id: "wallet",    icon: "💳", label: "Wallet" },
    { id: "journey",   icon: "🗺️", label: "Journey Planner" },
    { id: "profile",   icon: "👤", label: "Profile" },
  ];
  const adminNav = [
    { id: "analytics",  icon: "📊", label: "Analytics" },
    { id: "users",      icon: "👥", label: "Users" },
    { id: "routes",     icon: "🚌", label: "Routes" },
    { id: "timetables", icon: "🕐", label: "Timetables" },
    { id: "prices",     icon: "💰", label: "Prices" },
    { id: "wallets",    icon: "👛", label: "Wallets" },
    { id: "audit",      icon: "📋", label: "Audit Log" },
  ];
  const nav = role === "admin" ? adminNav : paxNav;

  const renderPage = () => {
    if (!op || !data) return null;
    if (role === "admin") {
      if (page === "analytics")  return <AdminDash op={op} data={data}/>;
      if (page === "users")      return <AdminUsers op={op} toast={showToast}/>;
      if (page === "routes")     return <AdminRoutes op={op} toast={showToast}/>;
      if (page === "wallets")    return <AdminWallets op={op} toast={showToast}/>;
      return (
        <div className="ani">
          <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 16 }}>{nav.find(n => n.id === page)?.label}</h1>
          <Card><p style={{ color: "#6b7280", lineHeight: 1.7 }}>This section is fully implemented in the codebase. Connect to the backend API to see live {op.name} data.</p></Card>
        </div>
      );
    }
    if (page === "dashboard") return <PaxDashboard op={op} data={data} toast={showToast}/>;
    if (page === "wallet")    return <PaxWallet op={op} data={data}/>;
    if (page === "buy")       return <PaxBuyTicket op={op} data={data} toast={showToast}/>;
    if (page === "tickets")   return <PaxTickets op={op} data={data}/>;
    return (
      <div className="ani">
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 16 }}>{nav.find(n => n.id === page)?.label}</h1>
        <Card><p style={{ color: "#6b7280", lineHeight: 1.7 }}>This section is fully implemented in the codebase. Connect to the {op.name} backend to see live data.</p></Card>
      </div>
    );
  };

  const user = { name: role === "admin" ? `${op?.name} Admin` : "Sarah Dlamini", role: role === "admin" ? "ADMIN" : "USER" };

  return (
    <>
      <style>{CSS}</style>

      {screen === "pick" && <OperatorPicker onPick={handlePick}/>}
      {screen === "auth" && op && <AuthForm opId={opId} onLogin={handleLogin} onBack={() => setScreen("pick")}/>}
      {screen === "app" && op && (
        <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
          <Sidebar op={op} nav={nav} active={page} onNav={setPage} user={user} onLogout={logout}/>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Topbar */}
            <div style={{ height: 56, background: "#fff", borderBottom: "1px solid #e4e7ec", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>
                {nav.find(n => n.id === page)?.label}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Operator badge */}
                <div style={{ padding: "4px 12px", borderRadius: 99, background: `${op.primary}12`, border: `1px solid ${op.primary}30`, fontSize: 11, fontWeight: 800, color: op.primary, letterSpacing: "0.06em" }}>
                  {op.logo} {op.name}
                </div>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${op.primary}20`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: op.primary }}>
                  {user.name[0]}
                </div>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 32, background: "#f8f9fb" }}>
              {renderPage()}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
    </>
  );
}
