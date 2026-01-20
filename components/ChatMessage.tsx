import React from 'react';
import { ChatMessage, Role } from '../types';
import { BotIcon } from './icons/BotIcon';
import { UserIcon } from './icons/UserIcon';
import { SpeakerIcon } from './icons/SpeakerIcon';


const ChatMessage: React.FC<{ message: ChatMessage; isMuted: boolean; onSpeak: (text: string) => void; }> = ({ message, isMuted, onSpeak }) => {
    const isAssistant = message.role === Role.ASSISTANT;

    return (
        <div className={`flex items-start gap-4 ${isAssistant ? '' : 'justify-end'}`}>
            {isAssistant && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center"><BotIcon className="w-5 h-5 text-white" /></div>}
            
            <div className={`max-w-md md:max-w-lg p-4 rounded-lg shadow ${isAssistant ? 'bg-secondary' : 'bg-accent'}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
                 {isAssistant && (
                    <button 
                        onClick={() => onSpeak(message.content)} 
                        className="mt-2 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Read aloud"
                        disabled={isMuted}
                    >
                        <SpeakerIcon className="w-5 h-5"/>
                    </button>
                )}
            </div>

            {!isAssistant && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center"><UserIcon className="w-5 h-5 text-white" /></div>}
        </div>
    );
};

export default ChatMessage;
