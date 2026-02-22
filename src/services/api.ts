// All AI calls go through the server — API key never touches the browser.

const api = async (path: string, options?: RequestInit) => {
  const res = await fetch(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
};

export const generatePhishingEmail = (employeeId = 1) =>
  api("/api/generate/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employee_id: employeeId }),
  });

export const generatePhoneSimulation = (employeeId = 1) =>
  api("/api/generate/phone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employee_id: employeeId }),
  });

export const generateDeepfake = (employeeId = 1) =>
  api("/api/generate/deepfake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employee_id: employeeId }),
  });

export const analyzeSimulation = (simulationContent: any, userFlags: string[], simType: string) =>
  api("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ simulation_content: simulationContent, user_flags: userFlags, sim_type: simType }),
  });

export const analyzePhoneEngagement = (transcript: string, scenario: string, attackerScript: string) =>
  api("/api/analyze/phone-engagement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, scenario, attacker_script: attackerScript }),
  });

export const sendChatMessage = (message: string, context?: string) =>
  api("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context }),
  });

export const saveResult = (data: any) =>
  api("/api/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const fetchStats = () => api("/api/stats");
export const fetchReports = () => api("/api/reports");
export const fetchTimeline = (empId = 1) => api(`/api/analytics/timeline?employee_id=${empId}`);
export const fetchByType = (empId = 1) => api(`/api/analytics/by-type?employee_id=${empId}`);
export const fetchDifficultyCurve = (empId = 1) => api(`/api/analytics/difficulty-curve?employee_id=${empId}`);
export const fetchLeaderboard = () => api("/api/analytics/org-leaderboard");
export const fetchThreatFeed = () => api("/api/threat-feed");
export const fetchAdminOverview = () => api("/api/admin/overview");
export const fetchAdminDepartments = () => api("/api/admin/departments");
export const fetchAdminCampaigns = () => api("/api/admin/campaigns");
export const createCampaign = (data: any) =>
  api("/api/admin/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const deleteCampaign = (id: number) =>
  api(`/api/admin/campaigns/${id}`, { method: "DELETE" });

// Audio playback utility (stays client-side, it's just decoding)
export const playAudio = (base64: string): HTMLAudioElement | null => {
  try {
    const bin = window.atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    // WAV header for raw 16-bit PCM @ 24kHz
    const header = new ArrayBuffer(44);
    const v = new DataView(header);
    const write = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    write(0, "RIFF"); v.setUint32(4, 36 + bin.length, true); write(8, "WAVE");
    write(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, 24000, true); v.setUint32(28, 48000, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    write(36, "data"); v.setUint32(40, bin.length, true);

    const wav = new Uint8Array(44 + bin.length);
    wav.set(new Uint8Array(header), 0);
    wav.set(bytes, 44);

    const blob = new Blob([wav], { type: "audio/wav" });
    const audio = new Audio(URL.createObjectURL(blob));
    audio.play().catch(console.error);
    return audio;
  } catch (e) {
    console.error("Audio playback failed:", e);
    return null;
  }
};
