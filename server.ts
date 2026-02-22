import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });

import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("phishguard.db");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    risk_score INTEGER DEFAULT 100
  );
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    dept_id INTEGER,
    security_score INTEGER DEFAULT 100,
    simulations_completed INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    FOREIGN KEY(dept_id) REFERENCES departments(id)
  );
  CREATE TABLE IF NOT EXISTS simulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    difficulty INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    status TEXT,
    target_dept_id INTEGER,
    sim_type TEXT,
    launched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(target_dept_id) REFERENCES departments(id)
  );
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    simulation_id INTEGER,
    campaign_id INTEGER,
    sim_type TEXT DEFAULT 'email',
    is_correct BOOLEAN,
    score INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    difficulty INTEGER DEFAULT 1,
    flags_identified TEXT,
    flags_missed TEXT,
    feedback TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(employee_id) REFERENCES employees(id),
    FOREIGN KEY(simulation_id) REFERENCES simulations(id),
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
  );
`);

// Idempotent column adds for dev restarts
const safeAdd = (t: string, c: string, ty: string) => { try { db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${ty}`); } catch {} };
safeAdd("employees","simulations_completed","INTEGER DEFAULT 0");
safeAdd("employees","current_streak","INTEGER DEFAULT 0");
safeAdd("employees","best_streak","INTEGER DEFAULT 0");
safeAdd("employees","xp","INTEGER DEFAULT 0");
safeAdd("employees","level","INTEGER DEFAULT 1");
safeAdd("results","sim_type","TEXT DEFAULT 'email'");
safeAdd("results","score","INTEGER DEFAULT 0");
safeAdd("results","response_time_ms","INTEGER");
safeAdd("results","difficulty","INTEGER DEFAULT 1");
safeAdd("results","flags_identified","TEXT");
safeAdd("results","flags_missed","TEXT");

// ── Seed ──
const seed = () => {
  const c = db.prepare("SELECT COUNT(*) as count FROM departments").get() as any;
  if (c.count > 0) return;
  const depts = [
    { name: "Engineering", risk: 72 }, { name: "Finance", risk: 85 },
    { name: "Marketing", risk: 58 }, { name: "HR", risk: 63 }, { name: "Sales", risk: 51 },
  ];
  const iD = db.prepare("INSERT INTO departments (name, risk_score) VALUES (?, ?)");
  depts.forEach(d => iD.run(d.name, d.risk));

  const emps = [
    { name: "Alice Chen", email: "alice@corp.com", dept: "Engineering" },
    { name: "Bob Smith", email: "bob@corp.com", dept: "Finance" },
    { name: "Charlie Day", email: "charlie@corp.com", dept: "Marketing" },
    { name: "Diana Ross", email: "diana@corp.com", dept: "HR" },
    { name: "Eve Johnson", email: "eve@corp.com", dept: "Sales" },
  ];
  const iE = db.prepare("INSERT INTO employees (name, email, dept_id, security_score, xp) VALUES (?, ?, (SELECT id FROM departments WHERE name = ?), 100, 0)");
  emps.forEach(e => iE.run(e.name, e.email, e.dept));

  // 14 days of historical data for charts
  const iR = db.prepare(`INSERT INTO results (employee_id, sim_type, is_correct, score, response_time_ms, difficulty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const types = ["email", "deepfake", "phone"];
  const now = Date.now();
  for (let day = 13; day >= 0; day--) {
    const date = new Date(now - day * 86400000).toISOString();
    for (let s = 0; s < Math.floor(Math.random() * 4) + 1; s++) {
      const empId = Math.floor(Math.random() * 5) + 1;
      const type = types[Math.floor(Math.random() * types.length)];
      const diff = Math.floor(Math.random() * 5) + 1;
      const correct = Math.random() > 0.35 ? 1 : 0;
      const score = correct ? Math.floor(Math.random() * 30) + 70 : Math.floor(Math.random() * 50) + 10;
      iR.run(empId, type, correct, score, Math.floor(Math.random() * 60000) + 5000, diff, date);
    }
  }
};
seed();

// ── Gemini Helpers ── (key from GEMINI_API_KEY in .env or .env.local; never commit real keys)
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";

async function verifyGeminiKey(): Promise<void> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`;
    const res = await fetch(url);
    const text = await res.text();
    if (res.ok) {
      console.log("   ✓ Gemini API key verified.");
      return;
    }
    console.error("   ✗ Gemini key rejected by Google:", res.status, text.slice(0, 200));
    console.error("   → Copy the key again from https://aistudio.google.com/apikey and set GEMINI_API_KEY in .env or .env.local.");
  } catch (e: any) {
    console.error("   ✗ Gemini key check failed:", e?.message || e);
  }
}

