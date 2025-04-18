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
  support_url: string | null;
}

type NewScriptData = {
  title: string;
  description: string;
  author: string;
  code: string;
  file: File | null;
  support_url: string;
}

// --- Helper Functions (Defined OUTSIDE the component) ---

// Helper to check if a script ID exists in a Set
const isLocallyLiked = (scriptId: string, likedSet: Set<string>): boolean => {
  return likedSet.has(scriptId);
};

// Helper to update liked status in localStorage and call state setter
const updateLocalLikeStatus = (
    scriptId: string,
    newLikedState: boolean,
    setLikedScriptsState: React.Dispatch<React.SetStateAction<Set<string>>> // Pass the state setter
) => {
  setLikedScriptsState(prevLikedScripts => {
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

// --- React Component ---
export default function DevToolsPage() {
  // --- State Definitions ---
  const [scripts, setScripts] = useState<Script[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [locallyLikedScripts, setLocallyLikedScripts] = useState<Set<string>>(new Set()); // State for local liked status
  const [likingStatus, setLikingStatus] = useState<{ [key: string]: boolean }>({}); // Tracks if like RPC is in progress
  const [downloadingStatus, setDownloadingStatus] = useState<{ [key: string]: boolean }>({}); // Tracks if download RPC is in progress
  const [copiedStatus, setCopiedStatus] = useState<{ [key: string]: boolean }>({});
  const [newScript, setNewScript] = useState<NewScriptData>({
    title: "", description: "", author: "", code: "", file: null, support_url: "",
  });
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // --- Load Local Liked Status on Mount ---
  useEffect(() => {
    try {
      const storedLikes = localStorage.getItem(LIKED_SCRIPTS_STORAGE_KEY);
      if (storedLikes) {
        setLocallyLikedScripts(new Set(JSON.parse(storedLikes))); // Update state from localStorage
        console.log("Loaded local like status from localStorage:", JSON.parse(storedLikes));
      }
    } catch (e) {
      console.error("Failed to load local like status from localStorage:", e);
      localStorage.removeItem(LIKED_SCRIPTS_STORAGE_KEY);
    }
  }, []); // Runs only once on mount

  // --- Data Fetching ---
  const fetchScripts = useCallback(async (showLoading = true) => {
    console.log("--- Starting fetchScripts ---");
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      console.log("Attempting to fetch from table: Earthie_scripts");
      const { data, error: fetchError } = await supabase
        .from("Earthie_scripts").select("*").order("created_at", { ascending: false });
      if (fetchError) { throw fetchError; }
      console.log("Fetch successful. Data received:", data?.length);
      setScripts(data || []); // Update main script data
    } catch (err: any) {
      console.error("--- Error caught in fetchScripts catch block ---"); console.error("Full error object:", err);
      let msg = 'Unknown fetch error.'; if (err instanceof Error){msg = err.message;} else if(typeof err === 'string'){msg=err;} else if(err && typeof err === 'object'){if(err.message){msg=err.message}else{try{msg=JSON.stringify(err)}catch{}}}
      setError(`Failed to load scripts: ${msg}. Refresh?`);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []); // Empty dependency array is fine as it doesn't depend on component state/props

  useEffect(() => { fetchScripts(true); }, [fetchScripts]);

  // --- Liking Logic ---
  const toggleLike = useCallback(async (scriptId: string) => {
    if (likingStatus[scriptId]) return; // Prevent double clicks

    // *** Use the external helper, passing the current state ***
    const currentlyLiked = isLocallyLiked(scriptId, locallyLikedScripts);
    const newLikedState = !currentlyLiked;
    const rpcName = currentlyLiked ? 'decrement_likes' : 'increment_likes';

    console.log(`${currentlyLiked ? 'Unliking' : 'Liking'} script:`, scriptId);
    setLikingStatus(prev => ({ ...prev, [scriptId]: true }));

    // *** Update LOCAL state immediately using the helper, passing the state setter ***
    updateLocalLikeStatus(scriptId, newLikedState, setLocallyLikedScripts);

    try {
      const { error: rpcError } = await supabase.rpc(rpcName, { script_id_input: scriptId });
      if (rpcError) {
        console.error(`Error calling ${rpcName} via RPC:`, rpcError);
        // *** Revert LOCAL state if DB update failed ***
        updateLocalLikeStatus(scriptId, currentlyLiked, setLocallyLikedScripts);
        alert(`Failed to ${newLikedState ? 'like' : 'unlike'} script. Please try again.`);
      } else {
        console.log(`Successfully called ${rpcName} for`, scriptId);
        // *** Re-fetch data to get updated count from DB ***
        await fetchScripts(false); // Use await here
      }
    } catch (err) {
      console.error("Client-side error during like toggle:", err);
       // *** Revert LOCAL state on client-side error too ***
      updateLocalLikeStatus(scriptId, currentlyLiked, setLocallyLikedScripts);
      alert(`An error occurred. Failed to ${newLikedState ? 'like' : 'unlike'} script.`);
    } finally {
      setTimeout(() => setLikingStatus(prev => ({ ...prev, [scriptId]: false })), 300);
    }
  // Dependencies: include state and functions used inside
  }, [likingStatus, locallyLikedScripts, fetchScripts]);

  // --- Download Logic ---
   const handleDownload = useCallback(async (scriptId: string, downloadAction: () => void) => {
    if (downloadingStatus[scriptId]) return; // Prevent double clicks

    setDownloadingStatus(prev => ({...prev, [scriptId]: true}));
    console.log("Incrementing downloads for:", scriptId);

    // Perform the actual download action immediately
    downloadAction();

    try {
      // Call the database function to increment
      const { error: rpcError } = await supabase.rpc('increment_downloads', { script_id_input: scriptId });
      if (rpcError) {
          console.error("Error incrementing downloads via RPC:", rpcError);
      } else {
          console.log("Successfully incremented downloads for", scriptId);
          // *** Re-fetch data to get updated count from DB ***
          await fetchScripts(false); // Use await here
      }
    } catch (err) {
      console.error("Client-side error during download increment:", err);
    } finally {
        setTimeout(() => setDownloadingStatus(prev => ({...prev, [scriptId]: false})), 300);
    }
   // Dependencies
   }, [downloadingStatus, fetchScripts]);

   // --- Copy Logic ---
   const handleCopyCode = useCallback((scriptId: string, codeToCopy: string | null) => {
       if (!codeToCopy) return;
       navigator.clipboard.writeText(codeToCopy).then(() => {
         setCopiedStatus(prev => ({ ...prev, [scriptId]: true }));
         setTimeout(() => { setCopiedStatus(prev => ({ ...prev, [scriptId]: false })); }, 1500);
       }).catch(err => { console.error('Failed to copy code: ', err); });
   // No external dependencies needed
   }, []);

  // --- Form Handling & Helpers (Keep inside component or move if preferred) ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setNewScript(prev => ({ ...prev, file: file, code: file ? "" : prev.code }));
  };
  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const code = e.target.value;
    setNewScript(prev => ({ ...prev, code: code, file: code ? null : prev.file }));
    if (code && newScript.file) { const fi = document.getElementById('file-upload') as HTMLInputElement | null; if (fi) fi.value = ''; }
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitStatus("submitting"); setSubmitError(null);
    if (!newScript.title || !newScript.description || (!newScript.code && !newScript.file)) { setSubmitStatus("error"); setSubmitError("Fill Title, Description & Code/File."); return; }
    if (newScript.code && newScript.file) { setSubmitStatus("error"); setSubmitError("Provide Code OR File, not both."); return; }
    try {
      let fileUrl: string | null = null;
      if (newScript.file) {
        const file = newScript.file; const uniqueFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`; const filePath = `public/${uniqueFileName}`;
        const { error: uploadError } = await supabase.storage.from(SCRIPT_FILES_BUCKET).upload(filePath, file);
        if (uploadError) { throw new Error(`Storage Upload Failed: ${uploadError.message || JSON.stringify(uploadError)}`); }
        const { data: urlData } = supabase.storage.from(SCRIPT_FILES_BUCKET).getPublicUrl(filePath); fileUrl = urlData?.publicUrl ?? null;
      }
      const scriptToInsert = { title: newScript.title, description: newScript.description, author: newScript.author || 'Anonymous', code: newScript.code || null, file_url: fileUrl, support_url: newScript.support_url || null, };
      const tableNameForInsert = "Earthie_scripts";
      const { data: insertedData, error: insertError } = await supabase.from(tableNameForInsert).insert([scriptToInsert]).select();
      if (insertError) { throw new Error(`Database Insert Failed: ${insertError.message || JSON.stringify(insertError)}`); }
      setSubmitStatus("success"); const successfullyInsertedScript = insertedData?.[0] as Script | undefined;
      if (successfullyInsertedScript) { setScripts(prevScripts => [successfullyInsertedScript, ...prevScripts]); } else { await fetchScripts(false); } // Refresh list
      setNewScript({ title: "", description: "", author: "", code: "", file: null, support_url: "" });
      const fi = document.getElementById('file-upload') as HTMLInputElement | null; if (fi) fi.value = '';
      setTimeout(() => { setSubmitStatus("idle"); }, 3000);
    } catch (err) { /* Existing error handling */ console.error("--- Submission Error ---"); console.error(err); let msg = 'Unknown error.'; if (err instanceof Error){msg = err.message;} else if(typeof err === 'string'){msg=err;} else{try{msg = JSON.stringify(err);}catch{}} setSubmitStatus("error"); setSubmitError(msg); }
  };
  const formatDate = (ds: string | null) => { if (!ds) return "N/A"; try { return new Date(ds).toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return "Invalid Date"; } }
  const generateFilename = (t: string, ext: string) => { const st = t.replace(/[^a-z0-9]/gi, '_').toLowerCase(); return `${st || 'script'}.${ext}`; }


  // --- Component Return / JSX ---
  return (
    <div className="container py-8 bg-earthie-dark min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-8 text-center">Earth2 Developer Tools</h1>
      <Tabs defaultValue="browse" className="w-full">
         <TabsList className="grid w-full grid-cols-2 mb-8 bg-earthie-dark-light">
            <TabsTrigger value="browse" className="data-[state=active]:bg-earthie-mint data-[state=active]:text-earthie-dark text-gray-300 data-[state=inactive]:hover:bg-earthie-dark data-[state=inactive]:hover:text-gray-100"> Browse Scripts </TabsTrigger>
            <TabsTrigger value="submit" className="data-[state=active]:bg-earthie-mint data-[state=active]:text-earthie-dark text-gray-300 data-[state=inactive]:hover:bg-earthie-dark data-[state=inactive]:hover:text-gray-100"> Submit Script </TabsTrigger>
         </TabsList>

        <TabsContent value="browse" className="space-y-6">
           {isLoading && ( <div className="flex justify-center items-center py-10"> <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading scripts... </div> )}
           {error && ( <div className="p-4 rounded-md bg-red-900/30 text-red-400 border border-red-700"> <p className="font-semibold">Error:</p> <p>{error}</p> </div> )}
           {!isLoading && !error && scripts.length === 0 && ( <p className="text-center text-gray-400 py-10">No scripts found.</p> )}

          {!isLoading && !error && scripts.map((script) => {
                // *** Use the helper function from outside, passing state ***
                const likedLocally = isLocallyLiked(script.id, locallyLikedScripts);
                // console.log(`Rendering ${script.id}, likedLocally: ${likedLocally}`); // Debug log

                return (
                    <Card key={script.id} className="bg-earthie-dark-light border-earthie-dark-light overflow-hidden">
                        <CardHeader> <CardTitle>{script.title}</CardTitle> {script.description && (<CardDescription className="text-gray-300 pt-1">{script.description}</CardDescription>)} </CardHeader>
                        <CardContent>
                            {script.code && (
                                <div className="relative group bg-earthie-dark p-4 rounded-md overflow-x-auto mb-4 max-h-96">
                                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-50 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white hover:bg-earthie-dark-light/50" onClick={() => handleCopyCode(script.id, script.code)} aria-label="Copy code"> {copiedStatus[script.id] ? (<Check className="h-4 w-4 text-earthie-mint" />) : (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /> </svg>)} </Button>
                                    <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words font-mono pr-10">{script.code}</pre>
                                </div>
                            )}
                            {script.file_url && (
                                <div className="mb-4"> <a href={script.file_url} target="_blank" rel="noopener noreferrer" download className={`inline-flex items-center px-3 py-1 border border-earthie-mint text-earthie-mint text-sm rounded hover:bg-earthie-mint/10 active:bg-earthie-mint/20 transition-colors ${downloadingStatus[script.id] ? 'opacity-50 cursor-wait' : ''}`} onClick={(e) => { if (downloadingStatus[script.id]) { e.preventDefault(); return; } handleDownload(script.id, () => {}); }} aria-disabled={downloadingStatus[script.id]} > <Download className="mr-2 h-4 w-4" /> Download Attached File </a> </div>
                            )}
                            {script.support_url && (
                                <div className="mt-2"> <a href={script.support_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center text-xs text-earthie-mint hover:underline"> <LinkIcon className="h-4 w-4 mr-1" /> Support the Author </a> </div>
                            )}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 text-sm text-gray-400 gap-2"> <span>By: <span className="font-medium text-gray-300">{script.author || 'Anonymous'}</span></span> <span>Posted: <span className="font-medium text-gray-300">{formatDate(script.created_at)}</span></span> </div>
                        </CardContent>
                        <CardFooter className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-earthie-dark/30 px-6 py-4">
                            <div className="flex items-center gap-4 text-gray-300">
                                <Button variant="ghost" size="sm" className="p-1 h-auto text-gray-400 hover:text-red-500 disabled:opacity-50" onClick={() => toggleLike(script.id)} disabled={likingStatus[script.id]} >
                                    <Heart className={`h-5 w-5 ${likingStatus[script.id] ? 'animate-pulse' : ''} ${likedLocally ? 'fill-red-500 text-red-500' : 'fill-none'}`} /> {/* Use likedLocally variable */}
                                </Button>
                                <span className="text-sm whitespace-nowrap" title={`${script.likes ?? 0} likes`}>{script.likes ?? 0} likes</span>
                                <span className="text-sm whitespace-nowrap" title={`${script.downloads ?? 0} downloads`}>{script.downloads ?? 0} downloads</span>
                            </div>
                            {script.code && (
                                <Button variant="outline" size="sm" className={`text-earthie-mint border-earthie-mint hover:bg-earthie-mint/10 active:bg-earthie-mint/20 w-full sm:w-auto ${downloadingStatus[script.id] ? 'opacity-50 cursor-wait' : ''}`} onClick={(e) => { if (downloadingStatus[script.id]) return; handleDownload(script.id, () => { const blob = new Blob([script.code ?? ''], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = generateFilename(script.title, 'txt'); document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }); }} disabled={downloadingStatus[script.id]} >
                                    <Download className="mr-2 h-4 w-4" /> Download Code Snippet
                                </Button>
                            )}
                            {!script.code && script.file_url && (<div className="text-sm text-gray-500 italic text-right w-full sm:w-auto"> (File attached)</div>)}
                        </CardFooter>
                    </Card>
                );
          })}
        </TabsContent>

        {/* Submit Tab Content */}
        <TabsContent value="submit">
             <Card className="bg-earthie-dark-light border-earthie-dark-light">
                 <CardHeader> <CardTitle>Submit Your Script or File</CardTitle> <CardDescription className="text-gray-300"> Share your Earth2 utilities. Provide code OR upload file. </CardDescription> </CardHeader>
                 <CardContent>
                     <form onSubmit={handleSubmit} className="space-y-6">
                         {/* Inputs: Title, Author, Support Link, Description, Code, File Upload */}
                         <div className="space-y-2"> <Label htmlFor="title" className="text-white"> Title * </Label> <Input id="title" placeholder="e.g., Auto Tile Analyzer..." value={newScript.title} onChange={(e) => setNewScript({ ...newScript, title: e.target.value })} className="bg-earthie-dark border-earthie-dark-light text-white placeholder-gray-500" required disabled={submitStatus === 'submitting'} /> </div>
                         <div className="space-y-2"> <Label htmlFor="author" className="text-white"> Your Name / Alias </Label> <Input id="author" placeholder="Optional" value={newScript.author} onChange={(e) => setNewScript({ ...newScript, author: e.target.value })} className="bg-earthie-dark border-earthie-dark-light text-white placeholder-gray-500" disabled={submitStatus === 'submitting'} /> </div>
                         <div className="space-y-2"> <Label htmlFor="support_url" className="text-white"> Support Link (Optional) </Label> <Input id="support_url" type="url" placeholder="e.g., https://patreon.com/..." value={newScript.support_url} onChange={(e) => setNewScript({ ...newScript, support_url: e.target.value })} className="bg-earthie-dark border-earthie-dark-light text-white placeholder-gray-500" disabled={submitStatus === 'submitting'} /> <p className="text-xs text-gray-400">Link where others can support you.</p> </div>
                         <div className="space-y-2"> <Label htmlFor="description" className="text-white"> Description * </Label> <Textarea id="description" placeholder="Explain what it does..." rows={4} value={newScript.description} onChange={(e) => setNewScript({ ...newScript, description: e.target.value })} className="bg-earthie-dark border-earthie-dark-light text-white placeholder-gray-500" required disabled={submitStatus === 'submitting'} /> </div>
                         <div className="space-y-2"> <Label htmlFor="code" className="text-white"> Script Code (Paste Here) </Label> <Textarea id="code" placeholder="Paste code..." rows={10} className="font-mono bg-earthie-dark border-earthie-dark-light text-white placeholder-gray-500 disabled:opacity-50" value={newScript.code} onChange={handleCodeChange} disabled={!!newScript.file || submitStatus === 'submitting'} /> </div>
                         <div className="space-y-2"> <Label className="block text-white"> Or Upload File </Label> <div> <Input id="file-upload" type="file" onChange={handleFileChange} className="hidden" disabled={!!newScript.code || submitStatus === 'submitting'} accept=".js,.jsx,.ts,.tsx,.txt,.zip,.py,.sh,.json,.css,.html" /> <Label htmlFor="file-upload" className={`inline-flex items-center px-4 py-2 rounded border border-earthie-mint text-earthie-mint text-sm font-medium hover:bg-earthie-mint/10 active:bg-earthie-mint/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-earthie-mint focus-visible:ring-offset-2 focus-visible:ring-offset-earthie-dark transition-colors ${(!!newScript.code || submitStatus === 'submitting') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer' }`} > <Upload className="mr-2 h-4 w-4" /> {newScript.file ? 'Change File' : 'Choose File'} </Label> </div> {newScript.file && ( <p className="text-sm text-gray-400 pt-1">Selected: <span className="font-medium text-gray-300">{newScript.file.name}</span></p> )} {!newScript.code && !newScript.file && ( <p className="text-sm text-gray-400 italic">Provide code OR choose file.</p> )} </div>
                         {/* Submit Button */} <div className="flex justify-end pt-4"> <Button type="submit" className="bg-earthie-mint text-earthie-dark hover:bg-earthie-mint/90 disabled:opacity-50" disabled={submitStatus === 'submitting' || (!newScript.code && !newScript.file) || !newScript.title || !newScript.description} > {submitStatus === 'submitting' ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Upload className="mr-2 h-4 w-4" /> )} {submitStatus === 'submitting' ? 'Submitting...' : 'Submit Script/File'} </Button> </div>
                     </form>
                 </CardContent>
                 {/* Submission Status Feedback */}
                 {submitStatus !== "idle" && submitStatus !== "submitting" && ( <CardFooter> <div className={`w-full p-3 rounded-md flex items-start text-sm ${ submitStatus === "success" ? "bg-green-900/30 text-green-300 border border-green-700" : "bg-red-900/30 text-red-300 border border-red-700" }`} > {submitStatus === "success" ? ( <> <Check className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" /> <span>Submission successful!</span> </> ) : ( <> <X className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" /> <span>{ submitError || "Submission failed."}</span> </> )} </div> </CardFooter> )}
             </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}