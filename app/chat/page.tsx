"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar } from "@/components/ui/avatar"
import { Send } from "lucide-react"
import Image from "next/image"

type Message = {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I'm Earthie, your Earth2 assistant. How can I help you today?",
      role: "assistant",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim()) return

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "Earth2 is a futuristic virtual world where you can buy, sell, and develop virtual land.",
        "The E2 economy is based on the concept of digital land ownership and resource extraction.",
        "Essence is a resource in Earth2 that can be used for various activities in the game.",
        "Jewels are a form of currency in Earth2 that can be earned through various activities.",
        "Properties in Earth2 can be developed and customized according to your preferences.",
        "Earth2 is divided into different phases, with each phase introducing new features and gameplay elements.",
      ]

      const botMessage: Message = {
        id: Date.now().toString(),
        content: responses[Math.floor(Math.random() * responses.length)],
        role: "assistant",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, botMessage])
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="container max-w-4xl py-8 bg-earthie-dark">
      <h1 className="text-3xl font-bold mb-8 text-center text-white">Chat with Earthie</h1>

      <Card className="border-2 border-earthie-mint/20 bg-earthie-dark-light">
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4 h-[60vh] overflow-y-auto p-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`flex items-start gap-2 max-w-[80%] ${message.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {message.role === "assistant" ? (
                    <Avatar className="w-8 h-8 bg-earthie-mint">
                      <div className="relative w-full h-full">
                        <Image src="/images/earthie_logo.png" alt="Earthie" fill className="object-cover" />
                      </div>
                    </Avatar>
                  ) : (
                    <Avatar className="w-8 h-8 bg-earthie-mint text-earthie-dark">
                      <span>U</span>
                    </Avatar>
                  )}
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-earthie-mint text-earthie-dark"
                        : "bg-earthie-dark border border-earthie-mint/30 text-white"
                    }`}
                  >
                    <p>{message.content}</p>
                    <p className="text-xs opacity-50 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-start gap-2 max-w-[80%]">
                  <Avatar className="w-8 h-8 bg-earthie-mint">
                    <div className="relative w-full h-full">
                      <Image src="/images/earthie_logo.png" alt="Earthie" fill className="object-cover" />
                    </div>
                  </Avatar>
                  <div className="rounded-lg px-4 py-2 bg-earthie-dark border border-earthie-mint/30">
                    <div className="flex space-x-1">
                      <div
                        className="w-2 h-2 rounded-full bg-earthie-mint animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      ></div>
                      <div
                        className="w-2 h-2 rounded-full bg-earthie-mint animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      ></div>
                      <div
                        className="w-2 h-2 rounded-full bg-earthie-mint animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="mt-4 flex items-center gap-2">
            <Input
              placeholder="Ask anything about Earth2..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-earthie-dark border-earthie-mint/30 text-white"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="bg-earthie-mint text-earthie-dark hover:bg-earthie-mint/90"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send message</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

