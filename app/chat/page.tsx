"use client"

import { useState, useRef, useEffect, FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Message } from "@/app/lib/gemini"

// Simple typing indicator component
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
)

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Initial welcome message
  useEffect(() => {
    setMessages([
      { role: "assistant", content: "Hi there! I'm Earthie, your guide to Earth 2. Ask me anything!" }
    ])
  }, [])

  // Auto-scroll effect
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]');
      if (viewport) {
        requestAnimationFrame(() => {
           viewport.scrollTop = viewport.scrollHeight;
        });
      }
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: FormEvent) => {
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
        body: JSON.stringify({ messages: [...messages, newUserMessage] }),
      })

      if (!response.ok) {
        // Handle HTTP errors (e.g., 500 from API route)
        const errorData = await response.json().catch(() => ({ error: "Failed to process response" }))
        console.error("API Error Response:", errorData)
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const assistantMessage: Message = { role: "assistant", content: data.response }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error("Chat error:", error)
      // Add an error message to the chat for the user
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
    <div className="flex flex-col h-full bg-transparent p-4">
      <ScrollArea className="flex-grow bg-transparent -m-4" ref={scrollAreaRef}>
        <div className="space-y-4 p-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-end space-x-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src="/images/earthie_logo.png" alt="Earthie" />
                  <AvatarFallback>E</AvatarFallback>
                </Avatar>
              )}
              <div className={`p-3 rounded-lg max-w-[70%] break-words whitespace-pre-wrap ${ 
                msg.role === 'user' 
                  ? 'bg-[#383A4B] text-white'
                  : 'bg-gray-700 text-gray-100' 
              }`}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback>U</AvatarFallback> 
                  </Avatar>
              )}
            </div>
          ))}
          {isLoading && <TypingIndicator />}
        </div>
      </ScrollArea>
      <div className="p-4 border-t border-gray-700 bg-gray-800 shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <Input 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask Earthie anything..." 
            className="flex-grow bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 rounded-md"
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

