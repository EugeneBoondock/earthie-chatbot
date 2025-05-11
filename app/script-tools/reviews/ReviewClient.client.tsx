"use client"

import React, { useState, useEffect, useCallback } from "react"
import { User, createClient, SupabaseClient } from '@supabase/supabase-js'
import { Card, CardHeader, CardContent, CardDescription, CardFooter, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Check, X } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface ReviewClientProps {
  user: User
  username: string | null
}

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

// Script type definition based on the Earthie_scripts table
interface Script {
  id: string
  title: string
  description: string | null
  author: string | null
  code: string | null
  file_url: string | null
  created_at: string
  support_url: string | null
  download_count: number | null
  like_count: number | null
  review_method: string | null
  review_by: string | null
  review_comment: string | null
  reviewed_at: string | null
  metadata: {
    review_badge?: string
    review_approved?: boolean
    submission_source?: string
  } | null
}

export default function ReviewClient({ user, username }: ReviewClientProps) {
  // State for scripts and UI
  const [scripts, setScripts] = useState<Script[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchingFileContent, setFetchingFileContent] = useState<Set<string>>(new Set())
  
  // State for review form
  const [reviewOpenId, setReviewOpenId] = useState<string | null>(null)
  const [reviewStatus, setReviewStatus] = useState<string>('')
  const [reviewMethod, setReviewMethod] = useState<string>('')
  const [reviewComment, setReviewComment] = useState<string>('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  
  // Format date helper
  const formatDate = (ds: string | null) => { 
    if (!ds) return "N/A"; 
    try { 
      return new Date(ds).toLocaleDateString("en-US", { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }); 
    } catch (e) { 
      return "Invalid Date"; 
    } 
  }

  // Helper to determine if a filename corresponds to a preview-able text file
  const isTextBasedFile = (filename: string): boolean => {
    const textExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'sh', 'json', 'css', 'html', 'txt', 'md', 'csv'];
    const extMatch = filename.split('.').pop()?.toLowerCase();
    return extMatch ? textExts.includes(extMatch) : false;
  };

  // Fetch file content for text-based files
  useEffect(() => {
    const fetchMissingCode = async () => {
      // Identify scripts that need their code fetched
      const scriptsToFetch = scripts.filter(script => 
        !script.code && 
        script.file_url && 
        isTextBasedFile(script.file_url) && 
        !fetchingFileContent.has(script.id)
      );

      if (scriptsToFetch.length === 0) {
        return;
      }

      // Mark scripts as fetching
      setFetchingFileContent(prev => {
        const next = new Set(prev);
        scriptsToFetch.forEach(s => next.add(s.id));
        return next;
      });

      const updatedScriptsPromises = scriptsToFetch.map(async (script) => {
        try {
          console.log(`Fetching content for file: ${script.file_url}`);
          const resp = await fetch(script.file_url!); // script.file_url is checked in filter
          if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText} for ${script.file_url}`);
          const text = await resp.text();
          console.log(`Successfully fetched content for ${script.file_url}`);
          return { ...script, code: text };
        } catch (err) {
          console.error(`Failed to fetch file content for script ${script.id} (${script.file_url}):`, err);
          return script; // Return unchanged on failure
        }
      });

      const fetchedScriptContents = await Promise.all(updatedScriptsPromises);

      // Update the main scripts array with the fetched content
      setScripts(currentScripts => {
        const newScripts = currentScripts.map(s => {
          const updatedVersion = fetchedScriptContents.find(fs => fs.id === s.id && fs.code !== s.code);
          return updatedVersion || s;
        });
        // Only trigger re-render if there are actual changes
        if (JSON.stringify(newScripts) !== JSON.stringify(currentScripts)) {
            return newScripts;
        }
        return currentScripts;
      });
      
      // Unmark scripts from fetching
      setFetchingFileContent(prev => {
        const next = new Set(prev);
        scriptsToFetch.forEach(s => next.delete(s.id));
        return next;
      });
    };

    // Only run if there are scripts and some might need fetching
    if (scripts.length > 0 && scripts.some(s => !s.code && s.file_url && isTextBasedFile(s.file_url))) {
      fetchMissingCode();
    }
    // The main dependency is 'scripts', but the internal logic prevents infinite loops.
    // An alternative could be to use a separate state to trigger this effect only once after initial script load.
    // For now, the internal checks should be sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scripts, fetchingFileContent]); // Added fetchingFileContent to dependencies to ensure re-evaluation when it changes.

  // Fetch scripts from the database
  const fetchScripts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      console.log("--- Starting fetchScripts in ReviewClient ---");
      
      // First, check if the user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log("User not authenticated, might affect permissions");
      } else {
        console.log("Authenticated as:", session.user.email);
      }
      
      // Log exact API URL for debugging
      const apiUrl = `${supabaseUrl}/rest/v1/Earthie_scripts?select=*&order=created_at.desc`;
      console.log("Direct API URL:", apiUrl);
      
      console.log("Attempting to fetch from table: Earthie_scripts");
      const { data, error: fetchError } = await supabase
        .from("Earthie_scripts")
        .select("*")
        .order("created_at", { ascending: false });
      
      console.log("Raw response data:", data);
      
      if (fetchError) { 
        console.error("Error fetching scripts:", fetchError);
        throw fetchError;
      }
      
      if (!data || data.length === 0) {
        console.log("No scripts found in the database");
        
        // Try fetching with a direct fetch request to debug
        console.log("Attempting direct fetch to API URL...");
        try {
          const headers: Record<string, string> = {
            'apikey': supabaseAnonKey || '',
            'Authorization': `Bearer ${supabaseAnonKey || ''}`,
            'Content-Type': 'application/json'
          };
          
          // Add session auth if available
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: headers
          });
          
          if (response.ok) {
            const directData = await response.json();
            console.log("Direct fetch response:", directData);
            if (directData && directData.length > 0) {
              console.log("Direct fetch successful with data!");
              setScripts(directData);
              return;
            }
          } else {
            console.log("Direct fetch failed:", response.status, response.statusText);
          }
        } catch (directErr) {
          console.error("Direct fetch error:", directErr);
        }
      } else {
        console.log("Fetch successful. Data received:", data.length);
        console.log("First script:", data[0]);
      }
      
      setScripts(data || []);
    } catch (err: any) {
      console.error("--- Error caught in fetchScripts catch block ---");
      console.error("Full error object:", err);
      let msg = 'Unknown fetch error.';
      if (err instanceof Error) {
        msg = err.message;
      } else if(typeof err === 'string') {
        msg = err;
      } else if(err && typeof err === 'object') {
        if(err.message) {
          msg = err.message;
        } else {
          try {
            msg = JSON.stringify(err);
          } catch {}
        }
      }
      setError(`Failed to load scripts: ${msg}. Refresh?`);
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load scripts on component mount
  useEffect(() => {
    fetchScripts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Allow manual refreshing
  const handleRetry = () => {
    fetchScripts();
  };

  // Submit review
  const handleReviewSubmit = useCallback(async (scriptId: string) => {
    if (!reviewStatus || !reviewMethod || !reviewComment || !user) return
    setReviewSubmitting(true)
    
    try {
      const displayName = username || user.user_metadata?.username || user.email || "Unknown Reviewer"
      const reviewerUserId = user.id;
      
      let reviewBadgeText = ''
      let reviewApproved = false

      switch (reviewStatus) {
        case 'good':
          reviewBadgeText = 'Approved'
          reviewApproved = true
          break
        case 'caution':
          reviewBadgeText = 'Caution'
          reviewApproved = false
          break
        case 'danger':
          reviewBadgeText = 'Danger'
          reviewApproved = false
          break
        default:
          break
      }

      console.log("Submitting review:", {
        scriptId,
        status: reviewStatus,
        method: reviewMethod,
        reviewedBy_log: displayName,
        reviewerId_for_db: reviewerUserId,
        reviewComment,
        metadata: {
          review_badge: reviewBadgeText,
          review_approved: reviewApproved,
        }
      })
      
      const { error } = await supabase
        .from("Earthie_scripts")
        .update({
          review_method: reviewMethod,
          review_by: reviewerUserId,
          review_comment: reviewComment,
          reviewed_at: new Date().toISOString(),
          metadata: {
            ...(scripts.find(s => s.id === scriptId)?.metadata || {}),
            review_badge: reviewBadgeText,
            review_approved: reviewApproved,
            review_status_raw: reviewStatus,
          }
        })
        .eq("id", scriptId)
      
      if (error) {
        console.error("Review update error:", error)
        alert("Failed to submit review: " + error.message)
      } else {
        console.log("Review submitted successfully")
        await fetchScripts()
      }
    } catch (err) {
      console.error("Error in review submission:", err)
      alert("An error occurred while submitting your review")
    } finally {
      setReviewSubmitting(false)
      setReviewOpenId(null)
      setReviewStatus('')
      setReviewMethod('')
    }
  }, [reviewStatus, reviewMethod, reviewComment, user, username, fetchScripts, scripts])

  if (isLoading) {
    return (
      <div className="container py-12 text-white">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading scripts...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container py-12 text-white">
        <div className="p-4 bg-red-900/20 border border-red-700 rounded-md">
          <p className="text-red-300">{error}</p>
          <Button onClick={handleRetry} className="mt-2">Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-12 text-white">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Script Review Dashboard</h1>
          <p className="text-gray-400">Reviewing as {username || user.email}</p>
        </div>
      </div>
      
      {scripts.length === 0 ? (
        <div className="p-4 bg-slate-800 rounded-md">
          <p>No scripts found for review.</p>
          <div className="mt-4">
            <p className="text-sm text-gray-400 mb-2">
              The Earthie_scripts table may be empty. Use the button above to create a test script or try these troubleshooting steps:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-400 space-y-1 ml-2">
              <li>Check browser console for detailed error messages</li>
              <li>Verify that Supabase connection is working</li>
              <li>Ensure the Earthie_scripts table exists in your database</li>
              <li>Check RLS policies allow read access to the table</li>
            </ul>
            <Button onClick={handleRetry} className="mt-3">Retry Loading Scripts</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {scripts.map((script) => {
            // Determine badge styles based on review status
            let badgeText = null
            let badgeType = 'default'
            
            if (script.review_method) {
              badgeText = `Reviewed: ${script.review_method}`
              badgeType = 'success'
            }
            
            return (
              <Card key={script.id} className="bg-earthie-dark-light border-earthie-dark-light overflow-hidden">
                <CardHeader>
                  <div className="flex items-center flex-wrap gap-2">
                    <CardTitle>{script.title}</CardTitle>
                    {badgeText && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        badgeType === 'success' ? 'bg-emerald-100 text-emerald-800' :
                        badgeType === 'warning' ? 'bg-amber-100 text-amber-800' :
                        badgeType === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {badgeType === 'success' && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500"></span>}
                        {badgeType === 'warning' && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-amber-500"></span>}
                        {badgeType === 'error' && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-red-500"></span>}
                        {badgeText}
                      </span>
                    )}
                  </div>
                  {script.description && (<CardDescription className="text-gray-300 pt-1">{script.description}</CardDescription>)}
                  <div className="text-xs text-gray-400 mt-1">
                    <span>Added {formatDate(script.created_at)}</span>
                    {script.author && <span> • Author: {script.author}</span>}
                  </div>
                </CardHeader>
                
                <CardContent>
                  {/* Code display - show either fetched code or loading state for files */}
                  {script.code && (
                    <div className="bg-gray-900 rounded-md p-3 mb-3 max-h-64 overflow-auto">
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap">{script.code}</pre>
                    </div>
                  )}
                  
                  {/* Show loading state for files being fetched */}
                  {!script.code && script.file_url && fetchingFileContent.has(script.id) && (
                    <div className="bg-gray-900 rounded-md p-3 mb-3 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm text-gray-400">Loading file content...</span>
                    </div>
                  )}
                  
                  {/* Show file link if it's not a text file or failed to load */}
                  {!script.code && script.file_url && !fetchingFileContent.has(script.id) && (
                    <div className="bg-gray-900 rounded-md p-3 mb-3">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-300 mb-2">
                          This script was uploaded as a file:
                        </span>
                        <a 
                          href={script.file_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-blue-400 hover:text-blue-300 hover:underline text-sm break-all"
                        >
                          {script.file_url.split('/').pop()}
                        </a>
                        <Button 
                          className="mt-3" 
                          size="sm" 
                          variant="outline"
                          onClick={() => script.file_url && window.open(script.file_url, '_blank')}
                        >
                          View Raw File
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Display support URL if available */}
                  {script.support_url && (
                    <div className="mt-2">
                      <a 
                        href={script.support_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        Support the Author
                      </a>
                    </div>
                  )}
                  
                  {/* Script metadata */}
                  <div className="text-xs text-gray-400 mt-4">
                    <span>Added {formatDate(script.created_at)}</span>
                    {script.author && <span> • Author: {script.author}</span>}
                  </div>
                  
                  {/* Display existing reviews */}
                  {script.review_method && (
                    <div className="mt-1 flex items-center space-x-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-earthie-yellow text-earthie-dark text-xs font-medium">
                        {script.review_method}{script.review_by ? ` by ${script.review_by}` : ""}
                      </span>
                      {script.review_comment && (
                        <span className="text-xs text-gray-400">{script.review_comment}</span>
                      )}
                    </div>
                  )}
                  
                  {/* Add review button - Only show if not yet reviewed */}
                  {!script.review_method && (
                    <div className="mt-3">
                      <Button variant="outline" size="sm" onClick={() => { 
                        setReviewOpenId(script.id); 
                        setReviewStatus(''); 
                        setReviewMethod('');
                        setReviewComment(''); 
                      }}>
                        Review
                      </Button>
                    </div>
                  )}
                  
                  {/* Review form */}
                  {reviewOpenId === script.id && (
                    <div className="mt-4 space-y-3">
                      {/* Select for review status */}
                      <div>
                        <label htmlFor={`review-status-${script.id}`} className="block text-sm font-medium text-gray-300 mb-1">Review Status</label>
                        <Select value={reviewStatus} onValueChange={setReviewStatus}>
                          <SelectTrigger id={`review-status-${script.id}`} className="w-full bg-earthie-dark border-earthie-dark-light text-white">
                            <SelectValue placeholder="Select review status" />
                          </SelectTrigger>
                          <SelectContent className="bg-earthie-dark border-earthie-dark-light text-white">
                            <SelectItem value="good" className="hover:bg-earthie-dark-light focus:bg-earthie-dark-light">Good</SelectItem>
                            <SelectItem value="caution" className="hover:bg-earthie-dark-light focus:bg-earthie-dark-light">Proceed with Caution</SelectItem>
                            <SelectItem value="danger" className="hover:bg-earthie-dark-light focus:bg-earthie-dark-light">Don't Use</SelectItem>
                          </SelectContent>
                        </Select>
                        {/* Badge Preview */}
                        {reviewStatus && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-400 mr-2">Badge Preview:</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              reviewStatus === 'good' ? 'bg-emerald-100 text-emerald-800' :
                              reviewStatus === 'caution' ? 'bg-amber-100 text-amber-800' :
                              reviewStatus === 'danger' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800' // Default or empty
                            }`}>
                              {reviewStatus === 'good' ? 'Approved' : reviewStatus === 'caution' ? 'Caution' : reviewStatus === 'danger' ? 'Danger' : 'Status'}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Input for Review Method */}
                      <div>
                        <label htmlFor={`review-method-${script.id}`} className="block text-sm font-medium text-gray-300 mb-1">Review Method</label>
                        <Input 
                          id={`review-method-${script.id}`} 
                          placeholder="e.g., Manual Code Scan, Security Audit" 
                          value={reviewMethod} 
                          onChange={e => setReviewMethod(e.target.value)} 
                          className="bg-earthie-dark border-earthie-dark-light text-white" 
                        />
                      </div>
                      
                      <div>
                        <label htmlFor={`review-comment-${script.id}`} className="block text-sm font-medium text-gray-300 mb-1">Review Comment</label>
                        <Textarea 
                          id={`review-comment-${script.id}`} 
                          placeholder="Review comment" 
                          rows={3} 
                          value={reviewComment} 
                          onChange={e => setReviewComment(e.target.value)} 
                          className="bg-earthie-dark border-earthie-dark-light text-white" 
                        />
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button onClick={() => setReviewOpenId(null)} variant="outline">Cancel</Button>
                        <Button 
                          disabled={reviewSubmitting || !reviewStatus || !reviewMethod || !reviewComment}
                          onClick={() => handleReviewSubmit(script.id)}
                        >
                          {reviewSubmitting ? "Submitting..." : "Submit Review"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
} 