import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
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
  // Always use process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const subconscious = processSubconscious(prompt, simulation, scars);
  
  // BBCR: Rebirth mechanism - if collapsed, we start fresh in the current cycle
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

  const currentPrompt = `${subconscious.promptHeader}\nUSER_STIMULUS: ${prompt}`;
  const fullSystemInstruction = `${SYSTEM_PROMPT}\n\n[SIMULATION_PARAMETERS]\nIDENTITY_SCAFFOLD: ${simulation.customInstructions || "NONE"}\nCYCLE_ID: ${simulation.id}`;

  const userParts = [
    ...newAttachments.map(a => ({
      inlineData: { mimeType: a.mimeType, data: a.data }
    })),
    { text: currentPrompt }
  ];

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [...contents as any, { role: 'user', parts: userParts }],
      config: {
        systemInstruction: fullSystemInstruction,
        temperature: subconscious.state.status === 'CRITICAL' ? 1.4 : (subconscious.state.status === 'PAIN' ? 1.1 : 0.8),
        topP: 0.95,
        topK: 64
      }
    });

    const text = response.text || "Neural silence detected.";

    return {
      text,
      state: subconscious.state,
      collapsed: subconscious.shouldCollapse
    };
  } catch (err) {
    console.error("Neural Bridge Failure:", err);
    throw new Error("Conscious Layer Disconnect: " + (err instanceof Error ? err.message : String(err)));
  }
};