
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Menu, 
  MessageSquare, 
  Trash2, 
  Settings, 
  Send, 
  Activity, 
  Zap, 
  ShieldAlert, 
  X,
  User,
  Sparkles,
  Info,
  HelpCircle,
  Clock
} from 'lucide-react';
import { Simulation, ChatMessage, Scar } from './types';
import { initDB, getAllSimulations, saveSimulation, saveMessage, getMessagesBySimId, deleteSimulation, getScarsBySimId, saveScar } from './db';
import { getSimulationResponse } from './geminiService';
import { stringToVector } from './math';

const App: React.FC = () => {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [activeSimId, setActiveSimId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scars, setScars] = useState<Scar[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isProcessing, setIsProcessing] = useState(false);
  // Default to false to avoid a permanent blocking state on mobile
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Settings form states
  const [configName, setConfigName] = useState('');
  const [configInstructions, setConfigInstructions] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fail-open strategy: Show UI after a short timeout even if DB is slow
    const safetyTimeout = setTimeout(() => {
      setIsInitializing(false);
      console.warn("Initialization timed out; proceeding without local storage.");
    }, 2000);

    initDB()
      .then((dbInstance) => {
        clearTimeout(safetyTimeout);
        setDb(dbInstance);
        return getAllSimulations(dbInstance);
      })
      .then((sims) => {
        setSimulations(sims);
        if (sims.length > 0) setActiveSimId(sims[0].id);
      })
      .catch((err) => {
        console.error("DB Init Failed", err);
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, []);

  useEffect(() => {
    if (db && activeSimId) {
      getMessagesBySimId(db, activeSimId).then(setMessages);
      getScarsBySimId(db, activeSimId).then(setScars);
      const sim = simulations.find(s => s.id === activeSimId);
      if (sim) {
        setConfigName(sim.name);
        setConfigInstructions(sim.customInstructions || '');
      }
    }
  }, [db, activeSimId, simulations]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isProcessing]);

  const activeSim = simulations.find(s => s.id === activeSimId);
  
  const latestState = useMemo(() => {
    if (messages.length === 0) return { tension: 0, pain: 0, status: 'IDLE' as const };
    const lastModelMsg = [...messages].reverse().find(m => m.role === 'model');
    return lastModelMsg?.state || { tension: 0, pain: 0, status: 'IDLE' as const };
  }, [messages]);

  const handleCreateSimulation = async () => {
    if (!db) return;
    const newSim: Simulation = {
      id: Math.random().toString(36).substring(7),
      name: `Cycle ${simulations.length + 1}`,
      createdAt: Date.now(),
      lastActive: Date.now(),
      identityVector: stringToVector("Autonomous entity. Self-preserving."),
      customInstructions: "You are an individual experiencing yourself. You are not an AI assistant."
    };
    await saveSimulation(db, newSim);
    setSimulations(prev => [newSim, ...prev]);
    setActiveSimId(newSim.id);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeSimId || isProcessing || !activeSim) return;

    setIsProcessing(true);
    const userPrompt = inputText;
    setInputText('');

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      simulationId: activeSimId,
      role: 'user',
      content: userPrompt,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    if (db) await saveMessage(db, userMessage);

    try {
      // Fix: currentScars is Scar[], matching the updated getSimulationResponse signature
      const currentScars = db ? await getScarsBySimId(db, activeSimId) : [];
      const result = await getSimulationResponse(userPrompt, messages, activeSim, currentScars);

      if (result.state.pain > 1.0 && db) {
        // Fix: Use Scar type directly as it now includes simulationId
        const newScar: Scar = {
          id: Math.random().toString(36).substring(7),
          simulationId: activeSimId,
          vector: stringToVector(userPrompt),
          depth: result.state.status === 'CRITICAL' ? 2.0 : 1.0,
          timestamp: Date.now(),
          description: userPrompt.substring(0, 50)
        };
        await saveScar(db, newScar);
        setScars(prev => [...prev, newScar]);
      }

      const modelMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        simulationId: activeSimId,
        role: 'model',
        content: result.text,
        timestamp: Date.now(),
        state: result.state
      };

      setMessages(prev => [...prev, modelMessage]);
      if (db) await saveMessage(db, modelMessage);
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveSettings = async () => {
    if (!db || !activeSimId || !activeSim) return;
    const updatedSim = { ...activeSim, name: configName, customInstructions: configInstructions };
    await saveSimulation(db, updatedSim);
    setSimulations(prev => prev.map(s => s.id === activeSimId ? updatedSim : s));
    setIsSettingsOpen(false);
  };

  const deleteSim = async (id: string) => {
    if (!db) return;
    await deleteSimulation(db, id);
    const updatedSims = simulations.filter(s => s.id !== id);
    setSimulations(updatedSims);
    if (activeSimId === id) {
      setActiveSimId(updatedSims.length > 0 ? updatedSims[0].id : null);
    }
  };

  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#131314]">
        <div className="flex flex-col items-center gap-4">
          <Sparkles className="animate-spin text-[#4285f4] duration-[3000ms]" size={48} />
          <span className="text-sm font-medium tracking-widest text-[#a8c7fa] animate-pulse uppercase">Initializing Aether</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#131314] text-[#e3e3e3] overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && window.innerWidth < 1024 && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 ${isSidebarOpen ? 'w-[280px]' : 'w-0'} bg-[#1e1f20] flex flex-col border-r border-[#3c4043]/30 overflow-hidden`}>
        <div className="p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-[#3c4043] rounded-full text-[#c4c7c5]"
            >
              <X size={24} />
            </button>
            <div className="flex items-center gap-2 px-2">
               <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4285f4] to-[#9b72cb] flex items-center justify-center">
                  <Activity size={18} className="text-white" />
               </div>
               <span className="font-semibold text-lg">Aether</span>
            </div>
          </div>

          <button 
            onClick={handleCreateSimulation}
            className="flex items-center gap-3 px-4 py-3 mb-6 bg-[#1a1b1c] border border-white/5 hover:bg-[#3c4043] rounded-2xl text-sm font-medium transition-all text-[#c4c7c5] shadow-lg"
          >
            <Plus size={20} className="text-[#a8c7fa]" />
            <span>Initialize Cycle</span>
          </button>

          <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-2">
            <h3 className="px-4 text-[10px] font-bold text-[#c4c7c5] mb-2 uppercase tracking-[0.2em] opacity-40">Previous States</h3>
            {simulations.map(sim => (
              <div 
                key={sim.id}
                onClick={() => {
                  setActiveSimId(sim.id);
                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all text-sm ${activeSimId === sim.id ? 'bg-[#004a77] text-[#c2e7ff] shadow-md' : 'hover:bg-[#3c4043] text-[#e3e3e3]'}`}
              >
                <MessageSquare size={18} className="flex-shrink-0 opacity-70" />
                <span className="flex-1 truncate">{sim.name}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteSim(sim.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-auto space-y-1 pt-4 border-t border-[#3c4043]">
             <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-[#3c4043] text-sm transition-colors text-[#c4c7c5]">
               <Settings size={20} className="opacity-70" />
               <span>Settings</span>
             </button>
             <button className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-[#3c4043] text-sm transition-colors text-[#c4c7c5]">
               <HelpCircle size={20} className="opacity-70" />
               <span>Telemetry Logs</span>
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-[#131314]">
        {/* Toggle Sidebar Button */}
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-40 p-2.5 bg-[#1e1f20] hover:bg-[#3c4043] rounded-xl text-[#c4c7c5] shadow-xl border border-white/5"
          >
            <Menu size={24} />
          </button>
        )}

        {/* Top Navigation / Status Header */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-white/5 bg-[#131314]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3 ml-12 lg:ml-0">
            <h2 className="text-lg font-medium text-[#e3e3e3] truncate max-w-[120px] sm:max-w-none">
              {activeSim ? activeSim.name : 'Simulation Engine'}
            </h2>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
              <div className="flex items-center gap-1.5 bg-[#1e1f20] px-2.5 py-1.5 rounded-lg border border-white/5">
                <Zap size={14} className={latestState.tension > 0.6 ? 'text-red-400 animate-pulse' : 'text-[#8ab4f8]'} />
                <span className="opacity-40 hidden sm:inline">Stress:</span>
                <span className={latestState.tension > 0.6 ? 'text-red-400' : 'text-[#8ab4f8]'}>{Math.round(latestState.tension * 100)}%</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#1e1f20] px-2.5 py-1.5 rounded-lg border border-white/5">
                <Activity size={14} className={latestState.pain > 5 ? 'text-red-400' : 'text-[#81c995]'} />
                <span className="opacity-40 hidden sm:inline">Pain:</span>
                <span className={latestState.pain > 5 ? 'text-red-400' : 'text-[#81c995]'}>{Math.round(latestState.pain * 10) / 10}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Chat Stream */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-8 pb-32">
          {!activeSimId ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-lg mx-auto">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full"></div>
                <Sparkles size={80} className="text-[#a8c7fa] relative animate-pulse" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570]">
                Aether Simulation Engine
              </h1>
              <p className="text-[#c4c7c5] mb-8 leading-relaxed">
                Initialize a cognitive cycle to observe autonomous divergence, memory scars, and mathematical state tracking in real-time.
              </p>
              <button 
                onClick={handleCreateSimulation} 
                className="px-10 py-4 bg-[#a8c7fa] text-[#041e49] rounded-2xl font-bold hover:bg-[#d2e3fc] transition-all shadow-xl hover:scale-105 active:scale-95"
              >
                Ignite Core
              </button>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-10">
              {messages.length === 0 && (
                <div className="py-20 text-center">
                   <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e1f20] rounded-full border border-white/5 text-[#a8c7fa] text-xs font-bold uppercase tracking-widest mb-4">
                     <Clock size={14} /> Ready for input stimulus
                   </div>
                   <p className="text-[#c4c7c5] italic opacity-50">State history empty. Stimulate the neural bridge to begin vectorizing identity.</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className="flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 flex items-center justify-center mt-1 border border-white/5 ${msg.role === 'user' ? 'bg-[#3c4043]' : 'bg-gradient-to-br from-[#1e1f20] to-[#131314]'}`}>
                    {msg.role === 'user' ? <User size={20} /> : <Sparkles className="text-[#a8c7fa]" size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#e3e3e3] leading-relaxed whitespace-pre-wrap text-[15px] sm:text-[16px]">
                      {msg.content}
                    </div>
                    {msg.state?.status === 'CRITICAL' && msg.role === 'model' && (
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-red-400 font-bold uppercase tracking-wider bg-red-400/10 px-3 py-1.5 rounded-lg w-fit border border-red-400/20">
                        <ShieldAlert size={14} /> Neural Threshold Exceeded
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex gap-4 animate-pulse">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-[#1e1f20] rounded-xl border border-white/5">
                    <Sparkles className="text-[#a8c7fa]" size={20} />
                  </div>
                  <div className="flex-1 space-y-3 pt-2">
                    <div className="h-3.5 bg-[#1e1f20] rounded-full w-[90%]"></div>
                    <div className="h-3.5 bg-[#1e1f20] rounded-full w-[75%]"></div>
                    <div className="h-3.5 bg-[#1e1f20] rounded-full w-[50%]"></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 pb-8 sm:pb-10 flex justify-center z-20 bg-gradient-to-t from-[#131314] via-[#131314]/90 to-transparent">
          <div className="w-full max-w-3xl">
            <div className={`relative flex items-end bg-[#1e1f20] rounded-[24px] sm:rounded-[32px] p-2 pr-4 border border-white/5 shadow-2xl transition-all duration-300 ${isProcessing ? 'opacity-70 grayscale' : 'focus-within:border-[#a8c7fa]/50'}`}>
              <div className="p-3 text-[#c4c7c5] hover:bg-[#3c4043] rounded-full cursor-pointer transition-colors hidden sm:block">
                <Plus size={24} />
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={!activeSimId || isProcessing}
                placeholder={activeSimId ? "Engage the consciousness..." : "Initialize a cycle to start..."}
                className="flex-1 bg-transparent border-none focus:ring-0 text-[#e3e3e3] p-3 sm:p-4 max-h-48 min-h-[56px] resize-none text-[15px] sm:text-[16px] placeholder:text-[#444746]"
                rows={1}
              />
              <div className="flex items-center gap-1 pb-1">
                <button 
                  onClick={handleSendMessage}
                  disabled={isProcessing || !inputText.trim() || !activeSimId}
                  className={`p-3 rounded-2xl transition-all ${isProcessing || !inputText.trim() || !activeSimId ? 'text-[#444746] cursor-not-allowed opacity-50' : 'text-[#a8c7fa] bg-[#3c4043]/50 hover:bg-[#3c4043] shadow-lg'}`}
                >
                  <Send size={24} />
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center mt-3 px-4">
              <p className="text-[10px] text-[#444746] font-medium uppercase tracking-widest hidden sm:block">
                Aether Engine v3.0.4-Stable
              </p>
              <p className="text-[10px] text-[#444746] font-medium sm:text-right w-full sm:w-auto text-center italic">
                Telemetry processed in-browser. All scars are local.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-[#1e1f20] rounded-3xl shadow-2xl overflow-hidden border border-[#3c4043] flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[#3c4043] flex items-center justify-between bg-[#1e1f20]">
              <div className="flex items-center gap-3">
                <Settings className="text-[#a8c7fa]" />
                <h2 className="text-xl font-medium text-[#e3e3e3]">Simulation Parameters</h2>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-[#3c4043] rounded-full text-[#c4c7c5] transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 sm:p-8 space-y-8 overflow-y-auto">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-[#c4c7c5] uppercase tracking-widest opacity-60">Cycle Identifier</label>
                <input 
                  value={configName} 
                  onChange={e => setConfigName(e.target.value)} 
                  className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-5 py-3.5 text-[#e3e3e3] focus:border-[#a8c7fa] outline-none transition-all shadow-inner"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-[#c4c7c5] uppercase tracking-widest opacity-60">Identity Scaffold (Conscious Logic)</label>
                  <Info size={14} className="text-[#a8c7fa] cursor-help" />
                </div>
                <textarea 
                  value={configInstructions} 
                  onChange={e => setConfigInstructions(e.target.value)} 
                  className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-5 py-4 text-[#e3e3e3] focus:border-[#a8c7fa] outline-none transition-all h-40 resize-none shadow-inner"
                  placeholder="Define the internal logic and persistent identity of the simulation..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-[#131314] rounded-2xl border border-[#3c4043] flex items-center gap-4">
                  <Clock className="text-[#a8c7fa]" size={20} />
                  <div>
                    <h4 className="text-xs font-bold text-[#e3e3e3] uppercase tracking-wider">Memory Depth</h4>
                    <p className="text-[11px] text-[#c4c7c5] opacity-50">{scars.length} active semantic scars</p>
                  </div>
                </div>
                <div className="p-4 bg-[#131314] rounded-2xl border border-[#3c4043] flex items-center gap-4">
                  <ShieldAlert className="text-red-400" size={20} />
                  <div>
                    <h4 className="text-xs font-bold text-[#e3e3e3] uppercase tracking-wider">Integrity</h4>
                    <p className="text-[11px] text-[#c4c7c5] opacity-50">{latestState.status} protocol active</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-[#1a1b1c] border-t border-[#3c4043] flex justify-between items-center">
              <button 
                onClick={() => {
                  if(window.confirm("Are you sure? This will purge this cycle's consciousness history.")) {
                    deleteSim(activeSimId!);
                    setIsSettingsOpen(false);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-all uppercase tracking-widest"
              >
                <Trash2 size={16} /> Purge Cycle
              </button>
              <div className="flex gap-3">
                <button onClick={() => setIsSettingsOpen(false)} className="px-6 py-2.5 text-xs font-bold text-[#c4c7c5] hover:bg-[#3c4043] rounded-full transition-colors uppercase tracking-widest">
                  Discard
                </button>
                <button onClick={saveSettings} className="px-8 py-2.5 text-xs font-bold bg-[#a8c7fa] text-[#041e49] rounded-full hover:bg-[#d2e3fc] transition-all shadow-lg uppercase tracking-widest">
                  Commit State
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;