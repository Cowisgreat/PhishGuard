<div align="center">
  <h1>🛡️ PhishGuard</h1>
  <h3>AI-Driven Phishing & Deepfake Simulation for Modern Security Training</h3>
  <p><em>AI attacks. You defend.</em></p>

  <p>
    <img src="https://img.shields.io/badge/Gemini-2.0_Flash-blue" />
    <img src="https://img.shields.io/badge/Gemini-2.5_TTS-purple" />
    <img src="https://img.shields.io/badge/React-19-61DAFB" />
    <img src="https://img.shields.io/badge/Express-API-black" />
    <img src="https://img.shields.io/badge/SQLite-Analytics-003B57" />
    <img src="https://img.shields.io/badge/Deployed-Render-46E3B7" />
  </p>
</div>

---

## 🎯 The Problem

Most corporate security training gets clicked through.

Employees mute the video, skip ahead, pass the quiz, and move on. But real attacks don’t look like training slides. They’re contextual, urgent, and increasingly powered by generative AI.

In 2024 alone, phishing caused over **$10.5 billion in losses**. As attackers use AI to scale deception, static compliance training is falling behind.

If AI is powering attacks, training should use AI too.

---

## 💡 The Solution

PhishGuard is an AI-powered security training platform that generates realistic, dynamic attack simulations in real time.

Instead of memorizing “red flags,” users:

- Inspect AI-generated phishing emails  
- Respond to simulated vishing calls  
- Classify deepfake voice clips  
- Make real security decisions  
- Receive instant AI-generated coaching  

Every scenario is unique. No templates. No repetition. No checkbox training.

It’s not a quiz — it’s practice.

---

## 🔥 Simulation Modes

| Mode | AI Used | Description |
|------|---------|-------------|
| 📧 Phishing Simulator | Gemini 2.0 Flash | Generates realistic phishing emails with adaptive difficulty |
| 🎤 Deepfake Lab | Gemini 2.5 Flash TTS | Creates synthetic voice clips for real-vs-AI classification |
| 📞 Vishing Simulator | Gemini 2.0 Flash + TTS | Generates AI voice-acted social engineering calls |

---

## 🧠 Intelligent Features

### Adaptive Difficulty Engine

We analyze the user’s last 5 scores and dynamically scale attack sophistication (1–5).

\[
\text{Difficulty}_{next} = f(\text{average of last 5 scores})
\]

High performers get advanced spear phishing.  
Struggling users receive clearer educational signals.

Training evolves as users improve.

---

### Gamified Progression

- XP = Difficulty × Score  
- Streak bonuses  
- Level progression  
- Real-time response tracking  

Security training becomes engaging instead of something employees rush through.

---

## 🏗️ Architecture

**Frontend:** React 19 + Tailwind + Recharts  
**Backend:** Express.js API  
**AI:** Gemini 2.0 Flash, Gemini Flash Lite, Gemini 2.5 Flash TTS  
**Database:** SQLite (analytics + scoring)  
**Deployment:** Render  

All Gemini API calls happen **server-side**.  
API keys never reach the client — production-grade security.

---

## 🚀 Running Locally

**Requirements:** Node.js 18+

```bash
npm install
npm run dev
