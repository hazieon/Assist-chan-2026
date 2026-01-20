
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage as ChatMessageType } from '../types';
import ChatMessage from './ChatMessage';
import { MicIcon } from './icons/MicIcon';
import { SendIcon } from './icons/SendIcon';

// Types for Web Speech API
declare global {
    interface SpeechRecognition extends EventTarget {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        start(): void;
        stop(): void;
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
        readonly length: number;
    }

    interface SpeechRecognitionResult {
        [index: number]: SpeechRecognitionAlternative;
        readonly isFinal: boolean;
        readonly length: number;
    }

    interface SpeechRecognitionAlternative {
        readonly transcript: string;
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

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
    chatHistory, 
    onSendMessage, 
    isAnswering, 
    isContinuousListening, 
    onToggleListening, 
    isMuted, 
    onSpeak 
}) => {
    const [message, setMessage] = useState('');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const isContinuousListeningRef = useRef(isContinuousListening);

    isContinuousListeningRef.current = isContinuousListening;

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);
    
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        
        // Mobile browsers often ignore 'continuous' or time out quickly
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

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
            console.warn('Speech Recognition Error:', event.error);
            if (event.error === 'not-allowed') {
                alert('Microphone access denied. Please enable it in settings.');
                onToggleListening();
            }
        };
        
        recognition.onend = () => {
            // Aggressive restart for mobile Safari/Chrome if continuous mode is active
            if (isContinuousListeningRef.current) {
                try {
                    recognition.start();
                } catch (e) {
                    // Start might fail if already active
                }
            }
        };
        
        return () => {
            recognition.onend = null;
            recognition.abort();
        };
    }, [onSendMessage, onToggleListening]);
    
    useEffect(() => {
        if (isContinuousListening) {
            try {
                recognitionRef.current?.start();
            } catch (e) {}
        } else {
            try {
                recognitionRef.current?.stop();
            } catch (e) {}
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
        <div className="flex flex-col h-[40vh] md:h-[50vh] min-h-[300px]">
            <div 
                ref={chatContainerRef} 
                className="flex-grow overflow-y-auto mb-4 p-3 bg-primary rounded-lg space-y-3 scroll-smooth"
            >
                {chatHistory.map((msg, index) => (
                    <ChatMessage key={index} message={msg} isMuted={isMuted} onSpeak={onSpeak} />
                ))}
                {isAnswering && (
                    <div className="flex items-center space-x-2 p-2 opacity-50">
                        <div className="w-2 h-2 bg-accent rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:-.3s]"></div>
                        <div className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:-.5s]"></div>
                    </div>
                )}
            </div>
            
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <div className="relative flex-grow">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={isContinuousListening ? "I'm listening..." : "Ask me anything..."}
                        className="w-full p-3 pr-10 bg-primary border border-gray-700 rounded-lg focus:ring-2 focus:ring-accent focus:outline-none transition-all text-sm"
                        disabled={isAnswering}
                    />
                </div>
                <button
                    type="button"
                    onClick={onToggleListening}
                    className={`p-3 rounded-lg transition-all active:scale-95 ${
                        isContinuousListening ? 'bg-red-600' : 'bg-secondary hover:bg-gray-700'
                    }`}
                    disabled={isAnswering}
                    aria-label="Toggle voice input"
                >
                    <MicIcon className={`w-5 h-5 ${isContinuousListening ? 'text-white' : 'text-accent'}`} />
                </button>
                <button
                    type="submit"
                    className="p-3 bg-accent rounded-lg hover:bg-indigo-500 transition-all active:scale-95 disabled:bg-gray-700 disabled:opacity-50"
                    disabled={!message.trim() || isAnswering}
                >
                    <SendIcon className="w-5 h-5 text-white" />
                </button>
            </form>
        </div>
    );
};

export default ChatInterface;
