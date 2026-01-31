
import { GoogleGenAI } from "@google/genai";
import { ChatMessage, Simulation, Scar, Attachment } from "./types";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { processSubconscious } from "./logic";

export const getSimulationResponse = async (
  prompt: string,
  history: ChatMessage[],
  simulation: Simulation,
  scars: Scar[],
  newAttachments: Attachment[] = []
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const subconscious = processSubconscious(prompt, simulation, scars);
  
  // BBCR: Rebirth mechanism - if collapsed, we clear memory and start fresh
  const activeHistory = subconscious.shouldCollapse ? [] : history;

  const contents = activeHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [
      ...(msg.attachments || []).map(a => ({
        inlineData: { mimeType: a.mimeType, data: a.data }
      })),
      { text: msg.content }
    ]
  }));

  // Inject current sensory input as a hidden header
  const currentPrompt = `${subconscious.promptHeader}\nUSER: ${prompt}`;
  
  // Combine system prompt with per-simulation instructions
  const fullSystemInstruction = `${SYSTEM_PROMPT}\n\nCORE DIRECTIVES FOR THIS CYCLE:\n${simulation.customInstructions || "No additional directives."}`;

  const userParts = [
    ...newAttachments.map(a => ({
      inlineData: { mimeType: a.mimeType, data: a.data }
    })),
    { text: currentPrompt }
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [...contents as any, { role: 'user', parts: userParts }],
    config: {
      systemInstruction: fullSystemInstruction,
      temperature: subconscious.state.status === 'CRITICAL' ? 1.2 : 0.8,
    }
  });

  return {
    text: response.text || '',
    state: subconscious.state,
    collapsed: subconscious.shouldCollapse
  };
};