function sanitizeGeminiError(msg: string): string {
  if (!msg || typeof msg !== "string") return "AI request failed.";
  if (msg.includes(".env") || msg.includes("API key") || msg.includes("API_KEY")) {
    return "Gemini API key invalid or not enabled. Get a free key at https://aistudio.google.com/apikey and turn on Generative Language API.";
  }
  return msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
}

async function callGemini(model: string, contents: any, config?: any) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const body: any = { contents: Array.isArray(contents) ? contents : [{ parts: [{ text: contents }] }] };
  if (config?.systemInstruction) body.systemInstruction = { parts: [{ text: config.systemInstruction }] };
  if (config?.responseMimeType) {
    body.generationConfig = { responseMimeType: config.responseMimeType, ...(config.responseSchema ? { responseSchema: config.responseSchema } : {}) };
  }
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(sanitizeGeminiError(text || `Gemini ${res.status}`));
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error(sanitizeGeminiError(text)); }
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGeminiTTS(text: string, voice = "Charon") {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    }),
  });
  const ttsText = await res.text();
  if (!res.ok) throw new Error(sanitizeGeminiError(ttsText || `TTS ${res.status}`));
  let data: any;
  try { data = JSON.parse(ttsText); } catch { throw new Error(sanitizeGeminiError(ttsText)); }
  return data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
}

function getAdaptiveDifficulty(empId: number): number {
  const r = db.prepare(`SELECT AVG(score) as a, COUNT(*) as c FROM (SELECT score FROM results WHERE employee_id = ? ORDER BY created_at DESC LIMIT 5)`).get(empId) as any;
  if (!r || r.c < 3) return 2;
  if (r.a > 85) return 4;
  if (r.a > 70) return 3;
  if (r.a > 50) return 2;
  return 1;
}

function awardXP(empId: number, score: number, difficulty: number, isCorrect: boolean) {
  const baseXP = isCorrect ? 50 : 10;
  const totalXP = Math.floor(baseXP * difficulty * 0.5 + score / 10);
  const emp = db.prepare("SELECT xp, level, current_streak, best_streak FROM employees WHERE id = ?").get(empId) as any;
  const newXP = (emp?.xp || 0) + totalXP;
  const newLevel = Math.floor(newXP / 200) + 1;
  const newStreak = isCorrect ? (emp?.current_streak || 0) + 1 : 0;
  const bestStreak = Math.max(emp?.best_streak || 0, newStreak);
  db.prepare(`UPDATE employees SET xp=?, level=?, current_streak=?, best_streak=?, simulations_completed=simulations_completed+1, security_score=CASE WHEN ?=1 THEN MIN(100,security_score+2+?) ELSE MAX(0,security_score-3-?) END WHERE id=?`).run(newXP, newLevel, newStreak, bestStreak, isCorrect?1:0, difficulty, difficulty, empId);
  return { xp: totalXP, newLevel, streak: newStreak, totalXP: newXP };
}

