import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Mail, Video, BarChart3, AlertTriangle, CheckCircle2, XCircle,
  ChevronRight, User, Zap, Lock, Eye, Flag, Info, Phone,
  PhoneOff, MicOff, Mic, Volume2, TrendingUp, Clock, Target, Flame,
  Crosshair, Brain, Siren, Trash2
} from 'lucide-react';
import { cn } from './lib/utils';
import {
  generatePhishingEmail, generatePhoneSimulation, generateDeepfake,
  analyzeSimulation, analyzePhoneEngagement, sendChatMessage, saveResult, playAudio,
  fetchStats as apiFetchStats, fetchReports as apiFetchReports,
  fetchTimeline, fetchByType, fetchLeaderboard, fetchThreatFeed,
  fetchAdminOverview, fetchAdminDepartments, fetchAdminCampaigns, createCampaign, deleteCampaign,
} from './services/api';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';
import Markdown from 'react-markdown';

// ── Types ──
type Role = 'employee' | 'admin';
type View = 'dashboard' | 'email-sim' | 'deepfake-sim' | 'phone-sim' | 'analytics' | 'reports' | 'admin-dashboard' | 'admin-campaigns' | 'admin-departments';
interface PhishingEmail { subject: string; senderName: string; senderEmail: string; body: string; redFlags: string[]; explanation: string; simulation_id?: number; difficulty?: number; }
interface PhoneSim { callerName?: string; callerRole?: string; scenario: string; attackerScript: string; redFlags: string[]; explanation: string; audioBase64: string; simulation_id?: number; difficulty?: number; }
interface DeepfakeSim { audioBase64: string; isSynthetic: boolean; script: string; contextHints: string[]; simulation_id?: number; difficulty?: number; }
interface Report { id: number; is_correct: boolean; score: number; response_time_ms: number; difficulty: number; feedback: string; created_at: string; sim_type: string; }

// ── Small Components ──
const SidebarItem = ({ icon: Icon, label, active, onClick, badge }: { icon: any; label: string; active: boolean; onClick: () => void; badge?: string }) => (
  <button onClick={onClick} className={cn("flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all duration-200", active ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/20" : "text-zinc-400 hover:text-white hover:bg-white/5")}>
    <div className="flex items-center gap-3"><Icon size={20} /><span className="font-medium">{label}</span></div>
    {badge && <span className="text-[10px] font-bold bg-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded uppercase">{badge}</span>}
  </button>
);

const StatCard = ({ label, value, icon: Icon, trend, sub }: { label: string; value: string | number; icon: any; trend?: string; sub?: string }) => (
  <div className="p-6 rounded-2xl bg-brand-surface border border-brand-border group hover:border-brand-primary/30 transition-all">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 rounded-lg bg-white/5 group-hover:bg-brand-primary/10 transition-colors"><Icon size={24} className="text-zinc-400 group-hover:text-brand-primary" /></div>
      {trend && <span className="text-xs font-medium text-brand-primary bg-brand-primary/10 px-2 py-1 rounded-full">{trend}</span>}
    </div>
    <div className="text-2xl font-bold font-display mb-1">{value}</div>
    <div className="text-sm text-zinc-500">{label}</div>
    {sub && <div className="text-[10px] text-zinc-600 mt-1">{sub}</div>}
  </div>
);

const DiffBadge = ({ level }: { level: number }) => {
  const c = ['bg-emerald-500/20 text-emerald-400','bg-emerald-500/20 text-emerald-400','bg-yellow-500/20 text-yellow-400','bg-orange-500/20 text-orange-400','bg-red-500/20 text-red-400'];
  const l = ['Trivial','Easy','Medium','Hard','Expert'];
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase", c[(level||1)-1])}>{l[(level||1)-1]} (Lv.{level})</span>;
};

const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (<div className="bg-zinc-900 border border-brand-border rounded-lg px-3 py-2 text-xs shadow-xl"><div className="text-zinc-400 mb-1">{label}</div>{payload.map((p: any) => (<div key={p.dataKey} className="flex gap-2"><span style={{color:p.color}}>{p.name}:</span><span className="font-bold text-white">{typeof p.value==='number'?Math.round(p.value):p.value}</span></div>))}</div>);
};

const TimerDisplay = ({ start }: { start: number }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const i = setInterval(() => setElapsed(Math.floor((Date.now()-start)/1000)), 100); return () => clearInterval(i); }, [start]);
  return <span>{String(Math.floor(elapsed/60)).padStart(2,'0')}:{String(elapsed%60).padStart(2,'0')}</span>;
};

