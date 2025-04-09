"use client"

import { useState, useRef, useEffect, FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Message } from "@/app/lib/gemini" // Assuming Message type is defined here
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Define a key for local storage
const LOCAL_STORAGE_KEY = "earthieChatHistory";

// Define the initial message(s)
const INITIAL_MESSAGE: Message = { role: "assistant", content: "Hi there! I'm **Earthie**, your guide to *Earth 2*. Ask me anything!" };

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
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // --- Effect Hooks ---

    // Load messages from localStorage on initial mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedMessages = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedMessages) {
                try {
                    const parsedMessages = JSON.parse(savedMessages);
                    if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
                         setMessages(parsedMessages);
                    } else {
                         console.warn("Invalid or empty chat history found in localStorage, resetting.");
                         setMessages([INITIAL_MESSAGE]);
                         localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([INITIAL_MESSAGE]));
                    }
                } catch (error) {
                    console.error("Failed to parse chat history from localStorage:", error);
                    setMessages([INITIAL_MESSAGE]);
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([INITIAL_MESSAGE]));
                }
            } else {
                setMessages([INITIAL_MESSAGE]);
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([INITIAL_MESSAGE]));
            }
        }
    }, []); // Empty dependency array ensures this runs only once on mount

    // Save messages to localStorage whenever they change
    useEffect(() => {
        if (typeof window !== "undefined" && messages.length > 0) {
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages));
            } catch (error) {
                console.error("Failed to save chat history to localStorage:", error);
            }
        }
    }, [messages]); // Run this effect whenever the messages array changes

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollAreaRef.current) {
            const viewport = scrollAreaRef.current.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]');
            if (viewport) {
                requestAnimationFrame(() => {
                   viewport.scrollTop = viewport.scrollHeight;
                });
            }
        }
    }, [messages, isLoading]); // Run on new messages or when loading state changes

    // --- Event Handlers ---

    // Handle form submission to send message
    const handleSubmit = async (e: FormEvent) => {
       e.preventDefault();
       const userInput = inputValue.trim();
       if (!userInput || isLoading) return;

       const newUserMessage: Message = { role: "user", content: userInput };
       const updatedMessages = [...messages, newUserMessage];
       setMessages(updatedMessages);
       setInputValue("");
       setIsLoading(true);

       try {
           const response = await fetch("/api/chat", { // Make sure this API endpoint is correct
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ messages: updatedMessages }),
           });

           if (!response.ok) {
               const errorData = await response.json().catch(() => ({ error: "Failed to process response" }));
               console.error("API Error Response:", errorData);
               throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
           }

           const data = await response.json();
           // Ensure the API returns data in the expected format { response: "..." }
           if (typeof data.response !== 'string') {
              throw new Error("Invalid response format from API.");
           }
           const assistantMessage: Message = { role: "assistant", content: data.response };
           setMessages(prev => [...prev, assistantMessage]);

       } catch (error) {
           console.error("Chat error:", error);
           const errorMessageContent = `Sorry, I encountered an error. ${error instanceof Error ? error.message : "Please try again."}`;
           const errorMessage: Message = {
               role: "assistant",
               content: errorMessageContent
           };
           // Add error message to the chat, ensuring not to overwrite history if submit fails
           setMessages(prev => [...prev, errorMessage]);
       } finally {
           setIsLoading(false);
       }
    };

    // Handle clearing the chat history
    const handleClearChat = () => {
        setMessages([INITIAL_MESSAGE]); // Reset state to only initial message
        if (typeof window !== "undefined") {
            localStorage.removeItem(LOCAL_STORAGE_KEY); // Remove old history
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([INITIAL_MESSAGE])); // Store initial state
        }
        console.log("Chat history cleared.");
    };

    // --- Render JSX ---
    return (
        <div className="flex flex-col h-full bg-transparent">

            {/* Scrollable Chat Area */}
            <ScrollArea className="flex-1 overflow-y-auto min-h-0" ref={scrollAreaRef}>
                {/* Add padding to prevent content hiding behind input area */}
                <div className="space-y-4 p-4 md:p-6 pb-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-end space-x-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {/* Assistant Avatar */}
                            {msg.role === 'assistant' && (
                                <Avatar className="h-8 w-8 flex-shrink-0 self-start">
                                    <AvatarImage src="/images/earthie_logo.png" alt="Earthie" />
                                    <AvatarFallback>E</AvatarFallback>
                                </Avatar>
                            )}

                            {/* Message Bubble */}
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
                                            ul: ({ node, ordered, ...props }) => <ul {...props} className="list-disc list-inside pl-4 my-2" />,
                                            ol: ({ node, ordered, ...props }) => <ol {...props} className="list-decimal list-inside pl-4 my-2" />,
                                            li: ({ node, ordered, ...props }) => <li {...props} className="mb-1" />,
                                            pre: ({ node, ...props }) => <pre {...props} className="bg-gray-800 p-2 rounded-md my-2 overflow-x-auto text-sm" />,
                                            code: ({ node, inline, className, children, ...props }) => {
                                                // Basic code styling, enhance further if needed
                                                return !inline ? ( <code className={`block whitespace-pre overflow-x-auto ${className}`} {...props}> {children} </code> )
                                                              : ( <code className={`bg-gray-600 px-1 py-0.5 rounded text-sm ${className}`} {...props}> {children} </code> )
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

                            {/* User Avatar */}
                            {msg.role === 'user' && (
                                <Avatar className="h-8 w-8 flex-shrink-0 self-start">
                                    <AvatarImage src="/images/user_beard.png" alt="User Avatar" />
                                    <AvatarFallback>U</AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                    ))}
                    {/* Typing Indicator */}
                    {isLoading && <TypingIndicator />}
                </div>
            </ScrollArea>

            {/* Bottom Input Area Container - Add relative positioning */}
            <div className="relative px-4 pb-4 pt-8 border-t border-gray-700 bg-gray-800/90 backdrop-blur-sm shrink-0"> {/* Added pt-8 for space */}

                 {/* Clear Chat Button - Positioned absolutely, centered near the top */}
                 {messages.length > 1 && ( // Only show if there's history beyond the initial message
                    <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-full flex justify-center"> {/* Centering container */}
                        <Button
                            variant="link"
                            className="text-xs text-gray-400 hover:text-gray-300 h-auto p-0" // Styling
                            onClick={handleClearChat}
                            title="Clear Chat History"
                            disabled={isLoading} // Disable while bot is responding
                        >
                            Clear Chat
                        </Button>
                    </div>
                 )}

                {/* Input Form - Max width and centered */}
                <form onSubmit={handleSubmit} className="flex items-center space-x-3 max-w-4xl mx-auto w-full">
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Ask Earthie anything..."
                        className="flex-grow bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-[#50E3C1] focus:border-[#50E3C1] rounded-md"
                        disabled={isLoading} // Disable input while bot is responding
                        aria-label="Chat message input"
                    />
                    <Button
                        type="submit"
                        disabled={isLoading || !inputValue.trim()} // Disable if loading or input is empty/whitespace
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