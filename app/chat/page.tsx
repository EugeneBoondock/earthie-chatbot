"use client"

import { useState, useRef, useEffect, FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Message } from "@/app/lib/gemini"

// Import ReactMarkdown and the GFM plugin
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Simple typing indicator component (remains the same)
const TypingIndicator = () => (
  // ... (TypingIndicator code)
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
)


export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([
      // Example showing Markdown in initial message
      { role: "assistant", content: "Hi there! I'm **Earthie**, your guide to *Earth 2*. Ask me anything!" }
    ])
  }, [])

  useEffect(() => {
    // ... (auto-scroll logic remains the same)
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]');
      if (viewport) {
        // Using requestAnimationFrame helps ensure scrolling happens after render
        requestAnimationFrame(() => {
           viewport.scrollTop = viewport.scrollHeight;
        });
      }
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: FormEvent) => {
    // ... (handleSubmit logic remains largely the same)
    e.preventDefault()
    const userInput = inputValue.trim()
    if (!userInput || isLoading) return

    const newUserMessage: Message = { role: "user", content: userInput }
    setMessages(prev => [...prev, newUserMessage])
    setInputValue("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Send the current message history including the new user message
        body: JSON.stringify({ messages: [...messages, newUserMessage] }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to process response" }))
        console.error("API Error Response:", errorData)
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const assistantMessage: Message = { role: "assistant", content: data.response }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage: Message = {
        role: "assistant",
        content: `Sorry, I encountered an error. ${error instanceof Error ? error.message : "Please try again."}`
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* ScrollArea: Add flex-1 to make it grow and fill available space */}
      <ScrollArea className="flex-1 overflow-y-auto min-h-0" ref={scrollAreaRef}>
        <div className="space-y-4 p-4 md:p-6"> {/* Padding for messages */}
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-end space-x-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline ? ( <code className={className} {...props}> {children} </code> )
                                      : ( <code className="bg-gray-600 px-1 py-0.5 rounded text-sm" {...props}> {children} </code> )
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
                       {/* Use AvatarImage for the user */}
                       <AvatarImage src="/images/user_beard.png" alt="User Avatar" />
                       {/* Fallback if image fails */}
                       <AvatarFallback>U</AvatarFallback>
                  </Avatar>
              )}
            </div>
          ))}
          {isLoading && <TypingIndicator />}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-4 border-t border-gray-700 bg-gray-800/90 backdrop-blur-sm shrink-0">
         {/* ... (Form remains the same) */}
         <form onSubmit={handleSubmit} className="flex items-center space-x-3 max-w-4xl mx-auto">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask Earthie anything..."
            className="flex-grow bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-[#50E3C1] focus:border-[#50E3C1] rounded-md" // Adjusted focus ring
            disabled={isLoading}
          />
          <Button
             type="submit"
             disabled={isLoading || !inputValue.trim()}
             className="bg-[#50E3C1] hover:bg-[#40c0a0] text-gray-900 font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  )
}