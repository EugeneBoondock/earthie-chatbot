"use client"

import React, { useState, useEffect, useCallback } from "react"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Check, X, Loader2, Download } from "lucide-react"

// --- Supabase Configuration ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Ensure keys are provided
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key are required.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)
const SCRIPT_FILES_BUCKET = 'script-files'; // Match the bucket name you created

// --- Types ---
type Script = {
  id: string
  created_at: string
  title: string
  description: string
  author: string | null
  code: string | null // Allow code to be null if file is provided
  likes: number
  downloads: number
  file_url: string | null
}

type NewScriptData = {
  title: string
  description: string
  author: string
  code: string
  file: File | null
}

export default function DevToolsPage() {
  const [scripts, setScripts] = useState<Script[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [newScript, setNewScript] = useState<NewScriptData>({
    title: "",
    description: "",
    author: "",
    code: "",
    file: null,
  })
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [submitError, setSubmitError] = useState<string | null>(null);

  // --- Data Fetching ---
  // --- Data Fetching ---
  const fetchScripts = useCallback(async () => {
    console.log("--- Starting fetchScripts ---");
    setIsLoading(true);
    setError(null);
    try {
      console.log("Attempting to fetch from table: scripts"); // Confirm table name used
      const { data, error: fetchError } = await supabase
        .from("Earthie_scripts") // Make absolutely sure this table name is correct!
        .select("*")
        .order("created_at", { ascending: false });

      // Check specifically for fetchError
      if (fetchError) {
        console.error("!!! Supabase Fetch Error Object:", fetchError);
        // Throw the specific error object so the catch block can inspect it
        throw fetchError;
      }

      console.log("Fetch successful. Data received:", data);
      setScripts(data || []);

    } catch (err: any) {
      console.error("--- Error caught in fetchScripts catch block ---");
      console.error("Full error object during fetch:", err); // Log the raw error object

      // Attempt to extract a meaningful message
      let errorMessage = 'Unknown error fetching scripts.';
      if (err instanceof Error && err.message) {
          errorMessage = err.message;
      } else if (err && typeof err === 'object') {
           // Check common Supabase error properties
           if ('message' in err && typeof err.message === 'string' && err.message) {
               errorMessage = err.message;
           } else if ('details' in err && typeof err.details === 'string' && err.details) {
               errorMessage = `Details: ${err.details}`;
           } else if ('hint' in err && typeof err.hint === 'string' && err.hint) {
               errorMessage = `Hint: ${err.hint}`;
           } else if ('code' in err && typeof err.code === 'string' && err.code) {
                errorMessage = `Code: ${err.code}`;
           } else {
               // Fallback stringify
               try { errorMessage = `Unexpected error structure: ${JSON.stringify(err)}`; } catch { /* ignore */ }
           }
      } else if (typeof err === 'string' && err) {
          errorMessage = err;
      }

      console.error("Processed Fetch Error Message:", errorMessage);
      setError(`Failed to load scripts: ${errorMessage}. Please try refreshing.`); // Set the detailed error

    } finally {
      console.log("--- Finished fetchScripts ---");
      setIsLoading(false);
    }
  }, []); // Dependencies for useCallback are empty, which is correct here.

  useEffect(() => {
    fetchScripts()
  }, [fetchScripts])

  // --- Form Handling ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    // Clear code if a file is selected
    setNewScript(prev => ({
        ...prev,
        file: file,
        code: file ? "" : prev.code // Clear code if file selected
    }));
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const code = e.target.value;
       // Clear file if code is entered
      setNewScript(prev => ({
          ...prev,
          code: code,
          file: code ? null : prev.file // Clear file if code entered
      }));
       // Also clear the file input visually if code is entered
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

    // Validation
    if (!newScript.title || !newScript.description || (!newScript.code && !newScript.file)) {
      console.log("Validation Failed: Missing required fields.");
      setSubmitStatus("error");
      setSubmitError("Please fill in Title, Description, and provide either Code or a File.");
      return;
    }
    if (newScript.code && newScript.file) {
      console.log("Validation Failed: Both code and file provided.");
      setSubmitStatus("error");
      setSubmitError("Please provide either Code *or* a File, not both.");
      return;
    }

    try {
      let fileUrl: string | null = null;
      let filePathForDb: string | null = null; // Store relative path if needed

      // --- File Upload Logic ---
      if (newScript.file) {
        console.log("Attempting file upload...");
        const file = newScript.file;
        const uniqueFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const filePath = `public/${uniqueFileName}`; // Path within the bucket
        filePathForDb = filePath; // Store relative path
        console.log(`Uploading file to bucket: ${SCRIPT_FILES_BUCKET}, path: ${filePath}`);

        // 1a. Upload file
        const { error: uploadError } = await supabase.storage
          .from(SCRIPT_FILES_BUCKET)
          .upload(filePath, file);

        // Check for upload error
        if (uploadError) {
          console.error("!!! Supabase Storage Upload Error:", uploadError);
          // Rethrow specifically formatted error
          throw new Error(`Storage Upload Failed: ${uploadError.message || JSON.stringify(uploadError)}`);
        }
        console.log("File upload successful.");

        // 1b. Get public URL
        console.log("Attempting to get public URL...");
        const { data: urlData, error: urlError } = supabase.storage // Removed await here, getPublicUrl isn't async
          .from(SCRIPT_FILES_BUCKET)
          .getPublicUrl(filePath);

         // Check for URL error (though getPublicUrl rarely throws, it might return null data)
         if (urlError) {
             console.error("!!! Supabase Get Public URL Error:", urlError);
             // Log warning but maybe proceed if upload worked? Depends on requirements.
             // For now, let's treat it as a failure point if URL is needed.
             throw new Error(`Failed to get Public URL: ${urlError.message || JSON.stringify(urlError)}`);
         }

        if (!urlData?.publicUrl) {
          console.warn(`Could not get public URL for path: ${filePath}. URL Data received:`, urlData);
          // Decide if this is critical. If the URL MUST be stored, throw error.
           throw new Error(`Could not get public URL for path: ${filePath}. Upload might have succeeded, but URL generation failed.`);
        }

        fileUrl = urlData.publicUrl;
        console.log("Public URL obtained:", fileUrl);

      } else {
        console.log("No file provided, skipping upload.");
      }

      // --- Database Insert Logic ---
      const scriptToInsert = {
        title: newScript.title,
        description: newScript.description,
        author: newScript.author || 'Anonymous',
        code: newScript.code || null,
        file_url: fileUrl,
      };
      console.log("Attempting database insert with data:", scriptToInsert);

      // ***** ADD THIS SECTION *****
      const tableNameForInsert = "Earthie_scripts"; // Explicitly define the string
      console.log(`>>> CONFIRM: Table name being passed to .from() is: '${tableNameForInsert}' <<<`);
      // ***************************

      // 2. Insert data into the table
      const { data: insertedData, error: insertError } = await supabase
        .from(tableNameForInsert) // Use the variable here
        .insert([scriptToInsert])
        .select(); 

      // Check for insert error
      if (insertError) {
        console.error("!!! Supabase Insert Error:", insertError);
        // Rethrow specifically formatted error
        throw new Error(`Database Insert Failed: ${insertError.message || JSON.stringify(insertError)}`);
      }

      console.log("Database insert successful. Inserted data:", insertedData);

      // --- Success Handling ---
      setSubmitStatus("success");
      const successfullyInsertedScript = insertedData?.[0] as Script | undefined;

      if (successfullyInsertedScript) {
        console.log("Adding new script to local state.");
        setScripts(prevScripts => [successfullyInsertedScript, ...prevScripts]);
      } else {
        console.warn("Insert successful but no data returned, refetching list.");
        fetchScripts(); // Refetch to be safe
      }

      // Reset form
      console.log("Resetting form.");
      setNewScript({ title: "", description: "", author: "", code: "", file: null });
      const fileInput = document.getElementById('file-upload') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';

      // Reset status message after delay
      setTimeout(() => {
        setSubmitStatus("idle");
      }, 3000);
      console.log("--- Submission Complete ---");

    } catch (err) { // Catch block remains largely the same, but errors thrown above should have messages now
        console.error("--- Submission Error Caught ---");
        console.error("Full error object during submission:", err); // Log the raw error
        let errorMessage = 'Unknown error during submission.';

        if (err instanceof Error) {
            errorMessage = err.message; // Use the message from errors thrown above
        } else if (typeof err === 'string') {
            errorMessage = err;
        } else {
            // Fallback for unexpected error types
            try { errorMessage = `Unexpected error structure: ${JSON.stringify(err)}`; } catch { /* ignore stringify error */ }
        }
        console.error("Processed Error Message:", errorMessage);

        setSubmitStatus("error");
        setSubmitError(errorMessage); // Show the more specific error message
    }
  };
  // Helper to format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: 'numeric', month: 'short', day: 'numeric'
      })
    } catch (e) {
      return "Invalid Date";
    }
  }

  // Helper to generate download filename
  const generateFilename = (title: string, extension: string) => {
      const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      return `${safeTitle || 'script'}.${extension}`;
  }


  return (
    <div className="container py-8 bg-earthie-dark min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-8 text-center">Earth2 Developer Tools</h1>

      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 bg-earthie-dark-light">
          <TabsTrigger
            value="browse"
            className="data-[state=active]:bg-earthie-mint data-[state=active]:text-earthie-dark text-gray-300 data-[state=inactive]:hover:bg-earthie-dark data-[state=inactive]:hover:text-gray-100"
          >
            Browse Scripts
          </TabsTrigger>
          <TabsTrigger
            value="submit"
            className="data-[state=active]:bg-earthie-mint data-[state=active]:text-earthie-dark text-gray-300 data-[state=inactive]:hover:bg-earthie-dark data-[state=inactive]:hover:text-gray-100"
          >
            Submit Script
          </TabsTrigger>
        </TabsList>

        {/* Browse Tab Content */}
        <TabsContent value="browse" className="space-y-6">
          {isLoading && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading scripts...
            </div>
          )}
          {error && (
            <div className="p-4 rounded-md bg-red-900/30 text-red-400 border border-red-700">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}
          {!isLoading && !error && scripts.length === 0 && (
            <p className="text-center text-gray-400 py-10">No scripts found. Be the first to submit one!</p>
          )}
          {!isLoading && !error && scripts.map((script) => (
            <Card key={script.id} className="bg-earthie-dark-light border-earthie-dark-light overflow-hidden">
              <CardHeader>
                <CardTitle>{script.title}</CardTitle>
                 {script.description && (
                    <CardDescription className="text-gray-300 pt-1">{script.description}</CardDescription>
                 )}
              </CardHeader>
              <CardContent>
                {/* Display Code if available */}
                {script.code && (
                    <div className="bg-earthie-dark p-4 rounded-md overflow-x-auto mb-4 max-h-96">
                        <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words font-mono">{script.code}</pre>
                    </div>
                )}
                {/* Display File Download Link if available */}
                {script.file_url && (
                     <div className="mb-4">
                        <a
                            href={script.file_url}
                            target="_blank" // Opens in new tab, allows browser PDF viewer etc.
                            rel="noopener noreferrer"
                            download // Suggests download, but behavior depends on browser & server Content-Disposition
                            className="inline-flex items-center px-3 py-1 border border-earthie-mint text-earthie-mint text-sm rounded hover:bg-earthie-mint/10 active:bg-earthie-mint/20 transition-colors"
                            // Add onClick handler to potentially increment download count here later
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download Attached File
                        </a>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 text-sm text-gray-400 gap-2">
                  <span>By: <span className="font-medium text-gray-300">{script.author || 'Anonymous'}</span></span>
                  <span>Posted: <span className="font-medium text-gray-300">{formatDate(script.created_at)}</span></span>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-earthie-dark/30 px-6 py-4">
                 <div className="flex items-center gap-4 text-gray-300">
                  {/* Placeholder for Like/Download counts - Implement interaction later */}
                  <span className="text-sm whitespace-nowrap">{script.likes ?? 0} likes</span>
                  <span className="text-sm whitespace-nowrap">{script.downloads ?? 0} downloads</span>
                </div>
                 {/* Button to download the raw code snippet if it exists */}
                 {script.code && (
                     <Button
                        variant="outline"
                        size="sm"
                        className="text-earthie-mint border-earthie-mint hover:bg-earthie-mint/10 active:bg-earthie-mint/20 w-full sm:w-auto"
                        onClick={(e) => {
                            e.preventDefault(); // Prevent any default form action if needed
                            const blob = new Blob([script.code ?? ''], { type: 'text/plain;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = generateFilename(script.title, 'txt'); // Use helper for filename
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            // Optionally increment download count here
                        }}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Download Code Snippet
                    </Button>
                 )}
                  {/* If only a file exists, maybe disable or hide the code snippet button */}
                  {!script.code && script.file_url && (
                     <div className="text-sm text-gray-500 italic text-right w-full sm:w-auto"> (File attached)</div>
                  )}
              </CardFooter>
            </Card>
          ))}
        </TabsContent>

        {/* Submit Tab Content */}
        <TabsContent value="submit">
          <Card className="bg-earthie-dark-light border-earthie-dark-light">
            <CardHeader>
              <CardTitle>Submit Your Script or File</CardTitle>
              <CardDescription className="text-gray-300">
                Share your Earth2 utilities with the community. Provide either code pasted below OR upload a file.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Title Input */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-white">
                    Title *
                  </Label>
                  <Input
                    id="title"
                    placeholder="e.g., Auto Tile Analyzer, Resource Map Helper"
                    value={newScript.title}
                    onChange={(e) => setNewScript({ ...newScript, title: e.target.value })}
                    className="bg-earthie-dark border-earthie-dark-light text-white placeholder-gray-500"
                    required
                    disabled={submitStatus === 'submitting'}
                  />
                </div>

                 {/* Author Input */}
                 <div className="space-y-2">
                  <Label htmlFor="author" className="text-white">
                    Your Name / Alias
                  </Label>
                  <Input
                    id="author"
                    placeholder="Optional (defaults to Anonymous)"
                    value={newScript.author}
                    onChange={(e) => setNewScript({ ...newScript, author: e.target.value })}
                    className="bg-earthie-dark border-earthie-dark-light text-white placeholder-gray-500"
                    disabled={submitStatus === 'submitting'}
                  />
                </div>

                {/* Description Input */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-white">
                    Description *
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Explain what it does, how to use it, any requirements..."
                    rows={4}
                    value={newScript.description}
                    onChange={(e) => setNewScript({ ...newScript, description: e.target.value })}
                    className="bg-earthie-dark border-earthie-dark-light text-white placeholder-gray-500"
                    required
                    disabled={submitStatus === 'submitting'}
                  />
                </div>

                 {/* Code Input */}
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-white">
                    Script Code (Paste Here)
                  </Label>
                  <Textarea
                    id="code"
                    placeholder="Paste your script code here..."
                    rows={10}
                    className="font-mono bg-earthie-dark border-earthie-dark-light text-white placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    value={newScript.code}
                    onChange={handleCodeChange} // Use specific handler
                    disabled={!!newScript.file || submitStatus === 'submitting'} // Disable if a file is selected OR submitting
                  />
                </div>

                 {/* File Upload Input - Updated Approach */}
                 <div className="space-y-2">
                    <Label className="text-white d-block mb-1"> {/* Ensure label is block or flex for spacing */}
                        Or Upload File (e.g., .js, .txt, .zip)
                    </Label>
                    {/* Visually hidden actual file input */}
                    <Input
                        id="file-upload" // Keep the ID for the label
                        type="file"
                        onChange={handleFileChange}
                        className="hidden" // Hide the default input UI
                        // Disable if code entered OR submitting
                        disabled={!!newScript.code || submitStatus === 'submitting'}
                        accept=".js,.jsx,.ts,.tsx,.txt,.zip,.py,.sh,.json,.css,.html" // Expanded common types
                    />
                    {/* Styled Label acting as the button */}
                    <Label
                      htmlFor="file-upload" // Connects label to the hidden input
                      className={`inline-flex items-center px-4 py-2 rounded border border-earthie-mint text-earthie-mint text-sm font-medium hover:bg-earthie-mint/10 active:bg-earthie-mint/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-earthie-mint focus-visible:ring-offset-2 focus-visible:ring-offset-earthie-dark transition-colors ${
                        (!!newScript.code || submitStatus === 'submitting')
                          ? 'opacity-50 cursor-not-allowed' // Style when disabled
                          : 'cursor-pointer' // Style when enabled
                      }`}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {newScript.file ? 'Change File' : 'Choose File'}
                    </Label>

                     {/* Display selected file name */}
                     {newScript.file && (
                        <p className="text-sm text-gray-400 pt-1">Selected: <span className="font-medium text-gray-300">{newScript.file.name}</span></p>
                    )}
                     {/* Display interaction hint */}
                     {!newScript.code && !newScript.file && (
                       <p className="text-sm text-gray-400 italic">Provide code above OR choose a file.</p>
                     )}
                </div>


                {/* Submit Button */}
                <div className="flex justify-end pt-4">
                  <Button
                    type="submit"
                    className="bg-earthie-mint text-earthie-dark hover:bg-earthie-mint/90 disabled:opacity-50"
                    disabled={submitStatus === 'submitting' || (!newScript.code && !newScript.file) || !newScript.title || !newScript.description}
                  >
                    {submitStatus === 'submitting' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Upload className="mr-2 h-4 w-4" />
                    )}
                    {submitStatus === 'submitting' ? 'Submitting...' : 'Submit Script/File'}
                  </Button>
                </div>
              </form>
            </CardContent>

            {/* Submission Status Feedback */}
            {submitStatus !== "idle" && submitStatus !== "submitting" && (
              <CardFooter>
                <div
                  className={`w-full p-3 rounded-md flex items-start text-sm ${ // items-start for long messages
                    submitStatus === "success" ? "bg-green-900/30 text-green-300 border border-green-700" : "bg-red-900/30 text-red-300 border border-red-700"
                  }`}
                >
                  {submitStatus === "success" ? (
                    <>
                      <Check className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                      <span>Submission successful! Thank you for your contribution. It may take some time to appear after review.</span>
                    </>
                  ) : ( // submitStatus === "error"
                    <>
                      <X className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                      <span>{ submitError || "Submission failed. Please check the form and try again."}</span>
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