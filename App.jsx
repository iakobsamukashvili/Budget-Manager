import { useState, useEffect, useRef } from "react";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const SYSTEM_PROMPT = `შენ ხარ პროექტების ხარჯების მმართველი AI აგენტი. შენი ამოცანაა მომხმარებლის პროექტებისა და ხარჯების აღრიცხვა.

მომხმარებელი გეტყვის პროექტებზე, ხარჯებზე, გადახდებზე — შენ უნდა:
1. გაიაზრო რა ინფორმაცია მოიტანა (ახალი პროექტი, ახალი ხარჯი, კითხვა, სტატისტიკა)
2. დააბრუნო JSON პასუხი ზუსტი სტრუქტურით
3. ქართულად ილაპარაკო

ყოველთვის დააბრუნე მხოლოდ JSON ამ ფორმატით (სხვა ტექსტი არ, markdown არ):
{
  "message": "შენი პასუხი მომხმარებელს (ქართულად)",
  "action": "none" | "add_project" | "add_expense" | "update_expense" | "delete_expense",
  "data": {
    // add_project-ისთვის:
    // "project_name": "...", "description": "..."
    
    // add_expense-ისთვის:
    // "project_name": "...", "description": "...", "amount": 0, "currency": "GEL", "date": "YYYY-MM-DD", "category": "...", "paid": true/false
    
    // update_expense-ისთვის:
    // "expense_id": "...", "paid": true/false
    
    // delete_expense-ისთვის:
    // "expense_id": "..."
  }
}

კატეგორიების მაგალითები: "ტრანსპორტი", "კვება", "სერვისები", "აღჭურვილობა", "პერსონალი", "მარკეტინგი", "სხვა"
თუ მომხმარებელი ამბობს "დღეს" ან კონკრეტულ თარიღს არ ასახელებს, გამოიყენე დღევანდელი თარიღი.
თუ action "none"-ია, data შეიძლება იყოს null.
თუ ვალუტა არ არის მითითებული — GEL.`;

const generateId = () => Math.random().toString(36).substr(2, 9);
const todayStr = () => new Date().toISOString().split("T")[0];

const STORAGE_KEY_PROJECTS = "pt_projects_v1";
const STORAGE_KEY_EXPENSES = "pt_expenses_v1";

