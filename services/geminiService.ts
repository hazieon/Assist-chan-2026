
import { GoogleGenAI, Content, Type } from '@google/genai';
import { InstructionSet, ChatMessage, Role } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const FAST_MODEL = 'gemini-3-flash-preview';

export const extractInstructionsFromUrl = async (url: string): Promise<InstructionSet> => {
    const prompt = `URL: ${url}. Extract instructions. JSON: {"title":string, "materials":string[], "steps":string[], "isFood":boolean, "hasAnimalProducts":boolean}. Identify if ingredients contain meat, dairy, eggs, or honey (hasAnimalProducts). No extra text.`;

    try {
        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json"
            },
        });
        
        const parsed = JSON.parse(response.text.trim()) as InstructionSet;
        
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
            parsed.sources = chunks.map(c => c.web).filter(w => w?.uri) as { uri: string, title: string }[];
        }

        return parsed;
    } catch (error) {
        console.error("Extraction error:", error);
        throw new Error("Fast extraction failed.");
    }
};

export const detectModificationIntent = async (message: string): Promise<string | null> => {
    const prompt = `User: "${message}". Modification (ingredients/recipe change)? If yes, 3-word summary. If no, "FALSE".`;
    try {
        const response = await ai.models.generateContent({ model: FAST_MODEL, contents: prompt });
        const result = response.text.trim();
        return result.toUpperCase() === 'FALSE' ? null : result;
    } catch (error) {
        return null;
    }
};

export const modifyInstructions = async (
    instructions: InstructionSet,
    modificationPrompt: string
): Promise<InstructionSet> => {
    const prompt = `Update JSON for: "${modificationPrompt}". Current: ${JSON.stringify(instructions)}. Return updated JSON only. If vegan swap: remove ALL animal products (meat/dairy/eggs).`;

    try {
        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        const parsed = JSON.parse(response.text.trim()) as InstructionSet;
        parsed.isFood = instructions.isFood;
        if (instructions.sources) parsed.sources = instructions.sources;
        if (instructions.sustainabilitySuggestion) parsed.sustainabilitySuggestion = instructions.sustainabilitySuggestion;
        
        return parsed;
    } catch (error) {
        throw new Error("Update failed.");
    }
};

export const getSustainableSuggestion = async (title: string, materials: string[]): Promise<string | null> => {
    const prompt = `Recipe: "${title}". Give one very brief vegan alternative idea (5-10 words).`;
    try {
        const response = await ai.models.generateContent({ model: FAST_MODEL, contents: prompt });
        return response.text.trim();
    } catch (error) {
        return null;
    }
};

export const getChatResponse = async (
    instructions: InstructionSet,
    history: ChatMessage[],
    newMessage: string,
    completedSteps: boolean[]
): Promise<string> => {
    const done = completedSteps.map((v, i) => v ? i + 1 : -1).filter(i => i !== -1);
    const system = `Assistant for: ${instructions.title}. Steps: ${instructions.steps.length}. Done: ${done.join(',')}. Concise answer only.`;

    const contents: Content[] = [
        ...history.map(msg => ({
            role: msg.role === Role.USER ? 'user' : 'model' as any,
            parts: [{ text: msg.content }],
        })),
        { role: 'user', parts: [{ text: newMessage }] }
    ];

    try {
        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: contents,
            config: { systemInstruction: system }
        });
        return response.text;
    } catch (error) {
        return "I'm sorry, I can't answer that right now.";
    }
};
