"use client"

import React, { useState, useEffect, useCallback } from "react"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
// Ensure all necessary icons are imported
import { Upload, Check, X, Loader2, Download, Heart, Link as LinkIcon } from "lucide-react"

// --- Supabase Configuration ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Ensure keys are provided
if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase URL or Anon Key environment variables are missing!");
    console.error("Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local file or Vercel environment variables.");
    throw new Error("Supabase environment variables not set. Check console for details.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
const SCRIPT_FILES_BUCKET = 'script-files'; // Match the bucket name you created
const LIKED_SCRIPTS_STORAGE_KEY = 'earthie_liked_scripts'; // Key for localStorage

// --- Types ---
type Script = {
  id: string;
  created_at: string;
  title: string;
  description: string;
  author: string | null;
  code: string | null;
  likes: number;
  downloads: number;
  file_url: string | null;
  support_url: string | null; // Added support URL
}

type NewScriptData = {
  title: string;
  description: string;
  author: string;
  code: string;
  file: File | null;
  support_url: string; // Added support URL
}

export default function DevToolsPage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // State for interactions
  const [likedScripts, setLikedScripts] = useState<Set<string>>(new Set());
  const [likingStatus, setLikingStatus] = useState<{ [key: string]: boolean }>({});
  const [copiedStatus, setCopiedStatus] = useState<{ [key: string]: boolean }>({});
  // State for form submission
  const [newScript, setNewScript] = useState<NewScriptData>({
    title: "",
    description: "",
    author: "",
    code: "",
    file: null,
    support_url: "", // Initialize support_url
  });
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // --- Load Liked Scripts from LocalStorage on Mount ---
  useEffect(() => {
    try {
        const storedLikes = localStorage.getItem(LIKED_SCRIPTS_STORAGE_KEY);
        if (storedLikes) {
            setLikedScripts(new Set(JSON.parse(storedLikes)));
            console.log("Loaded liked scripts from localStorage:", JSON.parse(storedLikes));
        }
    } catch (e) {
        console.error("Failed to load liked scripts from localStorage:", e);
        localStorage.removeItem(LIKED_SCRIPTS_STORAGE_KEY); // Clear corrupted data
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Helper to check if a script is liked ---
  const isLiked = (scriptId: string): boolean => {
    return likedScripts.has(scriptId);
  };

  // --- Helper to update liked status in state and localStorage ---
  const updateLikedStatus = (scriptId: string, newLikedState: boolean) => {
    setLikedScripts(prevLikedScripts => {
      const newSet = new Set(prevLikedScripts);
      if (newLikedState) {
        newSet.add(scriptId);
      } else {
        newSet.delete(scriptId);
      }
      // Update localStorage
      try {
        const likedArray = Array.from(newSet);
        localStorage.setItem(LIKED_SCRIPTS_STORAGE_KEY, JSON.stringify(likedArray));
        console.log("Saved liked scripts to localStorage:", likedArray);
      } catch (e) {
          console.error("Failed to save liked scripts to localStorage:", e);
      }
      return newSet;
    });
  };

  // --- Data Fetching ---
  const fetchScripts = useCallback(async () => {
    console.log("--- Starting fetchScripts ---");
    setIsLoading(true);
    setError(null);
    try {
      console.log("Attempting to fetch from table: Earthie_scripts");
      const { data, error: fetchError } = await supabase
        .from("Earthie_scripts")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("!!! Supabase Fetch Error Object:", fetchError);
        throw fetchError;
      }
      console.log("Fetch successful. Data received:", data?.length);
      setScripts(data || []);
    } catch (err: any) {
      console.error("--- Error caught in fetchScripts catch block ---");
      console.error("Full error object during fetch:", err);
       let errorMessage = 'Unknown error fetching scripts.';
       if (err instanceof Error && err.message) { errorMessage = err.message; }
       else if (err && typeof err === 'object') {
            if ('message' in err && typeof err.message === 'string' && err.message) { errorMessage = err.message; }
            else if ('details' in err && typeof err.details === 'string' && err.details) { errorMessage = `Details: ${err.details}`; }
            else if ('hint' in err && typeof err.hint === 'string' && err.hint) { errorMessage = `Hint: ${err.hint}`; }
            else if ('code' in err && typeof err.code === 'string' && err.code) { errorMessage = `Code: ${err.code}`; }
            else { try { errorMessage = `Unexpected error structure: ${JSON.stringify(err)}`; } catch { /* ignore */ } }
       } else if (typeof err === 'string' && err) { errorMessage = err; }
      console.error("Processed Fetch Error Message:", errorMessage);
      setError(`Failed to load scripts: ${errorMessage}. Please try refreshing.`);
    } finally {
      console.log("--- Finished fetchScripts ---");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  // --- Liking Logic ---
  const toggleLike = async (scriptId: string) => {
    if (likingStatus[scriptId]) return;

    const currentlyLiked = isLiked(scriptId);
    const newLikedState = !currentlyLiked;
    const rpcName = currentlyLiked ? 'decrement_likes' : 'increment_likes';
    const change = currentlyLiked ? -1 : 1;

    console.log(`${currentlyLiked ? 'Unliking' : 'Liking'} script:`, scriptId);
    setLikingStatus(prev => ({ ...prev, [scriptId]: true }));

    setScripts(currentScripts =>
        currentScripts.map(s => s.id === scriptId ? { ...s, likes: Math.max(0, (s.likes ?? 0) + change) } : s)
    );
    updateLikedStatus(scriptId, newLikedState);

    try {
      const { error: rpcError } = await supabase.rpc(rpcName, { script_id_input: scriptId });
      if (rpcError) {
        console.error(`Error ${currentlyLiked ? 'decrementing' : 'incrementing'} likes via RPC:`, rpcError);
        // Revert UI and State on error
        setScripts(currentScripts => currentScripts.map(s => s.id === scriptId ? { ...s, likes: Math.max(0, (s.likes ?? 0) - change) } : s));
        updateLikedStatus(scriptId, currentlyLiked);
      } else {
        console.log(`Successfully ${currentlyLiked ? 'decremented' : 'incremented'} likes for`, scriptId);
      }
    } catch (err) {
      console.error("Client-side error during like toggle:", err);
      // Revert UI and State on error
      setScripts(currentScripts => currentScripts.map(s => s.id === scriptId ? { ...s, likes: Math.max(0, (s.likes ?? 0) - change) } : s));
      updateLikedStatus(scriptId, currentlyLiked);
    } finally {
      setTimeout(() => setLikingStatus(prev => ({ ...prev, [scriptId]: false })), 300);
    }
  };

  // --- Copy Logic ---
  const handleCopyCode = (scriptId: string, codeToCopy: string | null) => {
    if (!codeToCopy) return;
    navigator.clipboard.writeText(codeToCopy).then(() => {
      console.log("Code copied for script:", scriptId);
      setCopiedStatus(prev => ({ ...prev, [scriptId]: true }));
      setTimeout(() => { setCopiedStatus(prev => ({ ...prev, [scriptId]: false })); }, 1500);
    }).catch(err => { console.error('Failed to copy code: ', err); });
  };

  // --- Download Logic ---
  const incrementDownloads = async (scriptId: string) => {
    console.log("Incrementing downloads for:", scriptId);
    try {
      setScripts(currentScripts => currentScripts.map(s => s.id === scriptId ? { ...s, downloads: (s.downloads ?? 0) + 1 } : s));
      const { error: rpcError } = await supabase.rpc('increment_downloads', { script_id_input: scriptId });
      if (rpcError) {
          console.error("Error incrementing downloads via RPC:", rpcError);
          // Optional: Revert optimistic update if the RPC call fails
          // setScripts(currentScripts => currentScripts.map(s => s.id === scriptId ? { ...s, downloads: (s.downloads ?? 0) - 1 } : s));
      }
    } catch (err) {
      console.error("Client-side error during download increment:", err);
    }
  };

  // --- Form Handling ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setNewScript(prev => ({ ...prev, file: file, code: file ? "" : prev.code }));
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const code = e.target.value;
    setNewScript(prev => ({ ...prev, code: code, file: code ? null : prev.file }));
    if (code && newScript.file) {
      const fileInput = document.getElementById('file-upload') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus("submitting");
    setSubmitError(null);
    console.log("--- Starting Submission ---");
    console.log("Form Data:", newScript);

    if (!newScript.title || !newScript.description || (!newScript.code && !newScript.file)) {
      setSubmitStatus("error"); setSubmitError("Please fill in Title, Description, and provide either Code or a File."); return;
    }
    if (newScript.code && newScript.file) {
      setSubmitStatus("error"); setSubmitError("Please provide either Code *or* a File, not both."); return;
    }

    try {
      let fileUrl: string | null = null;
      if (newScript.file) {
        console.log("Attempting file upload...");
        const file = newScript.file;
        const uniqueFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const filePath = `public/${uniqueFileName}`;
        console.log(`Uploading file to bucket: ${SCRIPT_FILES_BUCKET}, path: ${filePath}`);
        const { error: uploadError } = await supabase.storage.from(SCRIPT_FILES_BUCKET).upload(filePath, file);
        if (uploadError) { throw new Error(`Storage Upload Failed: ${uploadError.message || JSON.stringify(uploadError)}`); }
        console.log("File upload successful.");
        const { data: urlData } = supabase.storage.from(SCRIPT_FILES_BUCKET).getPublicUrl(filePath); // Error check removed earlier, assume public URL works or isn't critical failure point if null
        fileUrl = urlData?.publicUrl ?? null;
        console.log("Public URL obtained:", fileUrl);
      } else {
        console.log("No file provided, skipping upload.");
      }

      const scriptToInsert = {
        title: newScript.title,
        description: newScript.description,
        author: newScript.author || 'Anonymous',
        code: newScript.code || null,
        file_url: fileUrl,
        support_url: newScript.support_url || null, // Include support_url
      };
      console.log("Attempting database insert with data:", scriptToInsert);
      const tableNameForInsert = "Earthie_scripts";
      console.log(`>>> CONFIRM: Table name being passed to .from() is: '${tableNameForInsert}' <<<`);

      const { data: insertedData, error: insertError } = await supabase.from(tableNameForInsert).insert([scriptToInsert]).select();
      if (insertError) { throw new Error(`Database Insert Failed: ${insertError.message || JSON.stringify(insertError)}`); }
      console.log("Database insert successful. Inserted data:", insertedData);

      setSubmitStatus("success");
      const successfullyInsertedScript = insertedData?.[0] as Script | undefined;
      if (successfullyInsertedScript) {
        setScripts(prevScripts => [successfullyInsertedScript, ...prevScripts]);
      } else {
        fetchScripts(); // Refetch if insert didn't return data
      }

      // Reset form including support_url
      setNewScript({ title: "", description: "", author: "", code: "", file: null, support_url: "" });
      const fileInput = document.getElementById('file-upload') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';

      setTimeout(() => { setSubmitStatus("idle"); }, 3000);
      console.log("--- Submission Complete ---");

    } catch (err) {
      console.error("--- Submission Error Caught ---");
      console.error("Full error object during submission:", err);
      let errorMessage = 'Unknown error during submission.';
      if (err instanceof Error) { errorMessage = err.message; }
      else if (typeof err === 'string') { errorMessage = err; }
      else { try { errorMessage = `Unexpected error structure: ${JSON.stringify(err)}`; } catch { /* ignore */ } }
      console.error("Processed Error Message:", errorMessage);
      setSubmitStatus("error");
      setSubmitError(errorMessage);
    }
  };

  // --- Helper Functions ---
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try { return new Date(dateString).toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return "Invalid Date"; }
  }

  const generateFilename = (title: string, extension: string) => {
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return `${safeTitle || 'script'}.${extension}`;
  }


  // --- Component Return / JSX ---
  return (
    <div className="container py-8 bg-earthie-dark min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-8 text-center">Earth2 Developer Tools</h1>

      <Tabs defaultValue="browse" className="w-full">
         <TabsList className="grid w-full grid-cols-2 mb-8 bg-earthie-dark-light">
            <TabsTrigger value="browse" className="data-[state=active]:bg-earthie-mint data-[state=active]:text-earthie-dark text-gray-300 data-[state=inactive]:hover:bg-earthie-dark data-[state=inactive]:hover:text-gray-100"> Browse Scripts </TabsTrigger>
            <TabsTrigger value="submit" className="data-[state=active]:bg-earthie-mint data-[state=active]:text-earthie-dark text-gray-300 data-[state=inactive]:hover:bg-earthie-dark data-[state=inactive]:hover:text-gray-100"> Submit Script </TabsTrigger>
         </TabsList>

        {/* Browse Tab Content */}
        <TabsContent value="browse" className="space-y-6">
           {isLoading && ( <div className="flex justify-center items-center py-10"> <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading scripts... </div> )}
           {error && ( <div className="p-4 rounded-md bg-red-900/30 text-red-400 border border-red-700"> <p className="font-semibold">Error:</p> <p>{error}</p> </div> )}
           {!isLoading && !error && scripts.length === 0 && ( <p className="text-center text-gray-400 py-10">No scripts found. Be the first to submit one!</p> )}

          {!isLoading && !error && scripts.map((script) => (
            <Card key={script.id} className="bg-earthie-dark-light border-earthie-dark-light overflow-hidden">
              <CardHeader>
                <CardTitle>{script.title}</CardTitle>
                 {script.description && ( <CardDescription className="text-gray-300 pt-1">{script.description}</CardDescription> )}
              </CardHeader>
              <CardContent>
                {/* Code Block with Copy Button */}
                {script.code && (
                  <div className="relative group bg-earthie-dark p-4 rounded-md overflow-x-auto mb-4 max-h-96">
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-50 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white hover:bg-earthie-dark-light/50" onClick={() => handleCopyCode(script.id, script.code)} aria-label="Copy code">
                        {copiedStatus[script.id] ? (<Check className="h-4 w-4 text-earthie-mint" />) : (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /> </svg>)}
                    </Button>
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words font-mono pr-10">{script.code}</pre>
                  </div>
                )}
                {/* File Download Link */}
                {script.file_url && (
                     <div className="mb-4">
                        <a href={script.file_url} target="_blank" rel="noopener noreferrer" download className="inline-flex items-center px-3 py-1 border border-earthie-mint text-earthie-mint text-sm rounded hover:bg-earthie-mint/10 active:bg-earthie-mint/20 transition-colors" onClick={() => incrementDownloads(script.id)}>
                            <Download className="mr-2 h-4 w-4" /> Download Attached File
                        </a>
                    </div>
                )}
                {/* Support Link */}
                {script.support_url && (
                    <div className="mt-2">
                        <a href={script.support_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center text-xs text-earthie-mint hover:underline">
                            <LinkIcon className="h-4 w-4 mr-1" /> {/* Using Link Icon */}
                            Support the Author
                        </a>
                    </div>
                )}
                {/* Author/Date */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 text-sm text-gray-400 gap-2">
                  <span>By: <span className="font-medium text-gray-300">{script.author || 'Anonymous'}</span></span>
                  <span>Posted: <span className="font-medium text-gray-300">{formatDate(script.created_at)}</span></span>
                </div>
              </CardContent>
              {/* Updated CardFooter */}
              <CardFooter className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-earthie-dark/30 px-6 py-4">
                 <div className="flex items-center gap-4 text-gray-300">
                    {/* Like/Unlike Button */}
                    <Button variant="ghost" size="sm" className="p-1 h-auto text-gray-400 hover:text-red-500 disabled:opacity-50" onClick={() => toggleLike(script.id)} disabled={likingStatus[script.id]} >
                        <Heart className={`h-5 w-5 ${likingStatus[script.id] ? 'animate-pulse' : ''} ${isLiked(script.id) ? 'fill-red-500 text-red-500' : 'fill-none'}`} /> {/* Fill based on isLiked */}
                    </Button>
                    {/* Display Counts */}
                    <span className="text-sm whitespace-nowrap" title={`${script.likes ?? 0} likes`}>{script.likes ?? 0} likes</span>
                    <span className="text-sm whitespace-nowrap" title={`${script.downloads ?? 0} downloads`}>{script.downloads ?? 0} downloads</span>
                 </div>
                 {/* Download Code Snippet Button */}
                 {script.code && (
                     <Button variant="outline" size="sm" className="text-earthie-mint border-earthie-mint hover:bg-earthie-mint/10 active:bg-earthie-mint/20 w-full sm:w-auto" onClick={(e) => { e.preventDefault(); incrementDownloads(script.id); const blob = new Blob([script.code ?? ''], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = generateFilename(script.title, 'txt'); document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }}>
                        <Download className="mr-2 h-4 w-4" /> Download Code Snippet
                    </Button>
                 )}
                 {/* File attached hint */}
                  {!script.code && script.file_url && ( <div className="text-sm text-gray-500 italic text-right w-full sm:w-auto"> (File attached)</div> )}
              </CardFooter>
            </Card>
          ))}
        </TabsContent>

        {/* Submit Tab Content */}
        <TabsContent value="submit">
             <Card className="bg-earthie-dark-light border-earthie-dark-light">
                 <CardHeader> <CardTitle>Submit Your Script or File</CardTitle> <CardDescription className="text-gray-300"> Share your Earth2 utilities with the community. Provide either code pasted below OR upload a file. </CardDescription> </CardHeader>
                 <CardContent>
                     <form onSubmit={handleSubmit} className="space-y-6">
                         {/* Title Input */}
                         <div className="space-y-2"> <Label htmlFor="title" className="text-white"> Title * </Label> <Input id="title" placeholder="e.g., Auto Tile Analyzer, Resource Map Helper" value={newScript.title} onChange={(e) => setNewScript({ ...newScript, title: e.target.value })} className="bg-earthie-dark border-earthie-dark-light text-white placeholder-gray-500" required disabled={submitStatus === 'submitting'} /> </div>
                         {/* Author Input */}
                         <div className="space-y-2"> <Label htmlFor="author" className="text-white"> Your Name / Alias </Label> <Input id="author" placeholder="Optional (defaults to Anonymous)" value={newScript.author} onChange={(e) => setNewScript({ ...newScript, author: e.target.value })} className="bg-earthie-dark border-earthie-dark-light text-white placeholder-gray-500" disabled={submitStatus === 'submitting'} /> </div>
                         {/* Support Link Input */}
                         <div className="space-y-2">
                            <Label htmlFor="support_url" className="text-white"> Support Link (Optional) </Label>
                            <Input id="support_url" type="url" placeholder="e.g., https://patreon.com/your_name" value={newScript.support_url} onChange={(e) => setNewScript({ ...newScript, support_url: e.target.value })} className="bg-earthie-dark border-earthie-dark-light text-white placeholder-gray-500" disabled={submitStatus === 'submitting'} />
                            <p className="text-xs text-gray-400">Link where others can support you (Ko-fi, Patreon, etc.)</p>
                         </div>
                         {/* Description Input */}
                         <div className="space-y-2"> <Label htmlFor="description" className="text-white"> Description * </Label> <Textarea id="description" placeholder="Explain what it does, how to use it, any requirements..." rows={4} value={newScript.description} onChange={(e) => setNewScript({ ...newScript, description: e.target.value })} className="bg-earthie-dark border-earthie-dark-light text-white placeholder-gray-500" required disabled={submitStatus === 'submitting'} /> </div>
                         {/* Code Input */}
                         <div className="space-y-2"> <Label htmlFor="code" className="text-white"> Script Code (Paste Here) </Label> <Textarea id="code" placeholder="Paste your script code here..." rows={10} className="font-mono bg-earthie-dark border-earthie-dark-light text-white placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed" value={newScript.code} onChange={handleCodeChange} disabled={!!newScript.file || submitStatus === 'submitting'} /> </div>
                         {/* File Upload Input */}
                         <div className="space-y-2"> <Label className="block text-white"> Or Upload File (e.g., .js, .txt, .zip) </Label> <div> <Input id="file-upload" type="file" onChange={handleFileChange} className="hidden" disabled={!!newScript.code || submitStatus === 'submitting'} accept=".js,.jsx,.ts,.tsx,.txt,.zip,.py,.sh,.json,.css,.html" /> <Label htmlFor="file-upload" className={`inline-flex items-center px-4 py-2 rounded border border-earthie-mint text-earthie-mint text-sm font-medium hover:bg-earthie-mint/10 active:bg-earthie-mint/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-earthie-mint focus-visible:ring-offset-2 focus-visible:ring-offset-earthie-dark transition-colors ${(!!newScript.code || submitStatus === 'submitting') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer' }`} > <Upload className="mr-2 h-4 w-4" /> {newScript.file ? 'Change File' : 'Choose File'} </Label> </div> {newScript.file && ( <p className="text-sm text-gray-400 pt-1">Selected: <span className="font-medium text-gray-300">{newScript.file.name}</span></p> )} {!newScript.code && !newScript.file && ( <p className="text-sm text-gray-400 italic">Provide code above OR choose a file.</p> )} </div>
                         {/* Submit Button */}
                         <div className="flex justify-end pt-4"> <Button type="submit" className="bg-earthie-mint text-earthie-dark hover:bg-earthie-mint/90 disabled:opacity-50" disabled={submitStatus === 'submitting' || (!newScript.code && !newScript.file) || !newScript.title || !newScript.description} > {submitStatus === 'submitting' ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Upload className="mr-2 h-4 w-4" /> )} {submitStatus === 'submitting' ? 'Submitting...' : 'Submit Script/File'} </Button> </div>
                     </form>
                 </CardContent>
                 {/* Submission Status Feedback */}
                 {submitStatus !== "idle" && submitStatus !== "submitting" && (
                    <CardFooter> <div className={`w-full p-3 rounded-md flex items-start text-sm ${ submitStatus === "success" ? "bg-green-900/30 text-green-300 border border-green-700" : "bg-red-900/30 text-red-300 border border-red-700" }`} > {submitStatus === "success" ? ( <> <Check className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" /> <span>Submission successful! Thank you for your contribution. It may take some time to appear after review.</span> </> ) : ( <> <X className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" /> <span>{ submitError || "Submission failed. Please check the form and try again."}</span> </> )} </div> </CardFooter>
                 )}
             </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}