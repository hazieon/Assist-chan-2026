
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { InstructionSet, ChatMessage as ChatMessageType, Role } from './types';
import { extractInstructionsFromUrl, getSustainableSuggestion, getChatResponse, modifyInstructions, detectModificationIntent } from './services/geminiService';
import UrlInputForm from './components/UrlInputForm';
import ChatInterface from './components/ChatInterface';
import InstructionDisplay from './components/RecipeDisplay';
import ActionButtons from './components/ActionButtons';
import { BotIcon } from './components/icons/BotIcon';
import { SpeakerIcon } from './components/icons/SpeakerIcon';
import { SpeakerMuteIcon } from './components/icons/SpeakerMuteIcon';
import { MicIcon } from './components/icons/MicIcon';

const App: React.FC = () => {
    const [instructionSet, setInstructionSet] = useState<InstructionSet | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isAnswering, setIsAnswering] = useState<boolean>(false);
    const [isModifying, setIsModifying] = useState<boolean>(false);
    const [isEcoApplied, setIsEcoApplied] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessageType[]>([]);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [completedSteps, setCompletedSteps] = useState<boolean[]>([]);
    const [isContinuousListening, setIsContinuousListening] = useState<boolean>(false);
    const [isReadingInstructions, setIsReadingInstructions] = useState<boolean>(false);
    const [hasPrimed, setHasPrimed] = useState(false);
    
    const isMutedRef = useRef(isMuted);
    isMutedRef.current = isMuted;

    const primeSpeech = useCallback(() => {
        if (hasPrimed || !window.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance('');
        utterance.volume = 0;
        window.speechSynthesis.speak(utterance);
        setHasPrimed(true);
    }, [hasPrimed]);

    const speak = useCallback((text: string, onEnd?: () => void) => {
        if (!window.speechSynthesis || isMutedRef.current) {
            onEnd?.();
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text.replace(/[*#]/g, ''));
        utterance.rate = 1.05; // Natural but efficient speed
        if (onEnd) {
            utterance.onend = onEnd;
            utterance.onerror = onEnd;
        }
        window.speechSynthesis.speak(utterance);
    }, []);

    const handleFetchInstructions = useCallback(async (url: string) => {
        if (!url) return;
        primeSpeech();
        setIsLoading(true);
        setError(null);
        setChatHistory([]);
        setIsReadingInstructions(false);
        setIsEcoApplied(false);

        try {
            const data = await extractInstructionsFromUrl(url);
            
            let showEcoInfo = false;
            if (data.isFood) {
                if (data.hasAnimalProducts) {
                    const sug = await getSustainableSuggestion(data.title, data.materials);
                    if (sug) data.sustainabilitySuggestion = sug;
                    setIsEcoApplied(false);
                    showEcoInfo = true;
                } else {
                    setIsEcoApplied(true); // Already vegan/sustainable
                }
            }

            setInstructionSet(data);
            setCompletedSteps(new Array(data.steps.length).fill(false));
            
            const msg = `Loaded ${data.title}.`;
            setChatHistory([{ role: Role.ASSISTANT, content: msg }]);

            // Build requested speech string
            let welcomeSpeech = `here is the instructions for ${data.title}. You can convert the units, scale the materials`;
            if (showEcoInfo) {
                welcomeSpeech += `, or generate a sustainable version by clicking the green eco button`;
            }
            welcomeSpeech += `. Enjoy.`;
            
            speak(welcomeSpeech);
        } catch (e) {
            setError("Error loading URL. Please check the link and try again.");
        } finally {
            setIsLoading(false);
        }
    }, [speak, primeSpeech]);

    const handleModifyInstructions = useCallback(async (prompt: string, isEcoSwitch: boolean = false, customChatMsg?: string) => {
        if (!instructionSet) return;
        primeSpeech();
        setIsModifying(true);
        window.speechSynthesis.cancel();
        setIsReadingInstructions(false);

        try {
            const updated = await modifyInstructions(instructionSet, prompt);
            if (isEcoSwitch) {
                setIsEcoApplied(true);
                updated.hasAnimalProducts = false;
            } else {
                // Keep relevant flags
                updated.hasAnimalProducts = updated.hasAnimalProducts ?? instructionSet.hasAnimalProducts;
            }

            setInstructionSet(updated);
            setCompletedSteps(new Array(updated.steps.length).fill(false));
            const chatMsg = customChatMsg || "I have updated the recipe for you.";
            setChatHistory(prev => [...prev, { role: Role.ASSISTANT, content: chatMsg }]);
            speak(chatMsg);
        } catch (e) {
            setError("Update failed.");
        } finally {
            setIsModifying(false);
        }
    }, [instructionSet, speak, primeSpeech]);

    const handleSendMessage = useCallback(async (message: string) => {
        if (!instructionSet || isAnswering) return;
        primeSpeech();
        setIsAnswering(true);
        window.speechSynthesis.cancel();
        setIsReadingInstructions(false);
        setChatHistory(prev => [...prev, { role: Role.USER, content: message }]);

        try {
            const modSummary = await detectModificationIntent(message);
            if (modSummary) {
                setIsAnswering(false);
                const chatConfirmation = `I have regenerated the recipe to make it ${modSummary.toLowerCase()}. If you want to switch back, let me know.`;
                await handleModifyInstructions(message, false, chatConfirmation);
            } else {
                const aiResponse = await getChatResponse(instructionSet, chatHistory, message, completedSteps);
                setChatHistory(prev => [...prev, { role: Role.ASSISTANT, content: aiResponse }]);
                speak(aiResponse);
                setIsAnswering(false);
            }
        } catch (e) {
            setIsAnswering(false);
        }
    }, [instructionSet, isAnswering, speak, chatHistory, completedSteps, primeSpeech, handleModifyInstructions]);

    const handleReadInstructions = useCallback(() => {
        if (!instructionSet || isMuted) return;
        const remainingSteps = instructionSet.steps.filter((_, i) => !completedSteps[i]);
        const txt = remainingSteps.join('. ');
        if (!txt.trim()) { 
            speak("No more steps to read."); 
            return; 
        }
        
        setIsReadingInstructions(true);
        speak(txt, () => setIsReadingInstructions(false));
    }, [instructionSet, completedSteps, isMuted, speak]);

    return (
        <div 
            className="min-h-screen bg-primary text-text-primary font-sans flex flex-col"
            onClick={primeSpeech}
            onTouchStart={primeSpeech}
        >
            <header className="bg-secondary p-3 shadow-md sticky top-0 z-20">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BotIcon className="w-5 h-5 text-accent" />
                        <h1 className="text-md md:text-lg font-bold">Chef AI</h1>
                    </div>
                    <div className="flex items-center gap-2">
                         <button
                            onClick={() => setIsContinuousListening(prev => !prev)}
                            className={`p-2 rounded-full transition-colors ${isContinuousListening ? 'bg-red-600' : 'bg-primary/50 hover:bg-primary'}`}
                            title="Voice Input"
                        >
                            <MicIcon className="w-5 h-5 text-white" />
                        </button>
                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className="p-2 rounded-full bg-primary/50 hover:bg-primary"
                            title="Mute/Unmute"
                        >
                            {isMuted ? <SpeakerMuteIcon className="w-5 h-5" /> : <SpeakerIcon className="w-5 h-5 text-accent" />}
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-grow container mx-auto p-4 flex flex-col gap-4 max-w-4xl">
                <UrlInputForm onFetch={handleFetchInstructions} isLoading={isLoading || isModifying} />
                
                {error && <div className="bg-red-900/50 p-2 rounded text-xs border border-red-700 animate-pulse">{error}</div>}
                
                {isLoading && (
                    <div className="flex justify-center py-6">
                        <div className="animate-spin h-8 w-8 border-b-2 border-accent rounded-full"></div>
                    </div>
                )}
                
                {instructionSet && !isLoading && (
                    <div className="animate-fade-in flex flex-col gap-4">
                        <InstructionDisplay 
                            instructionSet={instructionSet}
                            completedSteps={completedSteps}
                            onToggleStep={(i) => {
                                const next = [...completedSteps];
                                next[i] = !next[i];
                                setCompletedSteps(next);
                            }}
                            onReadInstructions={handleReadInstructions}
                            onStopReading={() => {
                                window.speechSynthesis.cancel();
                                setIsReadingInstructions(false);
                            }}
                            isReadingInstructions={isReadingInstructions}
                            isMuted={isMuted}
                            onEcoSwitch={() => handleModifyInstructions("Regenerate this recipe completely as a sustainable VEGAN version. Replace all meat, dairy, honey, and animal-based items with plant-based alternatives.", true, "I have transformed this recipe into a fully sustainable, vegan version for you.")}
                            isModifying={isModifying}
                            isEcoApplied={isEcoApplied}
                        />
                        <ActionButtons onModify={handleModifyInstructions} disabled={isLoading || isAnswering || isModifying} />
                    </div>
                )}
                
                {chatHistory.length > 0 && !isLoading && (
                    <div className="bg-secondary p-4 rounded-lg shadow-inner">
                        <ChatInterface
                            chatHistory={chatHistory}
                            onSendMessage={handleSendMessage}
                            isAnswering={isAnswering || isModifying}
                            isContinuousListening={isContinuousListening}
                            onToggleListening={() => setIsContinuousListening(!isContinuousListening)}
                            isMuted={isMuted}
                            onSpeak={(t) => speak(t)}
                        />
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