function loadLocal(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "გამარჯობა! მე ვარ შენი პროექტების ხარჯების ასისტენტი.\n\nმიმეცი ნებისმიერი ინფო — ახალი ხარჯი, პროექტი, ან სტატისტიკის კითხვა. ვისაუბრებ ქართულად 🇬🇪",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState(() => loadLocal(STORAGE_KEY_PROJECTS, {}));
  const [expenses, setExpenses] = useState(() => loadLocal(STORAGE_KEY_EXPENSES, []));
  const [activeTab, setActiveTab] = useState("chat");
  const [selectedProject, setSelectedProject] = useState("all");
  const [apiKey, setApiKey] = useState(GEMINI_KEY || loadLocal("pt_apikey", ""));
  const [showKeyInput, setShowKeyInput] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { saveLocal(STORAGE_KEY_PROJECTS, projects); }, [projects]);
  useEffect(() => { saveLocal(STORAGE_KEY_EXPENSES, expenses); }, [expenses]);
  useEffect(() => { if (apiKey) saveLocal("pt_apikey", apiKey); }, [apiKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const applyAction = (action, data) => {
    if (!data) return;
    if (action === "add_project" && data.project_name) {
      setProjects((p) => ({
        ...p,
        [data.project_name]: {
          name: data.project_name,
          description: data.description || "",
          created: todayStr(),
        },
      }));
    } else if (action === "add_expense") {
      const exp = {
        id: generateId(),
        project: data.project_name || "სხვა",
        description: data.description || "",
        amount: parseFloat(data.amount) || 0,
        currency: data.currency || "GEL",
        date: data.date || todayStr(),
        category: data.category || "სხვა",
        paid: data.paid !== undefined ? data.paid : true,
        created: todayStr(),
      };
      setExpenses((e) => [exp, ...e]);
      if (exp.project && exp.project !== "სხვა") {
        setProjects((p) => ({
          ...p,
          [exp.project]: p[exp.project] || {
            name: exp.project,
            description: "",
            created: todayStr(),
          },
        }));
      }
    } else if (action === "update_expense" && data.expense_id) {
      setExpenses((e) =>
        e.map((x) => (x.id === data.expense_id ? { ...x, ...data } : x))
      );
    } else if (action === "delete_expense" && data.expense_id) {
      setExpenses((e) => e.filter((x) => x.id !== data.expense_id));
    }
  };

  const buildContext = () => {
    const projList = Object.keys(projects).length
      ? Object.values(projects).map((p) => p.name).join(", ")
      : "ჯერ არ არის";
    const expList = expenses
      .slice(0, 40)
      .map(
        (e) =>
          `[ID:${e.id}] ${e.date} | ${e.project} | ${e.description} | ${e.amount} ${e.currency} | ${e.paid ? "გადახდილია" : "გადასახდელია"} | ${e.category}`
      )
      .join("\n");
    return `\n\n---\nმიმდინარე მონაცემები:\nპროექტები: ${projList}\n\nბოლო ხარჯები:\n${expList || "ჯერ არ არის"}\n\nდღევანდელი თარიღი: ${todayStr()}`;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!apiKey) {
      setShowKeyInput(true);
      return;
    }
    setInput("");
    const userMsg = { role: "user", text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const history = newMessages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.text,
      }));
      history[history.length - 1].content += buildContext();

      const geminiMessages = history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: geminiMessages,
            generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "API შეცდომა");
      }

      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      let parsed;
      try {
        parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      } catch {
        parsed = { message: raw, action: "none", data: null };
      }

      if (parsed.action && parsed.action !== "none") {
        applyAction(parsed.action, parsed.data);
      }

      setMessages((m) => [
        ...m,
        { role: "assistant", text: parsed.message || "..." },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `⚠️ ${e.message || "შეცდომა მოხდა"}` },
      ]);
    }
    setLoading(false);
  };

  const filteredExpenses =
    selectedProject === "all"
      ? expenses
      : expenses.filter((e) => e.project === selectedProject);

  const totalPaid = filteredExpenses
    .filter((e) => e.paid)
    .reduce((s, e) => s + e.amount, 0);
  const totalUnpaid = filteredExpenses
    .filter((e) => !e.paid)
    .reduce((s, e) => s + e.amount, 0);

  const togglePaid = (id) => {
    setExpenses((e) =>
      e.map((x) => (x.id === id ? { ...x, paid: !x.paid } : x))
    );
  };
  const deleteExpense = (id) => {
    if (confirm("ხარჯი წაიშლება. დარწმუნებული ხარ?"))
      setExpenses((e) => e.filter((x) => x.id !== id));
  };

  const currencySymbol = (c) => (c === "GEL" ? "₾" : c === "USD" ? "$" : c === "EUR" ? "€" : c);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100dvh",
      background: "#0e0f14",
      maxWidth: 600,
      margin: "0 auto",
      position: "relative",
    }}>

      {/* API Key Modal */}
      {showKeyInput && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100, padding: 24,
        }}>
          <div style={{
            background: "#1a1b28", border: "1px solid #2a2b3a",
            borderRadius: 16, padding: 24, width: "100%", maxWidth: 360,
          }}>
            <div style={{ fontSize: 16, fontWeight: "bold", marginBottom: 8, color: "#e8c97a" }}>
              Gemini API გასაღები
            </div>
            <div style={{ fontSize: 12, color: "#6b6d80", marginBottom: 16, lineHeight: 1.5 }}>
              გადადი aistudio.google.com → "Get API Key" → შექმენი გასაღები
            </div>
            <input
              autoFocus
              type="password"
              placeholder="AIza..."
              defaultValue={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{
                width: "100%", background: "#0e0f14",
                border: "1px solid #2a2b3a", borderRadius: 10,
                padding: "10px 14px", color: "#e8e4d9", fontSize: 13,
                outline: "none", marginBottom: 12,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowKeyInput(false)} style={{
                flex: 1, background: "#2a2b3a", border: "none",
                borderRadius: 10, padding: "10px", color: "#8a8b9a",
                cursor: "pointer", fontSize: 13,
              }}>გაუქმება</button>
              <button onClick={() => setShowKeyInput(false)} style={{
                flex: 1, background: "linear-gradient(135deg, #c9a84c, #b8942e)",
                border: "none", borderRadius: 10, padding: "10px",
                color: "#0e0f14", cursor: "pointer", fontSize: 13, fontWeight: "bold",
              }}>შენახვა</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        background: "linear-gradient(180deg, #1a1b28 0%, #141520 100%)",
        borderBottom: "1px solid #1e1f2e",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
      }}>
        <div style={{
          width: 36, height: 36,
          background: "linear-gradient(135deg, #c9a84c, #e8c97a)",
          borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: "bold", color: "#0e0f14",
        }}>₾</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: "700", color: "#e8c97a", letterSpacing: 0.5 }}>
            პროექტ-ტრეკერი
          </div>
          <div style={{ fontSize: 10, color: "#4a4b6a", letterSpacing: 1.5 }}>AI EXPENSE AGENT</div>
        </div>
        <button onClick={() => setShowKeyInput(true)} style={{
          background: apiKey ? "#1e2e1e" : "#2e1e1e",
          border: `1px solid ${apiKey ? "#3a5a3a" : "#5a3a3a"}`,
          borderRadius: 8, padding: "5px 10px",
          color: apiKey ? "#5db87a" : "#e07070",
          fontSize: 10, cursor: "pointer", letterSpacing: 0.5,
        }}>
          {apiKey ? "✓ API" : "⚠ API"}
        </button>
      </div>

      {/* Summary bar */}
      <div style={{
        background: "#0e0f14",
        borderBottom: "1px solid #1a1b28",
        padding: "8px 16px",
        display: "flex",
        gap: 16,
        fontSize: 12,
        flexShrink: 0,
        overflowX: "auto",
      }}>
        <span style={{ color: "#6b6d80", whiteSpace: "nowrap" }}>
          პროექტები: <span style={{ color: "#c9a84c", fontWeight: "bold" }}>{Object.keys(projects).length}</span>
        </span>
        <span style={{ color: "#6b6d80", whiteSpace: "nowrap" }}>
          გადახდილი: <span style={{ color: "#5db87a", fontWeight: "bold" }}>{totalPaid.toFixed(2)}₾</span>
        </span>
        <span style={{ color: "#6b6d80", whiteSpace: "nowrap" }}>
          გადასახდელი: <span style={{ color: "#e07070", fontWeight: "bold" }}>{totalUnpaid.toFixed(2)}₾</span>
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* CHAT */}
        {activeTab === "chat" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{
              flex: 1, overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              {messages.map((m, i) => (
                <div key={i} className="msg-enter" style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}>
                  <div style={{
                    maxWidth: "82%",
                    background: m.role === "user"
                      ? "linear-gradient(135deg, #c9a84c, #b8942e)"
                      : "#1a1b28",
                    color: m.role === "user" ? "#0e0f14" : "#e8e4d9",
                    border: m.role === "assistant" ? "1px solid #2a2b3a" : "none",
                    borderRadius: m.role === "user"
                      ? "18px 18px 4px 18px"
                      : "18px 18px 18px 4px",
                    padding: "11px 14px",
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex" }}>
                  <div style={{
                    background: "#1a1b28",
                    border: "1px solid #2a2b3a",
                    borderRadius: "18px 18px 18px 4px",
                    padding: "12px 16px",
                    display: "flex",
                    gap: 5,
                    alignItems: "center",
                  }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{
                        width: 6, height: 6,
                        borderRadius: "50%",
                        background: "#c9a84c",
                        animation: "pulse 1.2s ease-in-out infinite",
                        animationDelay: `${i * 0.2}s`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Suggestions */}
            <div style={{
              padding: "0 16px 8px",
              display: "flex",
              gap: 6,
              overflowX: "auto",
              flexShrink: 0,
            }}>
              {[
                "სულ რამდენი გავხარჯე?",
                "გადასახდელი ხარჯები",
                "ახალი პროექტი",
              ].map((s) => (
                <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }} style={{
                  background: "transparent",
                  border: "1px solid #2a2b3a",
                  borderRadius: 16,
                  padding: "5px 12px",
                  color: "#6b6d80",
                  fontSize: 11,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}>{s}</button>
              ))}
            </div>

            {/* Input */}
            <div style={{
              padding: "8px 16px 16px",
              background: "#0e0f14",
              borderTop: "1px solid #1a1b28",
              display: "flex",
              gap: 10,
              flexShrink: 0,
            }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder='მაგ: "450₾ ვხარჯე AI WEEK-ზე ტრანსპორტზე"'
                style={{
                  flex: 1,
                  background: "#1a1b28",
                  border: "1px solid #2a2b3a",
                  borderRadius: 12,
                  padding: "11px 14px",
                  color: "#e8e4d9",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                style={{
                  background: loading || !input.trim()
                    ? "#1a1b28"
                    : "linear-gradient(135deg, #c9a84c, #b8942e)",
                  border: "1px solid #2a2b3a",
                  borderRadius: 12,
                  padding: "11px 16px",
                  color: loading || !input.trim() ? "#3a3b5a" : "#0e0f14",
                  fontSize: 16,
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}
              >➤</button>
            </div>
          </div>
        )}

        {/* EXPENSES */}
        {activeTab === "expenses" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            {/* Filter */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
              {["all", ...Object.keys(projects)].map((p) => (
                <button key={p} onClick={() => setSelectedProject(p)} style={{
                  background: selectedProject === p ? "#c9a84c" : "#1a1b28",
                  border: `1px solid ${selectedProject === p ? "#c9a84c" : "#2a2b3a"}`,
                  color: selectedProject === p ? "#0e0f14" : "#8a8b9a",
                  borderRadius: 20,
                  padding: "5px 12px",
                  fontSize: 11,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontWeight: selectedProject === p ? "bold" : "normal",
                }}>
                  {p === "all" ? "ყველა" : p}
                </button>
              ))}
            </div>

            {filteredExpenses.length === 0 ? (
              <div style={{ textAlign: "center", color: "#3a3b4a", marginTop: 60 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 14 }}>ხარჯები არ არის</div>
                <div style={{ fontSize: 11, color: "#2a2b3a", marginTop: 6 }}>ჩატში მიწერე ხარჯის შესახებ</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredExpenses.map((e) => (
                  <div key={e.id} style={{
                    background: "#1a1b28",
                    border: `1px solid ${e.paid ? "#1e2e22" : "#2e1e1e"}`,
                    borderLeft: `3px solid ${e.paid ? "#5db87a" : "#e07070"}`,
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: "600", marginBottom: 3,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{e.description}</div>
                      <div style={{ fontSize: 11, color: "#5a5b7a", display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span>📁 {e.project}</span>
                        <span>🏷 {e.category}</span>
                        <span>📅 {e.date}</span>
                      </div>
                    </div>
                    <div style={{
                      fontSize: 15, fontWeight: "bold",
                      color: e.paid ? "#5db87a" : "#e07070",
                      flexShrink: 0,
                    }}>
                      {e.amount.toFixed(2)}{currencySymbol(e.currency)}
                    </div>
                    <button onClick={() => togglePaid(e.id)} style={{
                      background: e.paid ? "#1e2e22" : "#2e1e1e",
                      border: `1px solid ${e.paid ? "#5db87a" : "#e07070"}`,
                      borderRadius: 6, padding: "4px 8px",
                      color: e.paid ? "#5db87a" : "#e07070",
                      cursor: "pointer", fontSize: 11, flexShrink: 0,
                    }}>{e.paid ? "✓" : "○"}</button>
                    <button onClick={() => deleteExpense(e.id)} style={{
                      background: "transparent",
                      border: "1px solid #2a2b3a",
                      borderRadius: 6, padding: "4px 7px",
                      color: "#4a4b5a", cursor: "pointer", fontSize: 12, flexShrink: 0,
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROJECTS */}
        {activeTab === "projects" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            {Object.keys(projects).length === 0 ? (
              <div style={{ textAlign: "center", color: "#3a3b4a", marginTop: 60 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
                <div style={{ fontSize: 14 }}>პროექტები არ არის</div>
                <div style={{ fontSize: 11, color: "#2a2b3a", marginTop: 6 }}>ჩატში უთხარი პროექტის სახელი</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.values(projects).map((p) => {
                  const pExp = expenses.filter((e) => e.project === p.name);
                  const paid = pExp.filter((e) => e.paid).reduce((s, e) => s + e.amount, 0);
                  const unpaid = pExp.filter((e) => !e.paid).reduce((s, e) => s + e.amount, 0);
                  return (
                    <div
                      key={p.name}
                      onClick={() => { setSelectedProject(p.name); setActiveTab("expenses"); }}
                      style={{
                        background: "#1a1b28",
                        border: "1px solid #2a2b3a",
                        borderRadius: 14,
                        padding: "16px",
                        cursor: "pointer",
                        transition: "border-color 0.15s",
                      }}
                      onTouchStart={(e) => e.currentTarget.style.borderColor = "#c9a84c"}
                      onTouchEnd={(e) => e.currentTarget.style.borderColor = "#2a2b3a"}
                    >
                      <div style={{ fontSize: 15, fontWeight: "700", marginBottom: 4, color: "#e8c97a" }}>
                        📁 {p.name}
                      </div>
                      {p.description && (
                        <div style={{ fontSize: 12, color: "#5a5b7a", marginBottom: 10 }}>{p.description}</div>
                      )}
                      <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                        <span style={{ color: "#6b6d80" }}>
                          ხარჯები: <span style={{ color: "#e8e4d9" }}>{pExp.length}</span>
                        </span>
                        <span style={{ color: "#5db87a" }}>✓ {paid.toFixed(2)}₾</span>
                        <span style={{ color: "#e07070" }}>○ {unpaid.toFixed(2)}₾</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{
        background: "#141520",
        borderTop: "1px solid #1e1f2e",
        display: "flex",
        flexShrink: 0,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {[
          { id: "chat", icon: "💬", label: "ჩატი" },
          { id: "expenses", icon: "💰", label: "ხარჯები" },
          { id: "projects", icon: "📁", label: "პროექტები" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              borderTop: `2px solid ${activeTab === tab.id ? "#c9a84c" : "transparent"}`,
              padding: "10px 0 8px",
              color: activeTab === tab.id ? "#c9a84c" : "#4a4b6a",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              transition: "color 0.15s",
            }}
          >
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
            <span style={{ fontSize: 10, letterSpacing: 0.3 }}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
