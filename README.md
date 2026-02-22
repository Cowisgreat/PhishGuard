<div align="center">
  <h1>🛡️ PHISHGUARD</h1>
  <h3>AI-Driven Phishing & Deepfake Simulation for Employee Training</h3>
  <p><em>Learn to spot digital deception through realistic AI-generated attacks</em></p>
  
  <p>
    <img src="https://img.shields.io/badge/Gemini_2.0_Flash-AI_Generation-blue" />
    <img src="https://img.shields.io/badge/Gemini_TTS-Voice_Cloning-purple" />
    <img src="https://img.shields.io/badge/React_19-Frontend-61DAFB" />
    <img src="https://img.shields.io/badge/SQLite-Analytics-003B57" />
  </p>
</div>

---

## 🎯 The Problem

**$10.5 billion** was lost to phishing in 2024. Current corporate security training is broken — generic videos and outdated multiple-choice quizzes don't prepare employees for sophisticated AI-powered attacks. As generative AI makes phishing, deepfakes, and vishing (voice phishing) trivially easy to create, **defenders need AI-powered training too.**

## 💡 Our Solution

PhishGuard uses **real-time generative AI** to create unique, never-before-seen attack simulations that adapt to each employee's skill level. Every phishing email, deepfake audio clip, and social engineering phone call is dynamically generated — no two sessions are alike.

### Three Attack Simulation Modes

| Mode | AI Model | What It Does |
|------|----------|-------------|
| **📧 Phishing Simulator** | Gemini 2.0 Flash | Generates realistic phishing emails with embedded red flags scaled to difficulty |
| **🎤 Deepfake Lab** | Gemini 2.5 Flash TTS | Creates synthetic voice clips; users must classify as real vs AI-generated |
| **📞 Vishing Simulator** | Gemini 2.0 Flash + TTS | Generates social engineering phone scripts with AI voice acting |

### Key Technical Features

- **Adaptive Difficulty Engine** — Analyzes the user's last 5 scores and automatically scales attack sophistication (1–5). High performers get nation-state-level spear phishing; struggling users get clearer red flags.
- **XP & Progression System** — Points scale with difficulty × score. Streak bonuses. Level-ups. Gamification that actually works.
- **Real-Time Response Tracking** — Millisecond-precision timer measures how quickly employees identify threats.
- **Server-Side AI Architecture** — All Gemini API calls happen server-side. The API key never touches the browser. This is production-grade security, not a demo hack.
- **Full Analytics Dashboard** — Real data from SQLite, visualized with Recharts. Score timelines, performance by attack type, organizational leaderboards, departmental risk heatmaps.
- **SOC Admin Panel** — Campaign management, department-level risk monitoring, fail-rate analytics by attack vector.
- **Context-Aware Security Chatbot** — PhisherBot knows what simulation you're in and gives targeted advice without spoiling answers.
- **Live Threat Intelligence Feed** — Real-time threat activity simulation for the SOC dashboard.

## 🏗️ Architecture

```
┌──────────────┐     ┌───────────────────────────────┐     ┌──────────────┐
│   React 19   │────▶│     Express API Server         │────▶│  Gemini API  │
│  + Recharts  │     │  (all AI calls server-side)    │     │  2.0 Flash   │
│  + Motion    │◀────│  + SQLite (analytics/scores)   │     │  2.5 TTS     │
│  + Tailwind  │     │  + Adaptive Difficulty Engine   │     │  Flash Lite  │
└──────────────┘     └───────────────────────────────┘     └──────────────┘
```

**Why this architecture matters for SafetyKit:**
1. API keys are server-side only — a phishing training tool shouldn't itself be vulnerable
2. All results are persisted — admins can track organizational risk over time
3. Adaptive difficulty means training stays relevant as employees improve
4. Multiple AI models are used strategically: Flash for generation, Flash Lite for chat, TTS for deepfakes

## 🚀 How to Run

**Requirements:** Node.js 18+ (LTS recommended).

```bash
# 1. Go to the project folder
cd phishguard

# 2. Install dependencies
npm install

# 3. Start the app
npm run dev
```

Then open **http://localhost:3000** in your browser.

The app uses the Gemini API; set `GEMINI_API_KEY` in `.env` or `.env.local` (see `.env.example`). Get a free key at https://aistudio.google.com/apikey.

**Other commands:**
- `npm run build` — build for production (output in `dist/`)
- `npm run preview` — serve the production build locally (run after `npm run build`)
- `npm run lint` — type-check the project
- `npm run clean` — remove the `dist/` folder

## 📊 Tracks & Challenges

- **Best AI for Human Safety (SafetyKit)** — PhishGuard directly prevents harm by training humans to detect AI-powered scams, fraud, impersonation, deception, and social engineering
- **Finance Track** — Phishing is the #1 attack vector against financial institutions. This tool directly reduces organizational risk.
- **Best Overall** — Full-stack AI application with adaptive difficulty, real analytics, multi-model architecture, and production-grade security

## 🧠 Technical Highlights for Judges

1. **Not a wrapper** — We use 3 different Gemini models strategically (Flash for generation, Flash Lite for low-latency chat, Flash TTS for deepfakes)
2. **Real adaptive difficulty** — SQL-backed scoring algorithm that queries last 5 results
3. **Zero hardcoded data** — Every chart, every stat, every leaderboard position comes from the SQLite database
4. **Production security** — API key isolation, input validation, proper error handling
5. **Historical data seeding** — 14 days of realistic training data so the analytics dashboard is impressive from the first demo

## 👥 Team

Built at Hacklytics 2026, Georgia Tech.