const FeedbackCard = ({ feedback, onRetry }: { feedback: any; onRetry: () => void }) => (
  <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className={cn("p-6 rounded-3xl border", feedback.score > 60 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20")}>
    <div className="flex items-center justify-between mb-4"><h4 className="font-bold">Results</h4><div className={cn("text-2xl font-bold font-display", feedback.score > 60 ? "text-emerald-500" : "text-red-500")}>{Math.round(feedback.score)}%</div></div>
    <p className="text-sm text-zinc-300 mb-4">{feedback.feedback}</p>
    {feedback.correctFlags?.length > 0 && (<div className="mb-3"><div className="text-[10px] font-bold uppercase text-zinc-500 mb-2">Correctly Identified</div><div className="flex flex-wrap gap-2">{feedback.correctFlags.map((f:string) => <span key={f} className="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">{f}</span>)}</div></div>)}
    {feedback.missedFlags?.length > 0 && (<div className="mb-3"><div className="text-[10px] font-bold uppercase text-zinc-500 mb-2">Missed</div><div className="flex flex-wrap gap-2">{feedback.missedFlags.map((f:string) => <span key={f} className="px-2 py-1 rounded-md bg-red-500/20 text-red-400 text-[10px] font-bold">{f}</span>)}</div></div>)}
    {feedback.skillToImprove && <div className="text-xs text-zinc-500 mt-2">💡 Focus on: <span className="text-brand-primary">{feedback.skillToImprove}</span></div>}
    <button onClick={onRetry} className="w-full mt-4 py-2 text-sm font-bold text-white border border-white/10 rounded-lg hover:bg-white/5">Try Another</button>
  </motion.div>
);

// ══════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════
export default function App() {
  const [role, setRole] = useState<Role>('employee');
  const [view, setView] = useState<View>('dashboard');
  const [emailSim, setEmailSim] = useState<PhishingEmail | null>(null);
  const [phoneSim, setPhoneSim] = useState<PhoneSim | null>(null);
  const [deepfakeSim, setDeepfakeSim] = useState<DeepfakeSim | null>(null);
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callTranscript, setCallTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [simStartTime, setSimStartTime] = useState(0);
  const [xpToast, setXpToast] = useState<{xp:number;streak:number}|null>(null);
  const [chatMsg, setChatMsg] = useState('');
  const [chatHistory, setChatHistory] = useState<{role:'user'|'ai';text:string}[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [stats, setStats] = useState<any>({});
  const [reports, setReports] = useState<Report[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [byType, setByType] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [threatFeed, setThreatFeed] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>({});
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const callRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const phoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const autoHangUpRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isCalling) { callRef.current = setInterval(() => setCallDuration(d => d+1), 1000); }
    else { clearInterval(callRef.current); }
    return () => clearInterval(callRef.current);
  }, [isCalling]);

  // Voice input during phone call (Speech Recognition)
  useEffect(() => {
    if (!isCalling || !isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      let added = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) added += (added ? " " : "") + r[r.length - 1].transcript;
      }
      if (added) setCallTranscript(prev => (prev ? prev + " " + added : added));
    };
    rec.start();
    recognitionRef.current = rec;
    return () => { try { rec.stop(); } catch {} recognitionRef.current = null; };
  }, [isCalling, isListening]);

  const loadEmp = useCallback(async () => {
    try { const [s,r,tl,bt,lb,tf] = await Promise.all([apiFetchStats(),apiFetchReports(),fetchTimeline(),fetchByType(),fetchLeaderboard(),fetchThreatFeed()]); setStats(s);setReports(r);setTimeline(tl);setByType(bt);setLeaderboard(lb);setThreatFeed(tf); } catch(e){console.error(e);}
  }, []);
  const loadAdmin = useCallback(async () => {
    try { const [o,c,d] = await Promise.all([fetchAdminOverview(),fetchAdminCampaigns(),fetchAdminDepartments()]); setAdminStats(o);setCampaigns(c);setDepartments(d); } catch(e){console.error(e);}
  }, []);
  useEffect(() => { role==='employee' ? loadEmp() : loadAdmin(); }, [role,loadEmp,loadAdmin]);

  const hangUpPhone = useCallback(async () => {
    if (autoHangUpRef.current) { clearTimeout(autoHangUpRef.current); autoHangUpRef.current = null; }
    setIsCalling(false);
    setIsListening(false);
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
    if (phoneAudioRef.current) {
      phoneAudioRef.current.pause();
      phoneAudioRef.current.currentTime = 0;
      phoneAudioRef.current = null;
    }
    setIsPlaying(false);
    const transcript = callTranscript.trim();
    setCallTranscript("");
    if (!phoneSim) return;
    const rt = Date.now() - simStartTime;
    const minimalResponse = transcript.length < 12 || /^(hi|hello|hey|yes|no|ok|what|who|huh)\s*$/i.test(transcript);
    if (minimalResponse) {
      setFeedback({
        score: 100,
        feedback: "You hung up without engaging. The best response to a suspected vishing call is to end it immediately. Do not answer questions or give any information.",
        correctFlags: ["Ended call without engaging"],
        missedFlags: [],
      });
      await saveResult({ simulation_id: phoneSim.simulation_id, sim_type: "phone", is_correct: true, score: 100, response_time_ms: rt, difficulty: phoneSim.difficulty || 2, feedback: "Hung up immediately." });
      setXpToast({ xp: 50, streak: 1 }); setTimeout(() => setXpToast(null), 3000);
      loadEmp();
      return;
    }
    setLoading(true);
    try {
      const r = await analyzePhoneEngagement(transcript, phoneSim.scenario, phoneSim.attackerScript || "");
      setFeedback({ ...r, correctFlags: r.correctFlags || [], missedFlags: r.missedFlags || [] });
      const sr = await saveResult({ simulation_id: phoneSim.simulation_id, sim_type: "phone", is_correct: !!r.correct, score: Math.round(r.score || 0), response_time_ms: rt, difficulty: phoneSim.difficulty || 2, flags_identified: r.correctFlags, flags_missed: r.missedFlags, feedback: r.feedback });
      setXpToast({ xp: sr.xp, streak: sr.streak }); setTimeout(() => setXpToast(null), 3000);
      loadEmp();
    } catch (e: any) {
      alert("Analysis failed: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }, [callTranscript, phoneSim, simStartTime, loadEmp]);

  // Auto end call ~2.5s after user speaks, then show what they did wrong
  useEffect(() => {
    if (!isCalling || callTranscript.trim().length < 10) return;
    if (autoHangUpRef.current) clearTimeout(autoHangUpRef.current);
    autoHangUpRef.current = setTimeout(() => {
      autoHangUpRef.current = null;
      hangUpPhone();
    }, 2500);
    return () => {
      if (autoHangUpRef.current) { clearTimeout(autoHangUpRef.current); autoHangUpRef.current = null; }
    };
  }, [isCalling, callTranscript, hangUpPhone]);

  // ── Handlers ──
  const startEmailSim = async () => { setLoading(true);setFeedback(null);setSelectedFlags([]); try{const e=await generatePhishingEmail();setEmailSim(e);setView('email-sim');setSimStartTime(Date.now());}catch(e:any){console.error(e);alert("Generation failed: "+(e?.message||String(e)));}finally{setLoading(false);} };
  const startPhoneSim = async () => { setLoading(true);setFeedback(null);setSelectedFlags([]); try{const s=await generatePhoneSimulation();setPhoneSim(s);setView('phone-sim');setSimStartTime(Date.now());}catch(e:any){console.error(e);alert("Generation failed: "+(e?.message||String(e)));}finally{setLoading(false);} };
  const startDeepfakeSim = async () => { setLoading(true);setFeedback(null); try{const s=await generateDeepfake();setDeepfakeSim(s);setView('deepfake-sim');setSimStartTime(Date.now());}catch(e:any){console.error(e);alert("Generation failed: "+(e?.message||String(e)));}finally{setLoading(false);} };
  const doPlay = (b64?:string) => { if(!b64)return; const a=playAudio(b64); if(a){setIsPlaying(true);a.onended=()=>setIsPlaying(false);} };

  const submitAnalysis = async (type:'email'|'phone') => {
    const sim = type==='email'?emailSim:phoneSim; if(!sim||selectedFlags.length===0)return;
    setLoading(true);
    try {
      const rt=Date.now()-simStartTime;
      const r=await analyzeSimulation(sim,selectedFlags,type);
      setFeedback(r);
      const sr=await saveResult({simulation_id:sim.simulation_id,sim_type:type,is_correct:r.score>60,score:Math.round(r.score),response_time_ms:rt,difficulty:sim.difficulty||2,flags_identified:r.correctFlags,flags_missed:r.missedFlags,feedback:r.feedback});
      setXpToast({xp:sr.xp,streak:sr.streak}); setTimeout(()=>setXpToast(null),3000); loadEmp();
    } catch(e:any){console.error(e);alert("Analysis failed: "+(e?.message||String(e)));} finally{setLoading(false);}
  };

  const handleDeepfakeGuess = async (guess:'authentic'|'synthetic') => {
    if(!deepfakeSim)return; const rt=Date.now()-simStartTime;
    const ok=(guess==='synthetic')===deepfakeSim.isSynthetic; const sc=ok?100:0;
    const fb=ok ? "Correct! "+(deepfakeSim.isSynthetic?"Synthetic patterns include consistent pitch and absent breathing.":"This was genuine human speech.") : "Incorrect. "+(deepfakeSim.isSynthetic?"This was AI-generated.":"This was authentic speech.");
    setFeedback({score:sc,feedback:fb,correctFlags:ok?["Correct Classification"]:[],missedFlags:ok?[]:["Misclassified Audio"]});
    const sr=await saveResult({simulation_id:deepfakeSim.simulation_id,sim_type:"deepfake",is_correct:ok,score:sc,response_time_ms:rt,difficulty:deepfakeSim.difficulty||2,feedback:fb});
    setXpToast({xp:sr.xp,streak:sr.streak}); setTimeout(()=>setXpToast(null),3000); loadEmp();
  };

  const handleChat = async () => {
    if(!chatMsg.trim()||chatLoading)return; const m=chatMsg;setChatMsg('');
    setChatHistory(h=>[...h,{role:'user',text:m}]); setChatLoading(true);
    try{const ctx=view==='email-sim'&&emailSim?`Email: ${emailSim.subject}`:view==='phone-sim'&&phoneSim?`Phone: ${phoneSim.scenario}`:undefined; const{response}=await sendChatMessage(m,ctx); setChatHistory(h=>[...h,{role:'ai',text:response||'No response'}]);}catch(e){console.error(e);}finally{setChatLoading(false);}
  };

  const det = stats.total_simulations>0 ? Math.round((stats.correct_count/stats.total_simulations)*100) : 0;
  const avgT = stats.avg_response_time ? `${Math.round(stats.avg_response_time/1000)}s` : '—';
  const xpProg = stats.xp ? (stats.xp%200)/200*100 : 0;
  const pathProg = Math.min(100,Math.round(((stats.simulations_completed||0)/10)*100));
  const lp = [
    {label:'Foundations',status:(stats.simulations_completed||0)>=1?'completed':'active',icon:Shield,action:()=>{setView('dashboard');}},
    {label:'Email Defense',status:(stats.simulations_completed||0)>=3?'completed':'active',icon:Mail,action:()=>startEmailSim()},
    {label:'Voice Verify',status:(stats.simulations_completed||0)>=6?'completed':'active',icon:Phone,action:()=>startPhoneSim()},
    {label:'Deepfake Pro',status:(stats.simulations_completed||0)>=10?'completed':'active',icon:Brain,action:()=>startDeepfakeSim()},
  ];
  const fmtC = (s:number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const flagsEmail = ['Suspicious Sender Address','Urgency / Threatening Language','Generic Greeting','Suspicious Links / URLs','Poor Grammar / Spelling','Requests Sensitive Info','Unusual Request','Mismatched Display Name'];
  const flagsPhone = ['Urgency / Panic','Request for Credentials','Unusual Caller ID','Pressure Tactics','Technical Jargon','Vague Identity','Emotional Manipulation','Callback Avoidance'];

  return (
    <div className="flex h-screen overflow-hidden bg-brand-bg selection:bg-brand-primary/30">
      <AnimatePresence>{xpToast&&(<motion.div initial={{opacity:0,y:-40,x:'-50%'}} animate={{opacity:1,y:0,x:'-50%'}} exit={{opacity:0,y:-40}} className="fixed top-6 left-1/2 z-50 px-6 py-3 rounded-2xl bg-brand-primary text-black font-bold shadow-[0_0_30px_rgba(0,255,65,0.5)] flex items-center gap-3"><Zap size={20}/>+{xpToast.xp} XP{xpToast.streak>1&&<span className="text-xs bg-black/20 px-2 py-0.5 rounded-full">{xpToast.streak}x Streak 🔥</span>}</motion.div>)}</AnimatePresence>

      {/* SIDEBAR */}
      <aside className="w-72 bg-brand-surface border-r border-brand-border flex flex-col p-6 shrink-0">
        <div className="flex items-center gap-3 mb-10"><div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center shadow-[0_0_20px_rgba(0,255,65,0.3)]"><Shield className="text-black" size={24}/></div><div><h1 className="text-xl font-bold font-display tracking-tighter">PHISHGUARD</h1><div className="text-[10px] font-bold text-brand-primary tracking-widest uppercase">Active Defense SOC</div></div></div>
        <div className="mb-8 p-1 bg-black/40 rounded-lg flex">
          <button onClick={()=>{setRole('employee');setView('dashboard');}} className={cn("flex-1 py-1.5 text-[10px] font-bold uppercase rounded transition-all",role==='employee'?"bg-brand-primary text-black":"text-zinc-500 hover:text-white")}>Employee</button>
          <button onClick={()=>{setRole('admin');setView('admin-dashboard');}} className={cn("flex-1 py-1.5 text-[10px] font-bold uppercase rounded transition-all",role==='admin'?"bg-brand-primary text-black":"text-zinc-500 hover:text-white")}>Admin/SOC</button>
        </div>
        <nav className="flex-1 space-y-2">
          {role==='employee'?(<>
            <SidebarItem icon={Shield} label="Dashboard" active={view==='dashboard'} onClick={()=>setView('dashboard')}/>
            <SidebarItem icon={Mail} label="Email Sim" active={view==='email-sim'} onClick={()=>{setView('email-sim');if(!emailSim)startEmailSim();}} badge="Live"/>
            <SidebarItem icon={Video} label="Deepfake Lab" active={view==='deepfake-sim'} onClick={()=>{setView('deepfake-sim');if(!deepfakeSim)startDeepfakeSim();}} badge="AI"/>
            <SidebarItem icon={Phone} label="Phone Sim" active={view==='phone-sim'} onClick={()=>{setView('phone-sim');if(!phoneSim)startPhoneSim();}} badge="TTS"/>
            <SidebarItem icon={BarChart3} label="Analytics" active={view==='analytics'} onClick={()=>{setView('analytics');loadEmp();}}/>
            <SidebarItem icon={Flag} label="Reports" active={view==='reports'} onClick={()=>{setView('reports');apiFetchReports().then(setReports);}}/>
          </>):(<>
            <SidebarItem icon={BarChart3} label="SOC Overview" active={view==='admin-dashboard'} onClick={()=>setView('admin-dashboard')}/>
            <SidebarItem icon={Zap} label="Campaigns" active={view==='admin-campaigns'} onClick={()=>setView('admin-campaigns')}/>
            <SidebarItem icon={User} label="Departments" active={view==='admin-departments'} onClick={()=>setView('admin-departments')}/>
          </>)}
        </nav>
        <div className="mb-6 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-red-400 uppercase flex items-center gap-1.5"><Siren size={12}/>Threat Feed</span><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_5px_red]"/></div>
          {threatFeed.slice(0,2).map((t,i)=>(<div key={i} className="text-[10px] text-zinc-500 mt-1 truncate"><span className={cn("font-bold",t.severity==='critical'?'text-red-400':'text-yellow-400')}>{t.type}</span> → {t.target}</div>))}
        </div>
        <div className="mt-auto p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3 mb-3"><div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center"><User size={16} className="text-brand-primary"/></div><div><div className="text-sm font-medium">Cyber Guard</div><div className="text-xs text-zinc-500">Level {stats.level||1} • {stats.xp||0} XP</div></div></div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden"><motion.div animate={{width:`${xpProg}%`}} className="h-full bg-brand-primary shadow-[0_0_10px_rgba(0,255,65,0.5)]"/></div>
          <div className="flex justify-between mt-2 text-[10px] text-zinc-600"><span>{stats.current_streak||0} streak 🔥</span><span>Best: {stats.best_streak||0}</span></div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto relative cyber-grid">
        <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 bg-brand-bg/80 backdrop-blur-md border-b border-brand-border">
          <div className="flex items-center gap-4"><h2 className="text-lg font-semibold capitalize">{view.replace(/-/g,' ')}</h2><div className="h-4 w-px bg-brand-border"/><div className="flex items-center gap-2 text-xs text-zinc-500"><span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"/>Online</div></div>
          {view.includes('sim')&&simStartTime>0&&!feedback&&(<div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-mono text-zinc-400"><Clock size={14}/><TimerDisplay start={simStartTime}/></div>)}
        </header>
        <div className="p-8 max-w-6xl mx-auto"><AnimatePresence mode="wait">

        {/* ═══ DASHBOARD ═══ */}
        {view==='dashboard'&&(<motion.div key="d" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-8">
          <div className="p-8 rounded-3xl bg-gradient-to-br from-brand-primary/20 to-transparent border border-brand-primary/20 relative overflow-hidden">
            <div className="relative z-10"><h2 className="text-4xl font-bold font-display mb-2">Active Defense Training</h2><p className="text-zinc-400 max-w-xl mb-6">Real-time AI-generated attacks. Detect, analyze, neutralize.</p>
              <div className="flex gap-4 flex-wrap"><button onClick={startEmailSim} disabled={loading} className="px-6 py-3 bg-brand-primary text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,255,65,0.4)] transition-all disabled:opacity-50">{loading?'Loading...':'Start Training'}</button><div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm"><Flame size={16} className="text-brand-primary"/>Adaptive Difficulty: <span className="text-brand-primary font-bold ml-1">Active</span></div></div></div>
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><Shield size={240}/></div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h3 className="text-xl font-bold font-display">Learning Path</h3><span className="text-sm text-brand-primary font-mono">{pathProg}%</span></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{lp.map(s=>(<button key={s.label} type="button" onClick={s.action} disabled={loading} className={cn("p-4 rounded-2xl border flex flex-col items-center text-center gap-3 transition-all cursor-pointer",s.status==='completed'?"bg-brand-primary/10 border-brand-primary/30 text-brand-primary hover:border-brand-primary/50":"bg-white/5 border-brand-primary/50 shadow-[0_0_15px_rgba(0,255,65,0.15)] hover:bg-white/10")}><div className={cn("w-10 h-10 rounded-full flex items-center justify-center",s.status==='completed'?"bg-brand-primary/10":"bg-brand-primary text-black")}><s.icon size={20}/></div><div className="text-xs font-bold uppercase tracking-tighter">{s.label}</div></button>))}</div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Simulations" value={stats.total_simulations||0} icon={Shield} trend={stats.current_streak>0?`${stats.current_streak}x streak`:undefined}/>
                <StatCard label="Detection Rate" value={`${det}%`} icon={Target} sub={`${stats.correct_count||0} correct`}/>
                <StatCard label="Avg. Response" value={avgT} icon={Clock}/>
              </div>
              {timeline.length>0&&(<div className="p-6 rounded-3xl bg-brand-surface border border-brand-border"><h3 className="text-lg font-bold font-display mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-brand-primary"/>Performance</h3><ResponsiveContainer width="100%" height={200}><AreaChart data={timeline}><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00FF41" stopOpacity={0.3}/><stop offset="100%" stopColor="#00FF41" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#262626"/><XAxis dataKey="date" tick={{fontSize:10,fill:'#666'}} tickFormatter={(v:string)=>v.slice(5)}/><YAxis domain={[0,100]} tick={{fontSize:10,fill:'#666'}}/><Tooltip content={<ChartTip/>}/><Area type="monotone" dataKey="avg_score" name="Score" stroke="#00FF41" fill="url(#sg)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div>)}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{[{t:'Phishing',d:'AI phishing emails',i:Mail,a:startEmailSim,c:'from-blue-500/10'},{t:'Deepfake',d:'Synthetic vs real audio',i:Video,a:startDeepfakeSim,c:'from-purple-500/10'},{t:'Vishing',d:'Social engineering calls',i:Phone,a:startPhoneSim,c:'from-orange-500/10'}].map(x=>(<div key={x.t} className={cn("p-6 rounded-3xl bg-gradient-to-br to-transparent border border-brand-border relative overflow-hidden group hover:border-brand-primary/30 transition-all",x.c)}><div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity"><x.i size={80}/></div><div className="relative z-10"><h3 className="text-lg font-bold font-display mb-2">{x.t}</h3><p className="text-zinc-500 text-sm mb-6">{x.d}</p><button onClick={x.a} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white font-bold rounded-lg hover:bg-brand-primary hover:text-black transition-all text-sm disabled:opacity-50">{loading?'...':'Launch'}<ChevronRight size={16}/></button></div></div>))}</div>
            </div>
            {/* Chat */}
            <div className="p-6 rounded-3xl bg-brand-surface border border-brand-border flex flex-col h-[600px]">
              <div className="flex items-center gap-2 mb-6"><div className="w-8 h-8 rounded-lg bg-brand-primary/20 flex items-center justify-center"><Brain size={18} className="text-brand-primary"/></div><h3 className="font-bold font-display">PhisherBot</h3></div>
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">{chatHistory.length===0&&<div className="text-center py-10"><Info size={24} className="text-zinc-700 mx-auto mb-3"/><p className="text-xs text-zinc-600">Ask about phishing, deepfakes, or your current sim.</p></div>}{chatHistory.map((m,i)=>(<div key={i} className={cn("p-3 rounded-2xl text-sm max-w-[85%]",m.role==='user'?"bg-brand-primary/10 border border-brand-primary/20 ml-auto text-brand-primary":"bg-white/5 border border-white/10 mr-auto text-zinc-300")}>{m.text}</div>))}{chatLoading&&<div className="bg-white/5 border border-white/10 p-3 rounded-2xl mr-auto flex gap-1"><span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"/><span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.2s]"/><span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.4s]"/></div>}</div>
              <div className="relative"><input value={chatMsg} onChange={e=>setChatMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleChat()} placeholder="Ask PhisherBot..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary/50 pr-12"/><button onClick={handleChat} disabled={chatLoading||!chatMsg.trim()} className="absolute right-2 top-2 p-1.5 bg-brand-primary text-black rounded-lg disabled:opacity-50"><ChevronRight size={18}/></button></div>
            </div>
          </div>
          {reports.length>0&&(<div className="p-6 rounded-3xl bg-brand-surface border border-brand-border"><h3 className="text-lg font-bold font-display mb-4">Recent Activity</h3><div className="space-y-3">{reports.slice(0,5).map(r=>(<div key={r.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5"><div className="flex items-center gap-4"><div className={cn("w-10 h-10 rounded-lg flex items-center justify-center",r.is_correct?"bg-emerald-500/10 text-emerald-500":"bg-red-500/10 text-red-500")}>{r.is_correct?<CheckCircle2 size={20}/>:<XCircle size={20}/>}</div><div><div className="font-medium text-sm capitalize">{r.sim_type} Simulation</div><div className="text-xs text-zinc-500">{new Date(r.created_at).toLocaleString()}</div></div></div><div className="text-right"><div className={cn("text-sm font-bold",r.score>=70?"text-emerald-400":"text-red-400")}>{r.score}%</div><DiffBadge level={r.difficulty||1}/></div></div>))}</div></div>)}
        </motion.div>)}

        {/* ═══ EMAIL SIM ═══ */}
        {view==='email-sim'&&(<motion.div key="e" initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {emailSim?.difficulty&&<div className="flex items-center gap-3"><DiffBadge level={emailSim.difficulty}/><span className="text-xs text-zinc-600">Adaptive difficulty</span></div>}
            <div className="rounded-3xl bg-brand-surface border border-brand-border overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-brand-border bg-white/5">
                <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400"><User size={20}/></div><div><div className="font-bold">{emailSim?.senderName||'Loading...'}</div><div className="text-xs text-zinc-500 font-mono">{emailSim?.senderEmail||''}</div></div></div><div className="text-xs text-zinc-500">Today, {new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div>
                <h2 className="text-xl font-bold">{emailSim?.subject||'Subject'}</h2>
              </div>
              <div className="p-8 min-h-[400px] prose prose-invert max-w-none">{emailSim?<Markdown>{emailSim.body}</Markdown>:<div className="flex flex-col items-center justify-center h-64 text-zinc-600"><Mail size={48} className="animate-pulse mb-4"/><p>Generating AI phishing attempt...</p></div>}</div>
            </div>
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex gap-3"><Info className="text-blue-400 shrink-0" size={20}/><p className="text-sm text-blue-100/80">Review carefully. Select matching red flags on the right.</p></div>
          </div>
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-brand-surface border border-brand-border">
              <h3 className="text-lg font-bold font-display mb-6 flex items-center gap-2"><Flag size={20} className="text-brand-primary"/>Red Flags</h3>
              <div className="space-y-3 mb-8">{flagsEmail.map(f=>(<button key={f} onClick={()=>setSelectedFlags(p=>p.includes(f)?p.filter(x=>x!==f):[...p,f])} className={cn("w-full text-left px-4 py-3 rounded-xl border transition-all text-sm",selectedFlags.includes(f)?"bg-brand-primary/10 border-brand-primary text-brand-primary":"bg-white/5 border-white/10 text-zinc-400 hover:border-white/30")}>{f}</button>))}</div>
              <button onClick={()=>submitAnalysis('email')} disabled={loading||!emailSim||selectedFlags.length===0} className="w-full py-4 bg-brand-primary text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,255,65,0.4)] transition-all disabled:opacity-50">{loading?'Analyzing with Gemini...':'Submit Analysis'}</button>
            </div>
            {feedback&&<FeedbackCard feedback={feedback} onRetry={startEmailSim}/>}
          </div>
        </motion.div>)}

        {/* ═══ DEEPFAKE LAB ═══ */}
        {view==='deepfake-sim'&&(<motion.div key="df" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-8">
          <div className="flex items-center justify-between"><div><h2 className="text-3xl font-bold font-display">Deepfake Lab</h2><p className="text-zinc-400">Is this voice real or AI-generated?</p></div>{deepfakeSim?.difficulty&&<DiffBadge level={deepfakeSim.difficulty}/>}</div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="p-8 rounded-3xl bg-brand-surface border border-brand-border">
                <div className="flex items-center gap-4 mb-8"><div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary"><Crosshair size={24}/></div><div><h3 className="text-xl font-bold">Voice Verification</h3><p className="text-sm text-zinc-500">Listen and classify: authentic or synthetic?</p></div></div>
                <div className="bg-black/40 rounded-2xl p-8 border border-white/5 mb-8">
                  <div className="flex items-center justify-center h-32 mb-6"><div className="flex items-end gap-1 h-12">{[...Array(24)].map((_,i)=>(<motion.div key={i} animate={isPlaying?{height:[8,Math.random()*44+8,8]}:{height:8}} transition={{repeat:Infinity,duration:0.4+Math.random()*0.3,delay:i*0.04}} className={cn("w-1 rounded-full",isPlaying?"bg-brand-primary":"bg-zinc-700")}/>))}</div></div>
                  <div className="flex items-center justify-center"><button onClick={()=>doPlay(deepfakeSim?.audioBase64)} disabled={!deepfakeSim?.audioBase64} className="w-16 h-16 rounded-full bg-brand-primary flex items-center justify-center text-black hover:scale-110 transition-transform shadow-[0_0_30px_rgba(0,255,65,0.4)] disabled:opacity-50">{isPlaying?<Volume2 size={28}/>:<Zap size={28}/>}</button></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={()=>handleDeepfakeGuess('authentic')} disabled={feedback!==null} className={cn("p-6 rounded-2xl border transition-all group",feedback?(!deepfakeSim?.isSynthetic?(feedback.score===100?"bg-emerald-500/20 border-emerald-500":"bg-red-500/10 border-red-500/30"):"opacity-40 border-white/5"):"border-white/10 bg-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30")}><CheckCircle2 className="mb-3 text-zinc-500 group-hover:text-emerald-500"/><div className="font-bold">Authentic</div><div className="text-xs text-zinc-500">Real human</div></button>
                  <button onClick={()=>handleDeepfakeGuess('synthetic')} disabled={feedback!==null} className={cn("p-6 rounded-2xl border transition-all group",feedback?(deepfakeSim?.isSynthetic?(feedback.score===100?"bg-emerald-500/20 border-emerald-500":"bg-red-500/10 border-red-500/30"):"opacity-40 border-white/5"):"border-white/10 bg-white/5 hover:bg-red-500/10 hover:border-red-500/30")}><AlertTriangle className="mb-3 text-zinc-500 group-hover:text-red-500"/><div className="font-bold">Synthetic</div><div className="text-xs text-zinc-500">AI clone</div></button>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              {deepfakeSim?.contextHints&&(<div className="p-6 rounded-3xl bg-brand-surface border border-brand-border"><h4 className="font-bold mb-4 flex items-center gap-2"><Eye size={18} className="text-brand-primary"/>Detection Tips</h4><ul className="space-y-3 text-sm text-zinc-400">{deepfakeSim.contextHints.map((h,i)=>(<li key={i} className="flex gap-3"><div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center shrink-0 text-xs">{i+1}</div>{h}</li>))}</ul></div>)}
              {feedback&&<FeedbackCard feedback={feedback} onRetry={startDeepfakeSim}/>}
            </div>
          </div>
        </motion.div>)}

        {/* ═══ PHONE SIM ═══ */}
        {view==='phone-sim'&&(<motion.div key="ph" initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0}} className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="relative aspect-[9/19] max-w-[320px] mx-auto bg-zinc-900 rounded-[3rem] border-[8px] border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
              <div className="h-6 w-32 bg-zinc-800 rounded-b-2xl mx-auto mb-8"/>
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center mb-6"><User size={48} className="text-zinc-600"/></div>
                <h3 className="text-2xl font-bold mb-1">{phoneSim?.callerName||'Unknown Caller'}</h3>
                <p className="text-zinc-500 text-sm mb-2">{phoneSim?.callerRole||'Potential Spam'}</p>
                {phoneSim?.difficulty&&<DiffBadge level={phoneSim.difficulty}/>}
                <div className="mt-6 w-full">{isCalling?(<div className="space-y-6"><div className="text-brand-primary font-mono text-lg">{fmtC(callDuration)}</div><div className="flex justify-center gap-6"><div className="flex flex-col items-center gap-2"><button onClick={()=>{if(phoneAudioRef.current){phoneAudioRef.current.pause();phoneAudioRef.current=null;}const a=playAudio(phoneSim?.audioBase64);if(a){phoneAudioRef.current=a;setIsPlaying(true);a.onended=()=>{setIsPlaying(false);phoneAudioRef.current=null;};}}} className="w-12 h-12 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary"><Volume2 size={20}/></button><span className="text-[10px] text-zinc-500">Speaker</span></div><button onClick={()=>setIsListening(l=>!l)} className={cn("flex flex-col items-center justify-center gap-2 w-14 rounded-full py-2",isListening?"bg-red-500/20 text-red-400":"bg-white/10 text-zinc-400")} title={isListening?"Stop responding":"Speak your response"}>{isListening?<Mic size={20}/>:<MicOff size={20}/>}<span className="text-[10px] text-zinc-500">Respond</span></button></div><p className="text-[10px] text-zinc-500 text-center">Tap Respond to speak back — the call will end a few seconds after you do, then we&apos;ll show what you did wrong. Or hang up now (correct).</p><button onClick={()=>hangUpPhone()} disabled={loading} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white mx-auto shadow-lg shadow-red-500/20 disabled:opacity-50"><PhoneOff size={24}/></button></div>):(<button onClick={()=>{setCallTranscript('');setIsCalling(true);setCallDuration(0);const a=playAudio(phoneSim?.audioBase64);if(a){phoneAudioRef.current=a;setIsPlaying(true);a.onended=()=>{setIsPlaying(false);phoneAudioRef.current=null;};}}} className="w-16 h-16 rounded-full bg-brand-primary flex items-center justify-center text-black mx-auto shadow-lg shadow-brand-primary/20 animate-bounce"><Phone size={24}/></button>)}</div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-brand-surface border border-brand-border">
                <h3 className="text-xl font-bold font-display mb-4">Vishing — Real-time call</h3>
                {!phoneSim?(<button onClick={startPhoneSim} disabled={loading} className="w-full py-4 bg-brand-primary text-black font-bold rounded-xl">{loading?'Generating...':'Load Scenario'}</button>):(<div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10"><div className="text-xs font-bold text-brand-primary uppercase mb-1">Scenario</div><div className="text-sm">{phoneSim.scenario}</div></div>
                  {isCalling?(<div className="p-4 rounded-xl bg-white/5 border border-white/10"><div className="text-xs font-bold text-zinc-500 uppercase mb-2">Your response (speak or hang up)</div><p className="text-sm text-zinc-300 min-h-[2.5rem]">{callTranscript||(isListening?'Listening…':'Tap Respond on the phone to speak. Best choice: hang up immediately.')}</p></div>):(<><div className="space-y-2"><div className="text-xs font-bold text-zinc-500 uppercase">Or identify red flags after the call</div>{flagsPhone.map(f=>(<button key={f} onClick={()=>setSelectedFlags(p=>p.includes(f)?p.filter(x=>x!==f):[...p,f])} className={cn("w-full text-left px-4 py-3 rounded-xl border transition-all text-sm",selectedFlags.includes(f)?"bg-brand-primary/10 border-brand-primary text-brand-primary":"bg-white/5 border-white/10 text-zinc-400 hover:border-white/30")}>{f}</button>))}</div><button onClick={()=>submitAnalysis('phone')} disabled={loading||selectedFlags.length===0} className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-brand-primary transition-all disabled:opacity-50">{loading?'Analyzing...':'Submit Analysis'}</button></>)}
                </div>)}
              </div>
              {feedback&&<FeedbackCard feedback={feedback} onRetry={startPhoneSim}/>}
            </div>
          </div>
        </motion.div>)}

        {/* ═══ ANALYTICS ═══ */}
        {view==='analytics'&&(<motion.div key="an" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-8">
          <div><h2 className="text-3xl font-bold font-display">Security Analytics</h2><p className="text-zinc-400">Real performance data from your training sessions.</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-6 rounded-3xl bg-brand-surface border border-brand-border">
              <h3 className="text-lg font-bold font-display mb-4">Score Timeline</h3>
              <ResponsiveContainer width="100%" height={250}><AreaChart data={timeline}><defs><linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00FF41" stopOpacity={0.3}/><stop offset="100%" stopColor="#00FF41" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#262626"/><XAxis dataKey="date" tick={{fontSize:10,fill:'#666'}} tickFormatter={(v:string)=>v.slice(5)}/><YAxis domain={[0,100]} tick={{fontSize:10,fill:'#666'}}/><Tooltip content={<ChartTip/>}/><Area type="monotone" dataKey="avg_score" name="Score" stroke="#00FF41" fill="url(#sg2)" strokeWidth={2}/></AreaChart></ResponsiveContainer>
            </div>
            <div className="p-6 rounded-3xl bg-brand-surface border border-brand-border">
              <h3 className="text-lg font-bold font-display mb-4">Performance by Type</h3>
              <ResponsiveContainer width="100%" height={250}><BarChart data={byType}><CartesianGrid strokeDasharray="3 3" stroke="#262626"/><XAxis dataKey="sim_type" tick={{fontSize:10,fill:'#666'}}/><YAxis domain={[0,100]} tick={{fontSize:10,fill:'#666'}}/><Tooltip content={<ChartTip/>}/><Bar dataKey="avg_score" name="Avg Score" radius={[8,8,0,0]}>{byType.map((_,i)=>(<Cell key={i} fill={['#00FF41','#3B82F6','#F59E0B'][i%3]}/>))}</Bar></BarChart></ResponsiveContainer>
            </div>
          </div>
          {leaderboard.length>0&&(<div className="p-6 rounded-3xl bg-brand-surface border border-brand-border"><h3 className="text-lg font-bold font-display mb-4">Organization Leaderboard</h3><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="text-xs font-bold uppercase tracking-wider text-zinc-500 border-b border-brand-border"><th className="pb-3">Rank</th><th className="pb-3">Name</th><th className="pb-3">Department</th><th className="pb-3">Level</th><th className="pb-3">XP</th><th className="pb-3">Score</th><th className="pb-3">Streak</th></tr></thead><tbody className="text-sm">{leaderboard.map((p:any,i:number)=>(<tr key={p.name} className="border-b border-brand-border/50 hover:bg-white/5"><td className="py-3"><span className={cn("font-bold",i===0?"text-yellow-400":i===1?"text-zinc-300":i===2?"text-orange-400":"text-zinc-500")}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span></td><td className="py-3 font-medium">{p.name}</td><td className="py-3 text-zinc-400">{p.dept_name}</td><td className="py-3"><span className="px-2 py-0.5 rounded bg-brand-primary/10 text-brand-primary text-xs font-bold">Lv.{p.level}</span></td><td className="py-3 font-mono text-brand-primary">{p.xp}</td><td className="py-3"><span className={cn("font-bold",p.security_score>80?"text-emerald-400":p.security_score>60?"text-yellow-400":"text-red-400")}>{p.security_score}%</span></td><td className="py-3 text-zinc-400">{p.best_streak}🔥</td></tr>))}</tbody></table></div></div>)}
        </motion.div>)}

        {/* ═══ REPORTS ═══ */}
        {view==='reports'&&(<motion.div key="rp" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-8">
          <div><h2 className="text-3xl font-bold font-display">Training Reports</h2><p className="text-zinc-400">Complete simulation history.</p></div>
          <div className="grid grid-cols-1 gap-4">{reports.length===0?(<div className="p-12 text-center bg-brand-surface border border-brand-border rounded-3xl"><Flag size={32} className="text-zinc-600 mx-auto mb-4"/><p className="text-zinc-500">No reports yet. Complete a simulation first.</p></div>):reports.map(r=>(<div key={r.id} className="p-6 rounded-3xl bg-brand-surface border border-brand-border hover:border-brand-primary/30 transition-all"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-4"><div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center",r.is_correct?"bg-emerald-500/10 text-emerald-500":"bg-red-500/10 text-red-500")}>{r.is_correct?<CheckCircle2 size={24}/>:<XCircle size={24}/>}</div><div><div className="flex items-center gap-2 mb-1"><span className="font-bold capitalize">{r.sim_type} Sim</span><DiffBadge level={r.difficulty||1}/><span className="text-[10px] text-zinc-500 font-mono">{new Date(r.created_at).toLocaleString()}</span></div><p className="text-sm text-zinc-400 line-clamp-1">{r.feedback}</p></div></div><div className="text-right"><div className={cn("text-lg font-bold font-display",r.score>=70?"text-emerald-500":"text-red-500")}>{r.score}%</div><div className="text-[10px] text-zinc-500 font-mono">{r.response_time_ms?`${Math.round(r.response_time_ms/1000)}s`:'—'}</div></div></div></div>))}</div>
        </motion.div>)}

        {/* ═══ ADMIN DASHBOARD ═══ */}
        {view==='admin-dashboard'&&(<motion.div key="ad" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-8">
          <div><h2 className="text-3xl font-bold font-display">SOC Command Center</h2><p className="text-zinc-400">Organizational vulnerability monitoring.</p></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard label="Total Simulations" value={adminStats.total_sims||0} icon={Shield}/>
            <StatCard label="Successful Reports" value={adminStats.total_reports||0} icon={CheckCircle2}/>
            <StatCard label="Compromises" value={adminStats.total_compromises||0} icon={AlertTriangle}/>
            <StatCard label="Org Avg Score" value={adminStats.org_avg_score?`${Math.round(adminStats.org_avg_score)}%`:'—'} icon={Target}/>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-6 rounded-3xl bg-brand-surface border border-brand-border">
              <h3 className="text-lg font-bold font-display mb-4">Fail Rate by Attack Type</h3>
              {adminStats.riskByType?.length>0&&(<ResponsiveContainer width="100%" height={200}><BarChart data={adminStats.riskByType}><CartesianGrid strokeDasharray="3 3" stroke="#262626"/><XAxis dataKey="sim_type" tick={{fontSize:10,fill:'#666'}}/><YAxis tick={{fontSize:10,fill:'#666'}}/><Tooltip content={<ChartTip/>}/><Bar dataKey="fail_rate" name="Fail %" radius={[8,8,0,0]}>{adminStats.riskByType.map((_:any,i:number)=>(<Cell key={i} fill={['#EF4444','#F59E0B','#3B82F6'][i%3]}/>))}</Bar></BarChart></ResponsiveContainer>)}
            </div>
            <div className="p-6 rounded-3xl bg-brand-surface border border-brand-border">
              <h3 className="text-lg font-bold font-display mb-4">Department Risk</h3>
              <div className="space-y-4">{departments.map((d:any)=>(<div key={d.id}><div className="flex justify-between text-sm mb-2"><span className="text-zinc-400">{d.name}</span><span className={cn("font-bold",d.avg_score>80?"text-brand-primary":d.avg_score>60?"text-yellow-500":"text-red-500")}>{Math.round(d.avg_score||0)}%</span></div><div className="h-2 w-full bg-white/5 rounded-full overflow-hidden"><motion.div initial={{width:0}} animate={{width:`${d.avg_score||0}%`}} className={cn("h-full rounded-full",d.avg_score>80?"bg-brand-primary":d.avg_score>60?"bg-yellow-500":"bg-red-500")}/></div></div>))}</div>
            </div>
          </div>
          {adminStats.trendData?.length>0&&(<div className="p-6 rounded-3xl bg-brand-surface border border-brand-border"><h3 className="text-lg font-bold font-display mb-4">14-Day Score Trend</h3><ResponsiveContainer width="100%" height={200}><AreaChart data={[...adminStats.trendData].reverse()}><defs><linearGradient id="asg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00FF41" stopOpacity={0.3}/><stop offset="100%" stopColor="#00FF41" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#262626"/><XAxis dataKey="date" tick={{fontSize:10,fill:'#666'}} tickFormatter={(v:string)=>v.slice(5)}/><YAxis domain={[0,100]} tick={{fontSize:10,fill:'#666'}}/><Tooltip content={<ChartTip/>}/><Area type="monotone" dataKey="avg_score" name="Score" stroke="#00FF41" fill="url(#asg)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div>)}
        </motion.div>)}

        {/* ═══ ADMIN CAMPAIGNS ═══ */}
        {view==='admin-campaigns'&&(<motion.div key="ac" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-8">
          <div className="flex items-center justify-between"><div><h2 className="text-3xl font-bold font-display">Campaigns</h2><p className="text-zinc-400">Launch and manage simulations.</p></div>
            <button onClick={()=>{if(!departments.length)return;const d=departments[Math.floor(Math.random()*departments.length)];const t=['email','phone','deepfake'][Math.floor(Math.random()*3)];createCampaign({name:`Campaign ${campaigns.length+1}`,target_dept_id:d.id,sim_type:t}).then(()=>loadAdmin());}} className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-black font-bold rounded-xl"><Zap size={18}/>Launch Campaign</button></div>
          <div className="grid grid-cols-1 gap-4">{campaigns.map((c:any)=>(<div key={c.id} className="p-6 rounded-3xl bg-brand-surface border border-brand-border flex items-center justify-between"><div className="flex items-center gap-6"><div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">{c.sim_type==='email'?<Mail size={24}/>:c.sim_type==='phone'||c.sim_type==='audio'?<Phone size={24}/>:<Video size={24}/>}</div><div><h4 className="font-bold text-lg">{c.name}</h4><div className="text-sm text-zinc-500">{c.dept_name} • {c.sim_type}</div></div></div><div className="flex items-center gap-4"><div className="text-center"><div className="text-2xl font-bold font-display">{c.response_count}</div><div className="text-[10px] text-zinc-500 uppercase">Responses</div></div><div className="px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase">{c.status}</div><button onClick={()=>deleteCampaign(c.id).then(()=>loadAdmin()).catch((e:any)=>alert(e?.message||'Delete failed'))} className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete campaign"><Trash2 size={18}/></button></div></div>))}</div>
        </motion.div>)}

        {/* ═══ ADMIN DEPARTMENTS ═══ */}
        {view==='admin-departments'&&(<motion.div key="adp" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-8">
          <div><h2 className="text-3xl font-bold font-display">Departments</h2><p className="text-zinc-400">Security posture by team.</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{departments.map((d:any)=>(<div key={d.id} className="p-6 rounded-3xl bg-brand-surface border border-brand-border hover:border-brand-primary/30 transition-all group"><div className="flex justify-between items-start mb-6"><div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-brand-primary/10"><User size={24} className="text-zinc-400 group-hover:text-brand-primary"/></div><div className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase",d.avg_score>80?"bg-emerald-500/10 text-emerald-500":"bg-red-500/10 text-red-500")}>{d.avg_score>80?'Low Risk':'High Risk'}</div></div><h3 className="text-xl font-bold mb-1">{d.name}</h3><p className="text-xs text-zinc-500 mb-6">{d.employee_count} Employees • {d.total_sims||0} Simulations</p><div className="space-y-2"><div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500"><span>Score</span><span>{Math.round(d.avg_score||0)}%</span></div><div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden"><div className={cn("h-full rounded-full transition-all duration-1000",d.avg_score>80?"bg-brand-primary":"bg-red-500")} style={{width:`${d.avg_score||0}%`}}/></div></div></div>))}</div>
        </motion.div>)}

        </AnimatePresence></div>
      </main>
    </div>
  );
}
