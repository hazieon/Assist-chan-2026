
export interface InstructionSet {
    title: string;
    materials: string[];
    steps: string[];
    sources?: { uri: string; title: string; }[];
}

export enum Role {
    USER = 'user',
    ASSISTANT = 'assistant'
}

export interface ChatMessage {
    role: Role;
    content: string;
}
