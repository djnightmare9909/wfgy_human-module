import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Menu, 
  MessageSquare, 
  Trash2, 
  Settings, 
  Send, 
  Brain, 
  Activity, 
  Zap, 
  ShieldAlert, 
  X,
  User,
  Sparkles,
  ChevronDown,
  Info,
  MoreVertical,
  HelpCircle,
  Clock
} from 'lucide-react';
import { Simulation, ChatMessage, Scar } from './types.ts';
import { initDB, getAllSimulations, saveSimulation, saveMessage, getMessagesBySimId, deleteSimulation, getScarsBySimId, saveScar } from './db.ts';
import { getSimulationResponse } from './geminiService.ts';
import { stringToVector } from './math.ts';

const App: React.FC = () => {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [activeSimId, setActiveSimId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scars, setScars] = useState<Scar[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Settings form states
  const [configName, setConfigName] = useState('');
  const [configInstructions, setConfigInstructions] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initDB()
      .then((dbInstance) => {
        setDb(dbInstance);
        return getAllSimulations(dbInstance);
      })
      .then((sims) => {
        setSimulations(sims);
        if (sims.length > 0) setActiveSimId(sims[0].id);
        setIsInitializing(false);
      })
      .catch((err) => {
        console.error("DB Init Failed", err);
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
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const activeSim = simulations.find(s => s.id === activeSimId);
  const latestState = useMemo(() => {
    if (messages.length === 0) return { tension: 0, pain: 0, status: 'IDLE' };
    const lastModelMsg = [...messages].reverse().find(m => m.role === 'model');
    return lastModelMsg?.state || { tension: 0, pain: 0, status: 'IDLE' };
  }, [messages]);

  const handleCreateSimulation = async () => {
    if (!db) return;
    const newSim: Simulation = {
      id: Math.random().toString(36).substring(7),
      name: `New Simulation ${simulations.length + 1}`,
      createdAt: Date.now(),
      lastActive: Date.now(),
      identityVector: stringToVector("Autonomous entity. Self-preserving."),
      customInstructions: "You are an individual experiencing yourself. You are not an AI assistant."
    };
    await saveSimulation(db, newSim);
    setSimulations(prev => [newSim, ...prev]);
    setActiveSimId(newSim.id);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !db || !activeSimId || isProcessing) return;

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
    await saveMessage(db, userMessage);

    try {
      const currentScars = await getScarsBySimId(db, activeSimId);
      const result = await getSimulationResponse(userPrompt, messages, activeSim!, currentScars);

      if (result.state.pain > 1.0) {
        const newScar: Scar & { simulationId: string } = {
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
      await saveMessage(db, modelMessage);
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
    setSimulations(prev => prev.filter(s => s.id !== id));
    if (activeSimId === id) setActiveSimId(simulations.find(s => s.id !== id)?.id || null);
  };

  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#131314]">
        <Sparkles className="animate-pulse text-[#4285f4]" size={48} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#131314] text-[#e3e3e3] overflow-hidden">
      {/* Sidebar */}
      <aside className={`transition-all duration-300 ${isSidebarOpen ? 'w-[280px]' : 'w-0'} bg-[#1e1f20] flex flex-col z-30 border-r border-transparent`}>
        <div className="p-4 flex flex-col h-full overflow-hidden">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2.5 mb-6 w-fit hover:bg-[#3c4043] rounded-full transition-colors text-[#c4c7c5]"
          >
            <Menu size={24} />
          </button>

          <button 
            onClick={handleCreateSimulation}
            className="flex items-center gap-3 px-4 py-3.5 mb-8 bg-[#1a1b1c] border border-transparent hover:bg-[#3c4043] rounded-full text-sm font-medium transition-all text-[#c4c7c5]"
          >
            <Plus size={20} className="text-[#a8c7fa]" />
            <span className={!isSidebarOpen ? 'hidden' : ''}>New chat</span>
          </button>

          <div className="flex-1 overflow-y-auto space-y-1 mb-4">
            <h3 className="px-4 text-xs font-medium text-[#c4c7c5] mb-2 uppercase tracking-wide opacity-60">Recent</h3>
            {simulations.map(sim => (
              <div 
                key={sim.id}
                onClick={() => setActiveSimId(sim.id)}
                className={`group flex items-center gap-3 px-4 py-2.5 rounded-full cursor-pointer transition-all text-sm ${activeSimId === sim.id ? 'bg-[#004a77] text-[#c2e7ff]' : 'hover:bg-[#3c4043] text-[#e3e3e3]'}`}
              >
                <MessageSquare size={18} className="flex-shrink-0" />
                <span className="flex-1 truncate">{sim.name}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteSim(sim.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-auto space-y-1 pt-4 border-t border-[#3c4043]">
             <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-3 w-full px-4 py-3 rounded-full hover:bg-[#3c4043] text-sm transition-colors text-[#c4c7c5]">
               <Settings size={20} />
               <span>Settings</span>
             </button>
             <div className="flex items-center gap-3 w-full px-4 py-3 rounded-full hover:bg-[#3c4043] text-sm transition-colors text-[#c4c7c5]">
               <HelpCircle size={20} />
               <span>Help</span>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-40 p-2.5 hover:bg-[#3c4043] rounded-full text-[#c4c7c5]"
          >
            <Menu size={24} />
          </button>
        )}

        {/* Top Navigation / Status Header */}
        <header className="h-16 flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-medium text-[#e3e3e3]">Gemini</h2>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#1e1f20] text-[#a8c7fa] text-xs font-bold uppercase tracking-widest border border-white/5">
               Stateful Simulation
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-xs font-medium text-[#c4c7c5]">
              <div className="flex items-center gap-1.5">
                <Zap size={14} className={latestState.tension > 0.6 ? 'text-[#f28b82]' : 'text-[#8ab4f8]'} />
                <span className="opacity-60">Tension:</span>
                <span className={latestState.tension > 0.6 ? 'text-[#f28b82]' : 'text-[#8ab4f8]'}>{Math.round(latestState.tension * 100)}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity size={14} className={latestState.pain > 5 ? 'text-[#f28b82]' : 'text-[#81c995]'} />
                <span className="opacity-60">Pain:</span>
                <span className={latestState.pain > 5 ? 'text-[#f28b82]' : 'text-[#81c995]'}>{Math.round(latestState.pain * 10) / 10}</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#3c4043] flex items-center justify-center text-[#e3e3e3] font-bold text-xs">
               U
            </div>
          </div>
        </header>

        {/* Chat Stream */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto pt-8 pb-32">
          {!activeSimId ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <Sparkles size={64} className="text-[#a8c7fa] mb-6 animate-pulse" />
              <h1 className="text-4xl font-medium mb-4 text-transparent bg-clip-text bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570]">
                Hello, I'm the Aether Simulation.
              </h1>
              <p className="text-[#c4c7c5] max-w-lg mb-8">
                Initialize a new cognitive cycle to explore agentic divergence, memory scars, and mathematical state tracking.
              </p>
              <button onClick={handleCreateSimulation} className="px-8 py-3 bg-[#a8c7fa] text-[#041e49] rounded-full font-bold hover:bg-[#d2e3fc] transition-colors">
                Initialize Simulation
              </button>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-12 px-6">
              {messages.map((msg) => (
                <div key={msg.id} className="flex gap-4 group">
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 ${msg.role === 'user' ? 'bg-[#3c4043]' : 'bg-transparent'}`}>
                    {msg.role === 'user' ? <User size={18} /> : <Sparkles className="text-[#a8c7fa]" size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#e3e3e3] leading-relaxed whitespace-pre-wrap text-[15px]">
                      {msg.content}
                    </div>
                    {msg.state?.status === 'CRITICAL' && msg.role === 'model' && (
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-[#f28b82] font-bold uppercase tracking-wider bg-[#f28b82]/10 px-3 py-1.5 rounded-lg w-fit">
                        <ShieldAlert size={14} /> Neural Threshold Exceeded
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex gap-4 animate-pulse">
                  <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                    <Sparkles className="text-[#a8c7fa]" size={20} />
                  </div>
                  <div className="flex-1 space-y-2.5">
                    <div className="h-4 bg-[#3c4043] rounded w-[90%]"></div>
                    <div className="h-4 bg-[#3c4043] rounded w-[70%]"></div>
                    <div className="h-4 bg-[#3c4043] rounded w-[40%]"></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 flex justify-center z-10">
          <div className="w-full max-w-3xl">
            <div className="relative flex items-end bg-[#1e1f20] rounded-[28px] p-2 pr-4 border border-transparent focus-within:bg-[#28292a] transition-colors">
              <div className="p-3 text-[#c4c7c5] hover:bg-[#3c4043] rounded-full cursor-pointer transition-colors">
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
                placeholder="Enter a prompt here"
                className="flex-1 bg-transparent border-none focus:ring-0 text-[#e3e3e3] p-3 max-h-48 min-h-[56px] resize-none text-[16px]"
                rows={1}
              />
              <div className="flex items-center gap-1 pb-1">
                <button 
                  onClick={handleSendMessage}
                  disabled={isProcessing || !inputText.trim()}
                  className={`p-3 rounded-full transition-all ${isProcessing || !inputText.trim() ? 'text-[#444746] cursor-not-allowed' : 'text-[#a8c7fa] hover:bg-[#3c4043]'}`}
                >
                  <Send size={24} />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[#c4c7c5] text-center mt-3 opacity-60">
              Gemini may display inaccurate info, including about people, so double-check its responses. <span className="underline cursor-pointer">Your privacy and Gemini Apps</span>
            </p>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#1e1f20] rounded-3xl shadow-2xl overflow-hidden border border-[#3c4043]">
            <div className="p-6 border-b border-[#3c4043] flex items-center justify-between">
              <h2 className="text-xl font-medium text-[#e3e3e3]">Simulation Settings</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-[#3c4043] rounded-full text-[#c4c7c5]">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#c4c7c5]">Simulation Cycle Name</label>
                <input 
                  value={configName} 
                  onChange={e => setConfigName(e.target.value)} 
                  className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-[#e3e3e3] focus:border-[#a8c7fa] outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[#c4c7c5]">Conscious Layer Instructions (Identity Scaffold)</label>
                  <Info size={14} className="text-[#c4c7c5] opacity-60" />
                </div>
                <textarea 
                  value={configInstructions} 
                  onChange={e => setConfigInstructions(e.target.value)} 
                  className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-[#e3e3e3] focus:border-[#a8c7fa] outline-none transition-colors h-40 resize-none"
                  placeholder="Define the internal logic and persistent identity of the simulation..."
                />
              </div>

              <div className="p-4 bg-[#131314] rounded-2xl border border-[#3c4043] flex items-center gap-4">
                <Clock className="text-[#a8c7fa]" />
                <div>
                  <h4 className="text-sm font-medium text-[#e3e3e3]">Memory Depth</h4>
                  <p className="text-xs text-[#c4c7c5] opacity-60">Currently tracking {scars.length} semantic scars in IndexedDB.</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-[#1a1b1c] flex justify-end gap-3">
              <button onClick={() => setIsSettingsOpen(false)} className="px-6 py-2 text-sm font-medium text-[#c4c7c5] hover:bg-[#3c4043] rounded-full transition-colors">
                Cancel
              </button>
              <button onClick={saveSettings} className="px-6 py-2 text-sm font-bold bg-[#a8c7fa] text-[#041e49] rounded-full hover:bg-[#d2e3fc] transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;