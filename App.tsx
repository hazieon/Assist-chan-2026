
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { InstructionSet, ChatMessage as ChatMessageType, Role } from './types';
import { extractInstructionsFromUrl, getSustainableSuggestion, getChatResponse, modifyInstructions } from './services/geminiService';
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
    const readingUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Critical for Mobile: Unlock SpeechSynthesis on first user interaction
    const primeSpeech = useCallback(() => {
        if (hasPrimed || !window.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance('');
        utterance.volume = 0;
        window.speechSynthesis.speak(utterance);
        setHasPrimed(true);
        console.log('Speech primed for mobile');
    }, [hasPrimed]);

    const handleToggleStep = (index: number) => {
        setCompletedSteps(prev => {
            const newCompleted = [...prev];
            newCompleted[index] = !newCompleted[index];
            return newCompleted;
        });
    };
    
    const speak = useCallback((text: string) => {
        if (!window.speechSynthesis || isMutedRef.current) return;
        
        // Stop any current speech
        window.speechSynthesis.cancel();
        
        // Clean text for cleaner TTS
        const cleanText = text.replace(/\*\*/g, '').replace(/#/g, '').replace(/\[.*?\]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        // Mobile browsers (Safari/Chrome) specific settings for clarity
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        // Force a brief delay for some mobile browsers to register the cancelation
        setTimeout(() => {
            window.speechSynthesis.speak(utterance);
        }, 50);
    }, []);

    const handleFetchInstructions = useCallback(async (url: string) => {
        if (!url) {
            setError('Please enter a valid URL.');
            return;
        }
        
        primeSpeech();
        setIsLoading(true);
        setError(null);
        setInstructionSet(null);
        setChatHistory([]);
        setCompletedSteps([]);
        setIsEcoApplied(false);
        window.speechSynthesis.cancel();
        setIsReadingInstructions(false);

        try {
            const extractedInstructions = await extractInstructionsFromUrl(url);
            const suggestion = await getSustainableSuggestion(extractedInstructions.title, extractedInstructions.materials);
            
            if (suggestion) {
                extractedInstructions.sustainabilitySuggestion = suggestion;
            }

            setInstructionSet(extractedInstructions);
            setCompletedSteps(new Array(extractedInstructions.steps.length).fill(false));
            
            const welcomeMessageText = `I have loaded the instructions for **${extractedInstructions.title}**. How can I help?`;
            const welcomeMessage: ChatMessageType = { role: Role.ASSISTANT, content: welcomeMessageText };
            let initialChat: ChatMessageType[] = [welcomeMessage];
            
            if (suggestion) {
                const suggestionMessage: ChatMessageType = { 
                    role: Role.ASSISTANT, 
                    content: `**Sustainability Suggestion:** ${suggestion}` 
                };
                initialChat.push(suggestionMessage);
            }
            
            setChatHistory(initialChat);
            
            let speechCombined = welcomeMessageText;
            if (suggestion) {
                speechCombined += `. Here is a suggestion: ${suggestion}. Use the green eco button if you want to swap.`;
            }
            speak(speechCombined);

        } catch (e) {
            console.error(e);
            setError(`Failed to process instructions. Please try another link.`);
        } finally {
            setIsLoading(false);
        }
    }, [speak, primeSpeech]);

    const handleModifyInstructions = useCallback(async (prompt: string, isEcoSwitch: boolean = false) => {
        if (!instructionSet) return;

        primeSpeech();
        setIsModifying(true);
        setError(null);

        try {
            const newInstructionSet = await modifyInstructions(instructionSet, prompt);
            
            if (isEcoSwitch) {
                setIsEcoApplied(true);
                newInstructionSet.sustainabilitySuggestion = undefined;
            }

            setInstructionSet(newInstructionSet);
            setCompletedSteps(new Array(newInstructionSet.steps.length).fill(false));

            const confirmationMessage: ChatMessageType = {
                role: Role.ASSISTANT,
                content: `Recipe updated. You can see the new ${isEcoApplied ? 'vegan ' : ''}instructions above.`
            };
            setChatHistory(prev => [...prev, confirmationMessage]);
            speak(confirmationMessage.content);

        } catch (e) {
            console.error(e);
            setError(`Error updating instructions.`);
        } finally {
            setIsModifying(false);
        }
    }, [instructionSet, speak, primeSpeech, isEcoApplied]);

    const handleEcoSwitch = useCallback(() => {
        if (isEcoApplied || !instructionSet) return;
        
        const prompt = `REGENERATE THE ENTIRE RECIPE. 
        MANDATORY: Remove ALL animal-based products (meat, fish, eggs, dairy, honey). 
        REPLACE: Use sustainable plant-based alternatives. 
        UPDATE MATERIALS AND STEPS COMPLETELY.
        GUIDANCE: ${instructionSet.sustainabilitySuggestion || "Transform this into a vegan version."}`;

        handleModifyInstructions(prompt, true);
    }, [instructionSet, isEcoApplied, handleModifyInstructions]);

    const handleSendMessage = useCallback(async (message: string) => {
        if (!instructionSet || isAnswering) return;

        primeSpeech();
        setIsAnswering(true);
        window.speechSynthesis.cancel();
        setIsReadingInstructions(false);
        const userMessage: ChatMessageType = { role: Role.USER, content: message };
        setChatHistory(prev => [...prev, userMessage]);

        try {
            const aiResponse = await getChatResponse(
                instructionSet,
                chatHistory,
                message,
                completedSteps
            );
            
            const assistantMessage: ChatMessageType = { role: Role.ASSISTANT, content: aiResponse };
            setChatHistory(prev => [...prev, assistantMessage]);
            speak(aiResponse);

        } catch (e) {
            console.error(e);
            const errorResponse: ChatMessageType = { role: Role.ASSISTANT, content: `I'm sorry, I'm having trouble processing that right now.` };
            setChatHistory(prev => [...prev, errorResponse]);
        } finally {
            setIsAnswering(false);
        }
    }, [instructionSet, isAnswering, speak, chatHistory, completedSteps, primeSpeech]);
    
    const handleToggleMute = () => {
        setIsMuted(prev => {
            const newMutedState = !prev;
            if (newMutedState) {
                window.speechSynthesis.cancel();
                setIsReadingInstructions(false);
            } else {
                primeSpeech();
            }
            return newMutedState;
        });
    };

    const handleReadInstructions = useCallback(() => {
        if (!instructionSet || isMuted) return;

        primeSpeech();
        window.speechSynthesis.cancel();
        
        const textToSpeak = instructionSet.steps
            .filter((_, index) => !completedSteps[index])
            .join('. ');

        if (!textToSpeak.trim()) {
            speak("All steps are done.");
            return;
        }

        const cleanText = textToSpeak.replace(/\*\*/g, '').replace(/#/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        readingUtteranceRef.current = utterance;

        utterance.onstart = () => setIsReadingInstructions(true);
        utterance.onend = () => {
            setIsReadingInstructions(false);
            readingUtteranceRef.current = null;
        };
        utterance.onerror = () => {
            setIsReadingInstructions(false);
            readingUtteranceRef.current = null;
        };

        window.speechSynthesis.speak(utterance);
    }, [instructionSet, completedSteps, isMuted, speak, primeSpeech]);

    const handleStopReading = useCallback(() => {
        window.speechSynthesis.cancel();
        setIsReadingInstructions(false);
        readingUtteranceRef.current = null;
    }, []);

    useEffect(() => {
        return () => {
            window.speechSynthesis.cancel();
        };
    }, []);
    
    const isBusy = isLoading || isAnswering || isModifying;

    return (
        <div 
            className="min-h-screen bg-primary text-text-primary font-sans flex flex-col"
            onClick={primeSpeech}
            onTouchStart={primeSpeech}
        >
            <header className="bg-secondary p-4 shadow-md sticky top-0 z-20">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BotIcon className="w-6 h-6 text-accent" />
                        <h1 className="text-lg md:text-xl font-bold truncate max-w-[150px] sm:max-w-none">AI Instructions</h1>
                    </div>
                    <div className="flex items-center gap-2">
                         <button
                            onClick={() => { primeSpeech(); setIsContinuousListening(prev => !prev); }}
                            className={`p-2 rounded-full relative transition-colors ${
                                isContinuousListening ? 'bg-red-600' : 'hover:bg-primary'
                            }`}
                            aria-label={isContinuousListening ? 'Stop listening' : 'Start listening'}
                        >
                            <MicIcon className="w-5 h-5 text-white" />
                            {isContinuousListening && (
                                <span className="animate-ping absolute top-0 left-0 inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            )}
                        </button>
                        <button
                            onClick={handleToggleMute}
                            className="p-2 rounded-full hover:bg-primary transition-colors"
                            aria-label={isMuted ? 'Enable audio' : 'Mute audio'}
                        >
                            {isMuted ? (
                                <SpeakerMuteIcon className="w-5 h-5 text-text-secondary" />
                            ) : (
                                <SpeakerIcon className="w-5 h-5 text-accent" />
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6 max-w-4xl">
                <UrlInputForm onFetch={handleFetchInstructions} isLoading={isLoading || isModifying} />
                
                {error && <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded-lg text-sm">{error}</div>}
                
                {isLoading && (
                    <div className="flex justify-center items-center py-10">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
                    </div>
                )}
                
                {instructionSet && !isLoading && (
                    <div className="flex flex-col gap-6 animate-fade-in">
                        <InstructionDisplay 
                            instructionSet={instructionSet}
                            completedSteps={completedSteps}
                            onToggleStep={handleToggleStep}
                            onReadInstructions={handleReadInstructions}
                            onStopReading={handleStopReading}
                            isReadingInstructions={isReadingInstructions}
                            isMuted={isMuted}
                            onEcoSwitch={handleEcoSwitch}
                            isModifying={isModifying}
                            isEcoApplied={isEcoApplied}
                        />
                        <ActionButtons onModify={handleModifyInstructions} disabled={isBusy} />
                    </div>
                )}
                
                {chatHistory.length > 0 && !isLoading && (
                    <div className="bg-secondary p-4 md:p-6 rounded-lg shadow-lg flex-shrink-0">
                        <h2 className="text-lg md:text-xl font-bold mb-4 text-accent">Voice Chat Assistant</h2>
                        <ChatInterface
                            chatHistory={chatHistory}
                            onSendMessage={handleSendMessage}
                            isAnswering={isAnswering || isModifying}
                            isContinuousListening={isContinuousListening}
                            onToggleListening={() => { primeSpeech(); setIsContinuousListening(prev => !prev); }}
                            isMuted={isMuted}
                            onSpeak={speak}
                        />
                    </div>
                )}
            </main>
            
            <footer className="p-4 text-center text-xs text-text-secondary">
                Designed for mobile & desktop. 2026 Instructions Assistant.
            </footer>
        </div>
    );
};

export default App;
