
import { GoogleGenAI } from "@google/genai";
import { ChatMessage, Simulation, Scar } from "./types";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { processSubconscious } from "./logic";

export const getSimulationResponse = async (
  prompt: string,
  history: ChatMessage[],
  simulation: Simulation,
  scars: Scar[]
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const subconscious = processSubconscious(prompt, simulation, scars);
  
  // BBCR: Rebirth mechanism - if collapsed, we clear memory and start fresh
  const activeHistory = subconscious.shouldCollapse ? [] : history;

  const contents = activeHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  // Inject current sensory input as a hidden header
  const currentPrompt = `${subconscious.promptHeader}\nUSER: ${prompt}`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [...contents, { role: 'user', parts: [{ text: currentPrompt }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: subconscious.state.status === 'CRITICAL' ? 1.2 : 0.8,
    }
  });

  return {
    text: response.text || '',
    state: subconscious.state,
    collapsed: subconscious.shouldCollapse
  };
};