// ── Server ──
async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_r, res) => res.json({ status: "ok", gemini: true }));

  // ── GENERATION (all server-side, key never in browser) ──

  app.post("/api/generate/email", async (req, res) => {
    try {
      const empId = req.body.employee_id || 1;
      const difficulty = getAdaptiveDifficulty(empId);
      const prompt = `Generate a realistic phishing email for finance-sector cybersecurity training. The target is a finance/accounting employee.
Theme: finance-oriented attacks only — e.g. urgent wire transfer request, fake invoice or payment change, banking/account verification, CFO or executive impersonation, ACH or vendor payment redirect, investment or treasury scam, loan/refund fraud.
Difficulty: ${difficulty}/5 (1=obvious spam, 3=convincing finance email, 5=targeted BEC/wire fraud).
At difficulty ${difficulty}, ${difficulty <= 2 ? "use obvious red flags: misspellings, generic greetings, suspicious domains" : difficulty <= 3 ? "use convincing finance language with subtle domain spoofing and urgency" : "use highly targeted finance spear phishing: typosquatted bank/vendor domains, CFO impersonation, specific wire or invoice details"}.
Include: subject, sender name, sender email (domain should look finance-related but suspicious scaled to difficulty), body in Markdown with embedded suspicious links, 3-6 red flags, explanation of the attack vector.`;
      const text = await callGemini("gemini-2.5-flash", prompt, {
        responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: {
          subject: { type: "STRING" }, senderName: { type: "STRING" }, senderEmail: { type: "STRING" },
          body: { type: "STRING" }, redFlags: { type: "ARRAY", items: { type: "STRING" } },
          explanation: { type: "STRING" }, attackVector: { type: "STRING" },
        }, required: ["subject","senderName","senderEmail","body","redFlags","explanation"] },
      });
      const email = JSON.parse(text);
      const sim = db.prepare("INSERT INTO simulations (type, difficulty, content) VALUES (?, ?, ?)").run("email", difficulty, JSON.stringify(email));
      res.json({ ...email, simulation_id: sim.lastInsertRowid, difficulty });
    } catch (e: any) { console.error(e); res.status(500).json({ error: sanitizeGeminiError(e?.message || String(e)) }); }
  });

  app.post("/api/generate/phone", async (req, res) => {
    try {
      const empId = req.body.employee_id || 1;
      const difficulty = getAdaptiveDifficulty(empId);
      const scenarios = [
        "Bank or credit union fraud department about suspicious transactions requiring verification",
        "CEO or CFO urgently requesting a wire transfer or ACH change",
        "Vendor or supplier requesting updated payment details or a new bank account",
        "Tax authority or IRS threatening legal action unless immediate payment",
        "Investment or treasury team offering a time-sensitive opportunity",
        "Loan servicer or refinance offer requesting personal or account information",
        "Audit or compliance team asking to confirm credentials or approve a payment",
      ];
      const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
      const prompt = `Generate a vishing (voice phishing) phone call script for finance-sector training. The target is a finance/accounting employee.
Difficulty: ${difficulty}/5. Scenario: ${scenario}
Keep the scenario finance-focused (wires, payments, accounts, verification). Include: caller persona (name, role, org), scenario description, full attacker script (2-3 paragraphs, conversational), 4-6 red flags, explanation of technique used.`;
      const text = await callGemini("gemini-2.5-flash", prompt, {
        responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: {
          callerName: { type: "STRING" }, callerRole: { type: "STRING" }, scenario: { type: "STRING" },
          attackerScript: { type: "STRING" }, redFlags: { type: "ARRAY", items: { type: "STRING" } },
          explanation: { type: "STRING" }, technique: { type: "STRING" },
        }, required: ["scenario","attackerScript","redFlags","explanation"] },
      });
      const sim = JSON.parse(text);
      let audioBase64 = null;
      try { audioBase64 = await callGeminiTTS(sim.attackerScript.slice(0, 500)); } catch (e: any) { console.warn("TTS failed:", e.message); }
      const simInfo = db.prepare("INSERT INTO simulations (type, difficulty, content) VALUES (?, ?, ?)").run("phone", difficulty, JSON.stringify(sim));
      res.json({ ...sim, audioBase64, simulation_id: simInfo.lastInsertRowid, difficulty });
    } catch (e: any) { console.error(e); res.status(500).json({ error: sanitizeGeminiError(e?.message || String(e)) }); }
  });

  app.post("/api/generate/deepfake", async (req, res) => {
    try {
      const empId = req.body.employee_id || 1;
      const difficulty = getAdaptiveDifficulty(empId);
      const isSynthetic = Math.random() > 0.35;
      const scripts = [
        "Hi team, this is a reminder that our quarterly review has been moved to 3 PM. Please update your calendars.",
        "This is a confidential message from the executive office. We need you to authorize the wire transfer immediately.",
        "Hey, just confirming our lunch meeting tomorrow at noon. Looking forward to it.",
        "Attention all employees. There has been a security breach in Sector 7. Report to safety zones immediately.",
        "I'm calling from IT regarding the system migration this weekend. We'll need your login credentials to ensure a smooth transition.",
      ];
      const script = scripts[Math.floor(Math.random()*scripts.length)];
      const voices = ["Charon","Kore","Fenrir","Aoede","Puck"];
      let audioBase64 = null;
      try {
        audioBase64 = await callGeminiTTS(script, isSynthetic ? voices[Math.floor(Math.random()*voices.length)] : "Aoede");
      } catch { return res.status(500).json({ error: "Audio generation failed" }); }
      const simInfo = db.prepare("INSERT INTO simulations (type, difficulty, content) VALUES (?, ?, ?)").run("deepfake", difficulty, JSON.stringify({ script, isSynthetic }));
      const hints = difficulty <= 2
        ? ["Unusually consistent pitch", "No natural breathing sounds", "Emotion doesn't match urgency"]
        : difficulty <= 3 ? ["Pay attention to micro-pauses", "Listen for breathing patterns"]
        : ["Trust your instincts"];
      res.json({ audioBase64, isSynthetic, script, contextHints: hints, simulation_id: simInfo.lastInsertRowid, difficulty });
    } catch (e: any) { console.error(e); res.status(500).json({ error: sanitizeGeminiError(e?.message || String(e)) }); }
  });

  app.post("/api/analyze/phone-engagement", async (req, res) => {
    try {
      const { transcript, scenario, attacker_script } = req.body;
      const userSaid = (transcript || "").trim();
      if (!userSaid) {
        return res.json({ correct: true, score: 100, feedback: "You hung up without engaging. The best response to a suspected vishing call is to end it immediately.", missedFlags: [], correctFlags: ["Ended call without engaging"] });
      }
      const prompt = `You are a vishing (voice phishing) security trainer. The employee received a suspicious call. Call scenario: ${scenario}. Attacker script (what the caller said): ${(attacker_script || "").slice(0, 1500)}. The employee responded with: "${userSaid}". They then ended the call.
Assess: Did the employee engage in conversation (answer questions, give info, or continue talking) instead of hanging up immediately? If they engaged at all, that was the wrong decision. Return JSON with: correct (false if they engaged), score (0-100; 100 only if they said nothing substantive or hung up immediately), feedback (2-4 sentences: explain why engaging was wrong and that they should hang up immediately next time), missedFlags (array of what they did wrong, e.g. "Engaged in conversation"), correctFlags (array, empty if they engaged).`;
      const text = await callGemini("gemini-2.5-flash", prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            correct: { type: "BOOLEAN" },
            score: { type: "NUMBER" },
            feedback: { type: "STRING" },
            missedFlags: { type: "ARRAY", items: { type: "STRING" } },
            correctFlags: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["correct", "score", "feedback", "missedFlags", "correctFlags"],
        },
      });
      const out = JSON.parse(text);
      res.json(out);
    } catch (e: any) {
      res.status(500).json({ error: sanitizeGeminiError(e?.message || String(e)) });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { simulation_content, user_flags, sim_type } = req.body;
      const flags = Array.isArray(user_flags) ? user_flags : [];
      // Strip huge fields (e.g. audioBase64) so prompt stays within token limits
      const content = simulation_content && typeof simulation_content === "object"
        ? (() => {
            const { audioBase64, ...rest } = simulation_content;
            return rest;
          })()
        : simulation_content;
      const prompt = `You are an expert cybersecurity analyst grading threat detection.
Type: ${sim_type || "email"}. Content: ${JSON.stringify(content)}. User flags: ${flags.join(", ") || "(none)"}.
Score 0-100 based on accuracy. List correct and missed flags. Give 2-3 sentence actionable feedback. Suggest one skill to improve.`;
      const text = await callGemini("gemini-2.5-flash", prompt, {
        responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: {
          score: { type: "NUMBER" }, missedFlags: { type: "ARRAY", items: { type: "STRING" } },
          correctFlags: { type: "ARRAY", items: { type: "STRING" } },
          feedback: { type: "STRING" }, skillToImprove: { type: "STRING" },
        }, required: ["score","missedFlags","correctFlags","feedback"] },
      });
      res.json(JSON.parse(text));
    } catch (e: any) { res.status(500).json({ error: sanitizeGeminiError(e?.message || String(e)) }); }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, context } = req.body;
      const sys = `You are PhisherBot, a cybersecurity training AI. Be concise (2-4 sentences). Give actionable advice.${context ? ` Current simulation context: ${context}` : ""}`;
      const text = await callGemini("gemini-2.5-flash", message, { systemInstruction: sys });
      res.json({ response: text });
    } catch (e: any) { res.status(500).json({ error: sanitizeGeminiError(e?.message || String(e)) }); }
  });

  // ── RESULTS ──
  app.post("/api/results", (req, res) => {
    const { employee_id=1, simulation_id, campaign_id, sim_type="email", is_correct, score=0, response_time_ms, difficulty=1, flags_identified, flags_missed, feedback } = req.body;
    let simId = simulation_id;
    if (!simId) { simId = db.prepare("INSERT INTO simulations (type, difficulty) VALUES (?, ?)").run(sim_type, difficulty).lastInsertRowid; }
    const info = db.prepare(`INSERT INTO results (employee_id,simulation_id,campaign_id,sim_type,is_correct,score,response_time_ms,difficulty,flags_identified,flags_missed,feedback) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(employee_id, simId, campaign_id||null, sim_type, is_correct?1:0, score, response_time_ms||0, difficulty, flags_identified?JSON.stringify(flags_identified):null, flags_missed?JSON.stringify(flags_missed):null, feedback||"");
    const xpResult = awardXP(employee_id, score, difficulty, !!is_correct);
    res.json({ id: info.lastInsertRowid, ...xpResult });
  });

  // ── STATS ──
  app.get("/api/stats", (_r, res) => {
    const stats = db.prepare(`SELECT COUNT(*) as total_simulations, SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) as correct_count, AVG(response_time_ms) as avg_response_time, AVG(score) as avg_score FROM results WHERE employee_id=1`).get();
    const emp = db.prepare("SELECT security_score, xp, level, current_streak, best_streak, simulations_completed FROM employees WHERE id=1").get();
    const recent = db.prepare(`SELECT score, sim_type, difficulty, created_at FROM results WHERE employee_id=1 ORDER BY created_at DESC LIMIT 10`).all();
    res.json({ ...stats, ...emp, recentScores: recent });
  });

  // ── ANALYTICS ──
  app.get("/api/analytics/timeline", (req, res) => {
    res.json(db.prepare(`SELECT DATE(created_at) as date, COUNT(*) as attempts, AVG(score) as avg_score, SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) as correct, AVG(response_time_ms) as avg_time FROM results WHERE employee_id=? GROUP BY DATE(created_at) ORDER BY date ASC LIMIT 30`).all(req.query.employee_id||1));
  });
  app.get("/api/analytics/by-type", (req, res) => {
    res.json(db.prepare(`SELECT sim_type, COUNT(*) as attempts, AVG(score) as avg_score, SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) as correct FROM results WHERE employee_id=? GROUP BY sim_type`).all(req.query.employee_id||1));
  });
  app.get("/api/analytics/difficulty-curve", (req, res) => {
    res.json(db.prepare(`SELECT difficulty, AVG(score) as avg_score, COUNT(*) as attempts FROM results WHERE employee_id=? GROUP BY difficulty ORDER BY difficulty`).all(req.query.employee_id||1));
  });
  app.get("/api/analytics/org-leaderboard", (_r, res) => {
    res.json(db.prepare(`SELECT e.name, e.security_score, e.xp, e.level, e.current_streak, e.best_streak, d.name as dept_name, COUNT(r.id) as total_sims, AVG(r.score) as avg_score FROM employees e LEFT JOIN departments d ON e.dept_id=d.id LEFT JOIN results r ON e.id=r.employee_id GROUP BY e.id ORDER BY e.xp DESC`).all());
  });

  app.get("/api/reports", (_r, res) => {
    res.json(db.prepare(`SELECT r.id, r.is_correct, r.score, r.response_time_ms, r.difficulty, r.feedback, r.created_at, r.sim_type, r.flags_identified, r.flags_missed FROM results r WHERE r.employee_id=1 ORDER BY r.created_at DESC LIMIT 30`).all());
  });

  // ── ADMIN ──
  app.get("/api/admin/overview", (_r, res) => {
    const stats = db.prepare(`SELECT COUNT(*) as total_sims, SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) as total_reports, SUM(CASE WHEN is_correct=0 THEN 1 ELSE 0 END) as total_compromises, AVG(score) as org_avg_score, AVG(response_time_ms) as org_avg_time FROM results`).get();
    const riskByType = db.prepare(`SELECT sim_type, COUNT(*) as total, AVG(score) as avg_score, SUM(CASE WHEN is_correct=0 THEN 1 ELSE 0 END)*100.0/COUNT(*) as fail_rate FROM results GROUP BY sim_type`).all();
    const trendData = db.prepare(`SELECT DATE(created_at) as date, AVG(score) as avg_score, COUNT(*) as volume FROM results GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 14`).all();
    res.json({ ...stats, riskByType, trendData });
  });
  app.get("/api/admin/departments", (_r, res) => {
    res.json(db.prepare(`SELECT d.*, (SELECT COUNT(*) FROM employees e WHERE e.dept_id=d.id) as employee_count, (SELECT AVG(security_score) FROM employees e WHERE e.dept_id=d.id) as avg_score, (SELECT COUNT(*) FROM results r JOIN employees e ON r.employee_id=e.id WHERE e.dept_id=d.id) as total_sims FROM departments d`).all());
  });
  app.get("/api/admin/campaigns", (_r, res) => {
    res.json(db.prepare(`SELECT c.*, d.name as dept_name, (SELECT COUNT(*) FROM results r WHERE r.campaign_id=c.id) as response_count FROM campaigns c JOIN departments d ON c.target_dept_id=d.id ORDER BY c.launched_at DESC`).all());
  });
  app.post("/api/admin/campaigns", (req, res) => {
    const { name, target_dept_id, sim_type } = req.body;
    res.json({ id: db.prepare("INSERT INTO campaigns (name,target_dept_id,sim_type,status) VALUES (?,?,?,'active')").run(name, target_dept_id, sim_type).lastInsertRowid });
  });
  app.delete("/api/admin/campaigns/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ error: "Invalid campaign id" });
      db.prepare("DELETE FROM campaigns WHERE id = ?").run(id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Delete failed" });
    }
  });

  // ── THREAT INTEL FEED ──
  app.get("/api/threat-feed", (_r, res) => {
    res.json([
      { type: "Spear Phishing", target: "Finance", severity: "critical", ts: new Date().toISOString(), desc: "CEO impersonation targeting CFO for wire transfer" },
      { type: "Voice Clone", target: "HR", severity: "high", ts: new Date(Date.now()-3600000).toISOString(), desc: "Synthetic voice impersonating CHRO requesting SSNs" },
      { type: "Credential Harvest", target: "Engineering", severity: "medium", ts: new Date(Date.now()-7200000).toISOString(), desc: "Fake SSO login page mimicking internal portal" },
      { type: "BEC Attack", target: "Sales", severity: "high", ts: new Date(Date.now()-10800000).toISOString(), desc: "Vendor payment redirect via compromised thread" },
    ]);
  });

  // ── Vite ──
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_r, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🛡️ PhishGuard on http://localhost:${PORT}`);
    console.log(GEMINI_KEY ? `   Gemini key in use: ...${GEMINI_KEY.slice(-4)}` : "   Gemini key not set (set GEMINI_API_KEY in .env or .env.local for AI features).");
    verifyGeminiKey();
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n❌ Port ${PORT} is already in use. Stop the other process first:`);
      console.error(`   Windows: netstat -ano | findstr :${PORT}  then  taskkill /PID <pid> /F`);
      console.error(`   Or close the other terminal running npm run dev.\n`);
      process.exit(1);
    }
    throw err;
  });
}

startServer();
