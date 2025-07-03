"use client"

import { useRef, useEffect, useState } from "react"
import { useChat } from 'ai/react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { get as idbGet } from 'idb-keyval'


interface E2Property {
  id: string;
  type: string;
  attributes: {
    description: string;
    // other attributes can be added if needed for context
  };
}

// --- Typing Indicator Component ---
const TypingIndicator = () => (
    <div className="flex items-center space-x-2 p-2 justify-start">
      <Avatar className="h-8 w-8">
        <AvatarImage src="/images/earthie_logo.png" alt="Earthie" />
        <AvatarFallback>E</AvatarFallback>
      </Avatar>
      <div className="flex space-x-1.5 p-2 bg-gray-700 rounded-lg">
          <span className="h-2 w-2 bg-[#50E3C1] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
          <span className="h-2 w-2 bg-[#50E3C1] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
          <span className="h-2 w-2 bg-[#50E3C1] rounded-full animate-bounce"></span>
      </div>
    </div>
);

// --- Main Chat Component ---
export default function ChatPage() {
    const [userContext, setUserContext] = useState<string | null>(null);
    const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
        api: '/api/chat',
        body: {
            data: {
                userContext
            }
        },
        initialMessages: [{ id: '1', role: 'assistant', content: "Hi there! I'm **Earthie**, your guide to *Earth 2*. Ask me anything!" }],
        onFinish() {
            // you can add logic here if needed
        },
    });
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
      if (scrollAreaRef.current) {
          const viewport = scrollAreaRef.current.querySelector<HTMLDivElement>('div[data-radix-scroll-area-viewport]');
          if (viewport) {
              requestAnimationFrame(() => {
                 viewport.scrollTop = viewport.scrollHeight;
              });
          }
      }
    }, [messages, isLoading]);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                // Step 1: Fetch the linked E2 User ID
                const profileRes = await fetch('/api/me/e2profile');
                if (!profileRes.ok) {
                    // User is likely not logged in or has no linked profile
                    setUserContext("The user is not logged in.");
                    return;
                }
                
                const { e2_user_id, username } = await profileRes.json();
                
                if (e2_user_id && username) {
                    let context = `The user is logged in. Their username is ${username}.`;
                    
                    // Step 2: Try to load properties from IndexedDB
                    const cacheKey = `e2_properties_${e2_user_id}`;
                    const cachedProps: E2Property[] | undefined = await idbGet(cacheKey);

                    if (cachedProps && cachedProps.length > 0) {
                        const propertyNames = cachedProps.map(p => p.attributes.description).slice(0, 10).join(', ');
                        context += ` Their cached assets include: ${propertyNames}.`;
                    } else {
                        context += " The user's assets are not currently cached in the browser.";
                    }
                    setUserContext(context);
                } else {
                    setUserContext("User is logged in but has not linked an Earth 2 profile.");
                }
            } catch (error) {
                console.error("Error fetching user data for chat:", error);
                setUserContext("The user is not logged in or an error occurred.");
            }
        };

        fetchUserData();
    }, []);

    // Handle clearing the chat history
    const handleClearChat = () => {
        setMessages([{ id: '1', role: 'assistant', content: "Hi there! I'm **Earthie**, your guide to *Earth 2*. Ask me anything!" }]);
    };

    // --- Render JSX ---
    return (
        <div className="grid grid-rows-[1fr_auto] h-full bg-transparent overflow-hidden">
            <ScrollArea className="overflow-y-auto min-h-0" ref={scrollAreaRef}>
                <div className="space-y-4 p-4 md:p-6 pb-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex items-end space-x-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <Avatar className="h-8 w-8 flex-shrink-0 self-start">
                                    <AvatarImage src="/images/earthie_logo.png" alt="Earthie" />
                                    <AvatarFallback>E</AvatarFallback>
                                </Avatar>
                            )}

                            <div className={`p-3 rounded-lg max-w-[75%] break-words ${
                                msg.role === 'user'
                                ? 'bg-[#383A4B] text-white'
                                : 'bg-gray-700 text-gray-100'
                            }`}>
                                {msg.role === 'assistant' ? (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            a: ({ node, ...props }) => <a {...props} className="text-[#50E3C1] hover:underline" target="_blank" rel="noopener noreferrer" />,
                                            ul: ({ node, ...props }) => <ul {...props} className="list-disc list-inside pl-4 my-2" />,
                                            ol: ({ node, ...props }) => <ol {...props} className="list-decimal list-inside pl-4 my-2" />,
                                            li: ({ node, ...props }) => <li {...props} className="mb-1" />,
                                            pre: ({ node, ...props }) => <pre {...props} className="bg-gray-800 p-2 rounded-md my-2 overflow-x-auto text-sm" />,
                                            code: ({ node, className, children, ...props }) => {
                                                const match = /language-(\w+)/.exec(className || '');
                                                return match ? (
                                                    <code className={`block whitespace-pre overflow-x-auto ${className || ''}`} {...props}> {children} </code>
                                                ) : (
                                                    <code className={`bg-gray-600 px-1 py-0.5 rounded text-sm ${className || ''}`} {...props}> {children} </code>
                                                );
                                            },
                                            p: ({node, ...props}) => <p {...props} className="mb-2 last:mb-0" />
                                         }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                ) : (
                                    <span className="whitespace-pre-wrap">{msg.content}</span>
                                )}
                            </div>

                            {msg.role === 'user' && (
                                <Avatar className="h-8 w-8 flex-shrink-0 self-start">
                                    <AvatarImage src="/images/user_beard.png" alt="User Avatar" />
                                    <AvatarFallback>U</AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                    ))}
                    {isLoading && <TypingIndicator />}
                </div>
            </ScrollArea>

            <div className="px-4 pt-2 pb-3 border-t border-gray-700 bg-gray-800/90 backdrop-blur-sm flex flex-col items-center">
                 {messages.length > 1 && (
                    <Button
                        variant="link"
                        className="text-xs text-gray-300 hover:text-gray-100 h-auto p-0 mb-1"
                        onClick={handleClearChat}
                        title="Clear Chat History"
                        disabled={isLoading}
                    >
                        Clear Chat
                    </Button>
                 )}

                <form onSubmit={handleSubmit} className="flex items-center space-x-3 max-w-4xl mx-auto w-full">
                    <Input
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Ask Earthie anything..."
                        className="flex-grow bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-[#50E3C1] focus:border-[#50E3C1] rounded-md"
                        disabled={isLoading}
                        aria-label="Chat message input"
                    />
                    <Button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="bg-[#50E3C1] hover:bg-[#40c0a0] text-gray-900 font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Send chat message"
                    >
                        Send
                    </Button>
                </form>
            </div>
        </div>
    );
}