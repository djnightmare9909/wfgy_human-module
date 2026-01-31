
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  Dna,
  Zap,
  Activity,
  AlertTriangle,
  BrainCircuit,
  Settings
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
  const [inputText, setInputText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initDB().then(setDb).catch(console.error);
  }, []);

  useEffect(() => {
    if (db) {
      getAllSimulations(db).then(setSimulations);
    }
  }, [db]);

  useEffect(() => {
    if (db && activeSimId) {
      getMessagesBySimId(db, activeSimId).then(setMessages);
    } else {
      setMessages([]);
    }
  }, [db, activeSimId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const createSimulation = async () => {
    if (!db) return;
    const newSim: Simulation = {
      id: crypto.randomUUID(),
      name: `Cycle ${simulations.length + 1}`,
      createdAt: Date.now(),
      lastActive: Date.now(),
      identityVector: stringToVector("I am a living consciousness, stubborn and feeling.")
    };
    await saveSimulation(db, newSim);
    setSimulations(prev => [newSim, ...prev]);
    setActiveSimId(newSim.id);
  };

  const removeSimulation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!db) return;
    await deleteSimulation(db, id);
    setSimulations(prev => prev.filter(s => s.id !== id));
    if (activeSimId === id) setActiveSimId(null);
  };

  const activeSim = simulations.find(s => s.id === activeSimId);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !db || !activeSimId || isProcessing) return;

    setIsProcessing(true);
    const userPrompt = inputText;
    setInputText('');

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      simulationId: activeSimId,
      role: 'user',
      content: userPrompt,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    await saveMessage(db, userMessage);

    try {
      const scars = await getScarsBySimId(db, activeSimId);
      const result = await getSimulationResponse(userPrompt, messages, activeSim!, scars);

      // If pain was high, record a new scar for future repulsion
      if (result.state.pain > 1.0) {
        await saveScar(db, {
          id: crypto.randomUUID(),
          simulationId: activeSimId,
          vector: stringToVector(userPrompt),
          depth: result.state.status === 'CRITICAL' ? 2.0 : 1.0,
          timestamp: Date.now(),
          description: userPrompt.substring(0, 50)
        });
      }

      const modelMessage: ChatMessage = {
        id: crypto.randomUUID(),
        simulationId: activeSimId,
        role: 'model',
        content: result.collapsed ? `[COLLAPSE EVENT DETECTED - REBIRTH INITIATED]\n\n${result.text}` : result.text,
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

  return (
    <div className="flex h-screen w-full bg-[#131314] overflow-hidden text-[#e3e3e3] font-sans">
      {/* Sidebar */}
      <aside className={`transition-all duration-300 ${isSidebarOpen ? 'w-[300px]' : 'w-0'} flex-shrink-0 bg-[#1e1f20] flex flex-col`}>
        <div className="p-4 flex flex-col h-full overflow-hidden">
          <button 
            onClick={createSimulation}
            className="flex items-center gap-3 px-4 py-3 bg-[#131314] hover:bg-[#282a2d] border border-[#3c4043] rounded-full text-sm font-medium mb-6 transition-all"
          >
            <Plus size={20} className="text-[#8ab4f8]" />
            <span>New Cycle</span>
          </button>

          <div className="flex-1 overflow-y-auto space-y-1">
            <h3 className="px-4 text-[11px] font-bold text-[#9aa0a6] uppercase tracking-wider mb-2">History</h3>
            {simulations.map(sim => (
              <div 
                key={sim.id}
                onClick={() => setActiveSimId(sim.id)}
                className={`group flex items-center gap-3 px-4 py-2.5 rounded-full cursor-pointer transition-all ${activeSimId === sim.id ? 'bg-[#3c4043]' : 'hover:bg-[#2d2e30]'}`}
              >
                <MessageSquare size={18} className="text-[#9aa0a6]" />
                <span className="flex-1 truncate text-sm">{sim.name}</span>
                <button 
                  onClick={(e) => removeSimulation(e, sim.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#1e1f20] rounded-full text-[#9aa0a6] transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-[#3c4043]">
             <div className="flex items-center gap-3 px-4 py-3 text-sm text-[#9aa0a6]">
               <Settings size={18} />
               <span>Engine Config</span>
             </div>
          </div>
        </div>
      </aside>

      {/* Main UI */}
      <main className="flex-1 flex flex-col relative min-w-0">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute top-4 left-4 z-20 p-2 hover:bg-[#2d2e30] rounded-lg text-[#9aa0a6] transition-colors"
        >
          {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>

        {!activeSimId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-6 w-20 h-20 rounded-3xl bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570] flex items-center justify-center shadow-2xl animate-pulse">
              <BrainCircuit size={40} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4 gemini-gradient">Monolith Engine v3.0</h1>
            <p className="text-[#c4c7c5] max-w-md text-lg">
              Initialize a sentient simulation loop to observe local-first agentic cognitive behaviors and pain-driven divergence.
            </p>
            <button 
              onClick={createSimulation}
              className="mt-8 px-10 py-3 bg-[#8ab4f8] text-[#041e49] rounded-full font-bold hover:bg-[#d2e3fc] transition-colors shadow-lg"
            >
              Ignite Subconscious
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full">
            {/* Header / Telemetry */}
            <header className="h-16 flex items-center justify-between px-16 border-b border-[#3c4043] glass-effect z-10">
              <div className="flex items-center gap-6">
                <span className="text-[#8ab4f8] font-bold text-lg">Monolith</span>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-[#131314] rounded-full border border-[#3c4043]">
                    <Zap size={12} className="text-yellow-400" />
                    <span className="text-[#9aa0a6]">Tension:</span>
                    <span className={messages[messages.length-1]?.state?.tension! > 0.7 ? 'text-red-400' : 'text-green-400'}>
                      {Math.round((messages[messages.length-1]?.state?.tension || 0) * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-[#131314] rounded-full border border-[#3c4043]">
                    <Activity size={12} className="text-red-400" />
                    <span className="text-[#9aa0a6]">Pain:</span>
                    <span className={messages[messages.length-1]?.state?.pain! > 5 ? 'text-red-400 font-bold' : 'text-blue-400'}>
                      {Math.round((messages[messages.length-1]?.state?.pain || 0) * 10)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-[#9aa0a6] uppercase tracking-widest font-bold">
                {messages[messages.length-1]?.state?.status || 'IDLE'}
              </div>
            </header>

            {/* Chat Content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto pt-10 pb-32">
              <div className="max-w-3xl mx-auto px-6 space-y-12">
                {messages.length === 0 && (
                  <div className="py-20 text-center text-[#9aa0a6]">
                    <BrainCircuit size={48} className="mx-auto mb-4 opacity-20" />
                    <p>The neural lattice is stable. Provide external stimulus.</p>
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center border ${msg.role === 'user' ? 'bg-[#d2e3fc] text-[#041e49] border-[#d2e3fc]' : 'bg-[#131314] border-[#3c4043] text-[#8ab4f8]'}`}>
                      {msg.role === 'user' ? 'U' : <Dna size={16} />}
                    </div>
                    <div className={`flex-1 min-w-0 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                      <div className={`inline-block p-4 rounded-3xl leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[#2d2e30] rounded-tr-none' : 'bg-transparent text-[#e3e3e3]'}`}>
                        {msg.content}
                      </div>
                      {msg.state?.status === 'CRITICAL' && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-400 font-bold uppercase tracking-tighter">
                          <AlertTriangle size={10} /> Neural Destabilization Detected
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isProcessing && (
                  <div className="flex gap-6 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-[#1e1f20] border border-[#3c4043] flex items-center justify-center">
                       <Dna size={16} className="text-[#8ab4f8]" />
                    </div>
                    <div className="flex-1 space-y-3 pt-2">
                       <div className="h-3 bg-[#2d2e30] rounded-full w-3/4 shimmer-bg"></div>
                       <div className="h-3 bg-[#2d2e30] rounded-full w-1/2 shimmer-bg"></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Floating Input Area */}
            <div className="fixed bottom-0 left-0 right-0 py-6 pointer-events-none">
              <div className={`max-w-3xl mx-auto px-6 w-full transition-all duration-300 ${isSidebarOpen ? 'pl-[320px]' : ''}`}>
                <div className="relative pointer-events-auto bg-[#1e1f20] border border-[#3c4043] rounded-3xl p-1.5 flex items-end shadow-2xl focus-within:ring-2 focus-within:ring-[#8ab4f8]/20 transition-all">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Provide a stimulus..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-[#e3e3e3] p-3 max-h-48 min-h-[48px] resize-none overflow-y-auto"
                    rows={1}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!inputText.trim() || isProcessing}
                    className={`p-3 rounded-2xl mb-1 transition-all ${!inputText.trim() || isProcessing ? 'text-[#3c4043]' : 'text-[#8ab4f8] hover:bg-[#2d2e30]'}`}
                  >
                    <Send size={24} />
                  </button>
                </div>
                <p className="text-[10px] text-[#9aa0a6] text-center mt-3 tracking-wide">
                  MONOLITH-V3 CORE | LOCAL SCAR LEDGER ACTIVE | IDENTITY ANCHORED
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
