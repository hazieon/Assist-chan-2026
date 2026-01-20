import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage as ChatMessageType } from '../types';
import ChatMessage from './ChatMessage';
import { MicIcon } from './icons/MicIcon';
import { SendIcon } from './icons/SendIcon';

// Fix: Add TypeScript definitions for the Web Speech API to prevent type errors.
declare global {
    interface SpeechRecognition extends EventTarget {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        start(): void;
        stop(): void;
        // FIX: Add the `abort` method to the SpeechRecognition interface definition.
        abort(): void;
        onstart: () => void;
        onresult: (event: SpeechRecognitionEvent) => void;
        onerror: (event: SpeechRecognitionErrorEvent) => void;
        onend: () => void;
    }

    interface SpeechRecognitionEvent extends Event {
        resultIndex: number;
        results: SpeechRecognitionResultList;
    }

    interface SpeechRecognitionResultList {
        [index: number]: SpeechRecognitionResult;
        // FIX: Add `readonly` modifier to match DOM API and resolve type error.
        readonly length: number;
    }

    interface SpeechRecognitionResult {
        [index: number]: SpeechRecognitionAlternative;
        // FIX: Add `readonly` modifier to match DOM API and resolve type error.
        readonly isFinal: boolean;
        // FIX: Add `readonly` modifier to match DOM API and resolve type error.
        readonly length: number;
    }

    interface SpeechRecognitionAlternative {
        // FIX: Add `readonly` modifier to match DOM API and resolve type error.
        readonly transcript: string;
        // FIX: Add `readonly` modifier to match DOM API and resolve type error.
        readonly confidence: number;
    }

    interface SpeechRecognitionErrorEvent extends Event {
        error: string;
    }

    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}


interface ChatInterfaceProps {
    chatHistory: ChatMessageType[];
    onSendMessage: (message: string) => void;
    isAnswering: boolean;
    isContinuousListening: boolean;
    onToggleListening: () => void;
    isMuted: boolean;
    onSpeak: (text: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ chatHistory, onSendMessage, isAnswering, isContinuousListening, onToggleListening, isMuted, onSpeak }) => {
    const [message, setMessage] = useState('');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const isContinuousListeningRef = useRef(isContinuousListening);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    
    isContinuousListeningRef.current = isContinuousListening;

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);
    
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech recognition not supported in this browser.");
            return;
        }
        
        recognitionRef.current = new SpeechRecognition();
        const recognition = recognitionRef.current;
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript.trim()) {
                onSendMessage(finalTranscript.trim());
            }
        };

        recognition.onerror = (event) => {
            // Don't log common, non-critical speech recognition errors.
            if (event.error === 'no-speech' || event.error === 'aborted') {
                return;
            }
            console.error('Speech recognition error:', event.error);
            onToggleListening(); // Turn off on error
        };
        
        recognition.onend = () => {
            if (isContinuousListeningRef.current) {
                recognition.start();
            }
        };
        
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.onend = null; // Prevent restart on unmount
                recognitionRef.current.abort();
            }
        };

    }, [onSendMessage, onToggleListening]);
    
    useEffect(() => {
        if (isContinuousListening) {
            recognitionRef.current?.start();
        } else {
            recognitionRef.current?.stop();
        }
    }, [isContinuousListening]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim() && !isAnswering) {
            onSendMessage(message);
            setMessage('');
        }
    };

    return (
        <div className="flex flex-col h-[60vh] max-h-[70vh]">
            <div ref={chatContainerRef} className="flex-grow overflow-y-auto mb-4 p-4 bg-primary rounded-lg space-y-4">
                {chatHistory.map((msg, index) => (
                    <ChatMessage key={index} message={msg} isMuted={isMuted} onSpeak={onSpeak} />
                ))}
                {isAnswering && (
                    <div className="flex items-center space-x-2 animate-pulse">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                            <div className="w-5 h-5 text-white"></div>
                        </div>
                        <div className="h-4 bg-gray-600 rounded w-3/4"></div>
                    </div>
                )}
            </div>
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={isContinuousListening ? "Listening continuously..." : "Type a message or press mic to talk..."}
                    className="flex-grow p-3 bg-primary border border-gray-600 rounded-md focus:ring-2 focus:ring-accent focus:outline-none transition"
                    disabled={isAnswering}
                />
                <button
                    type="button"
                    onClick={onToggleListening}
                    className={`p-3 rounded-md transition-colors relative ${isContinuousListening ? 'bg-red-600' : 'bg-accent hover:bg-indigo-500'}`}
                    disabled={isAnswering}
                    aria-label={isContinuousListening ? 'Stop listening' : 'Start continuous listening'}
                >
                    <MicIcon className="w-6 h-6 text-white" />
                    {isContinuousListening && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                </button>
                <button
                    type="submit"
                    className="p-3 bg-accent rounded-md hover:bg-indigo-500 transition-colors disabled:bg-gray-600"
                    disabled={!message.trim() || isAnswering}
                >
                    <SendIcon className="w-6 h-6 text-white" />
                </button>
            </form>
        </div>
    );
};

export default ChatInterface;
