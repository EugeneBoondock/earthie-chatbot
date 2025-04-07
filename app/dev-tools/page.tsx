"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Check, X } from "lucide-react"

type Script = {
  id: string
  title: string
  description: string
  author: string
  code: string
  likes: number
  downloads: number
  date: string
}

const sampleScripts: Script[] = [
  {
    id: "1",
    title: "Auto Resource Collector",
    description: "Automatically collects resources from your properties at regular intervals.",
    author: "E2Developer",
    code: 'function collectResources() {\n  // Script code here\n  console.log("Collecting resources...");\n}',
    likes: 124,
    downloads: 532,
    date: "2023-11-15",
  },
  {
    id: "2",
    title: "Property Value Calculator",
    description: "Calculates the estimated value of properties based on location and resources.",
    author: "LandGuru",
    code: "function calculateValue(property) {\n  // Script code here\n  return property.baseValue * property.resourceMultiplier;\n}",
    likes: 87,
    downloads: 345,
    date: "2023-12-03",
  },
  {
    id: "3",
    title: "Marketplace Tracker",
    description: "Tracks marketplace listings and alerts you of good deals based on your criteria.",
    author: "TradeWatcher",
    code: "function watchMarketplace(criteria) {\n  // Script code here\n  return matchingListings;\n}",
    likes: 203,
    downloads: 678,
    date: "2024-01-22",
  },
]

export default function DevToolsPage() {
  const [scripts, setScripts] = useState<Script[]>(sampleScripts)
  const [newScript, setNewScript] = useState({
    title: "",
    description: "",
    code: "",
  })
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    if (!newScript.title || !newScript.description || !newScript.code) {
      setSubmitStatus("error")
      return
    }

    // Add new script
    const script: Script = {
      id: Date.now().toString(),
      title: newScript.title,
      description: newScript.description,
      author: "You",
      code: newScript.code,
      likes: 0,
      downloads: 0,
      date: new Date().toISOString().split("T")[0],
    }

    setScripts([script, ...scripts])
    setNewScript({ title: "", description: "", code: "" })
    setSubmitStatus("success")

    // Reset status after 3 seconds
    setTimeout(() => {
      setSubmitStatus("idle")
    }, 3000)
  }

  return (
    <div className="container py-8 bg-earthie-dark">
      <h1 className="text-3xl font-bold mb-8 text-center text-white">Earth2 Developer Tools</h1>

      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 bg-earthie-dark-light">
          <TabsTrigger
            value="browse"
            className="data-[state=active]:bg-earthie-mint data-[state=active]:text-earthie-dark"
          >
            Browse Scripts
          </TabsTrigger>
          <TabsTrigger
            value="submit"
            className="data-[state=active]:bg-earthie-mint data-[state=active]:text-earthie-dark"
          >
            Submit Script
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          {scripts.map((script) => (
            <Card key={script.id} className="bg-earthie-dark-light border-earthie-dark-light">
              <CardHeader>
                <CardTitle className="text-white">{script.title}</CardTitle>
                <CardDescription className="text-gray-300">{script.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-earthie-dark p-4 rounded-md overflow-x-auto">
                  <pre className="text-sm text-gray-300">{script.code}</pre>
                </div>
                <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
                  <span>By: {script.author}</span>
                  <span>Posted: {script.date}</span>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex items-center gap-4 text-gray-300">
                  <span className="text-sm">{script.likes} likes</span>
                  <span className="text-sm">{script.downloads} downloads</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-earthie-mint border-earthie-mint hover:bg-earthie-mint/10"
                >
                  Download Script
                </Button>
              </CardFooter>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="submit">
          <Card className="bg-earthie-dark-light border-earthie-dark-light">
            <CardHeader>
              <CardTitle className="text-white">Submit Your Script</CardTitle>
              <CardDescription className="text-gray-300">
                Share your Earth2 scripts with the community. All scripts are reviewed before being published.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-white">
                    Script Title
                  </Label>
                  <Input
                    id="title"
                    placeholder="Enter a descriptive title"
                    value={newScript.title}
                    onChange={(e) => setNewScript({ ...newScript, title: e.target.value })}
                    className="bg-earthie-dark border-earthie-dark-light text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-white">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what your script does and how to use it"
                    rows={3}
                    value={newScript.description}
                    onChange={(e) => setNewScript({ ...newScript, description: e.target.value })}
                    className="bg-earthie-dark border-earthie-dark-light text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code" className="text-white">
                    Script Code
                  </Label>
                  <Textarea
                    id="code"
                    placeholder="Paste your script code here"
                    rows={10}
                    className="font-mono bg-earthie-dark border-earthie-dark-light text-white"
                    value={newScript.code}
                    onChange={(e) => setNewScript({ ...newScript, code: e.target.value })}
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" className="bg-earthie-mint text-earthie-dark hover:bg-earthie-mint/90">
                    <Upload className="mr-2 h-4 w-4" />
                    Submit Script
                  </Button>
                </div>
              </form>
            </CardContent>

            {submitStatus !== "idle" && (
              <CardFooter>
                <div
                  className={`w-full p-3 rounded-md flex items-center ${
                    submitStatus === "success" ? "bg-earthie-mint/20 text-earthie-mint" : "bg-red-900/20 text-red-400"
                  }`}
                >
                  {submitStatus === "success" ? (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      Script submitted successfully! Thank you for your contribution.
                    </>
                  ) : (
                    <>
                      <X className="h-5 w-5 mr-2" />
                      Please fill in all fields before submitting.
                    </>
                  )}
                </div>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

