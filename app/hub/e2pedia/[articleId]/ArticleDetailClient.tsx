'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Calendar, Languages, BookText, Loader2, AlertCircle, ChevronsUpDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types';

// Assuming Article type might be defined elsewhere or passed more completely
interface Article {
  wp_post_id: number;
  title: string;
  content_html: string | null;
  content_text: string | null; // Need text version for APIs
  url: string | null;
  published_at: string | null;
}

interface ArticleDetailClientProps {
  article: Article;
}

// Helper to format date strings (same as before)
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
};

// Base list of languages
const predefinedLanguages = [
  // { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'id', name: 'Indonesian' },
  { code: 'tr', name: 'Turkish' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'pl', name: 'Polish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'sv', name: 'Swedish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'da', name: 'Danish' },
  { code: 'el', name: 'Greek' },
  { code: 'he', name: 'Hebrew' },
  { code: 'th', name: 'Thai' },
  // ... Add more common ones if desired
].sort((a, b) => a.name.localeCompare(b.name));

export default function ArticleDetailClient({ article }: ArticleDetailClientProps) {
  const supabase = createClientComponentClient<Database>();

  const [isLoadingTranslate, setIsLoadingTranslate] = useState(false);
  const [isLoadingSummarize, setIsLoadingSummarize] = useState(false);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(true);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [summarizedContent, setSummarizedContent] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState<string | null>(article.content_html);
  const [currentMode, setCurrentMode] = useState<'original' | 'translated' | 'summarized'>('original');
  const [error, setError] = useState<string | null>(null);
  
  // State for Combobox & Languages
  const [openCombobox, setOpenCombobox] = useState(false);
  const [availableLanguages, setAvailableLanguages] = useState(predefinedLanguages);
  const [selectedLanguageName, setSelectedLanguageName] = useState<string>("");
  const [comboboxInputValue, setComboboxInputValue] = useState<string>("");
  const [lastTranslatedLangName, setLastTranslatedLangName] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomLanguages = async () => {
      setIsLoadingLanguages(true);
      const { data: customLangs, error: dbError } = await supabase
        .from('custom_languages')
        .select('language_name');

      if (dbError) {
        console.error("Error fetching custom languages:", dbError);
        setAvailableLanguages(predefinedLanguages);
        if(predefinedLanguages.length > 0 && !selectedLanguageName && !comboboxInputValue) {
            const defaultLang = predefinedLanguages[0].name;
            setSelectedLanguageName(defaultLang); 
            setComboboxInputValue(defaultLang);
        }
      } else if (customLangs) {
        const customLangNames = customLangs.map(l => ({ 
            name: l.language_name, 
            code: l.language_name.toLowerCase().replace(/\s+/g, '-') 
        }));
        
        const combined = [...predefinedLanguages];
        const predefinedLower = new Set(predefinedLanguages.map(l => l.name.toLowerCase()));
        customLangNames.forEach(customLang => {
            if (!predefinedLower.has(customLang.name.toLowerCase())) {
                combined.push(customLang);
            }
        });

        setAvailableLanguages(combined.sort((a, b) => a.name.localeCompare(b.name)));
        if(combined.length > 0 && !selectedLanguageName && !comboboxInputValue) {
            const defaultLang = combined[0].name;
            setSelectedLanguageName(defaultLang);
            setComboboxInputValue(defaultLang);
        }
      }
      setIsLoadingLanguages(false);
    };

    fetchCustomLanguages();
  }, [supabase]);

  const getTargetLanguage = useCallback(() => {
    return comboboxInputValue?.trim() || "";
  }, [comboboxInputValue]);

  const handleTranslate = async () => {
    if (!article.content_text) {
      setError('Cannot translate empty content.');
      return;
    }
    
    const targetLanguage = getTargetLanguage();

    if (!targetLanguage) {
        setError('Please select or enter a target language.');
        return;
    }

    if (currentMode === 'translated' && lastTranslatedLangName === targetLanguage) {
        console.log(`Already displaying translation for ${targetLanguage}`);
        return;
    }

    setIsLoadingTranslate(true);
    setError(null);
    setTranslatedContent(null);

    try {
      const response = await fetch('/api/translate', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: article.content_text,
          targetLanguage: targetLanguage,
          articleId: article.wp_post_id
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Translation failed');
      }

      const data = await response.json();
      setTranslatedContent(data.translatedText);
      setCurrentContent(data.translatedText);
      setCurrentMode('translated');
      setLastTranslatedLangName(targetLanguage);
      
      const langExists = availableLanguages.some(l => l.name.toLowerCase() === targetLanguage.toLowerCase());
      if (!langExists) {
          console.log('New language translated, adding optimistically:', targetLanguage);
          setAvailableLanguages(prev => 
              [...prev, { name: targetLanguage, code: targetLanguage.toLowerCase().replace(/\s+/g, '-') }]
              .sort((a,b)=> a.name.localeCompare(b.name))
          );
      }

    } catch (err: any) {
      console.error("Translation error:", err);
      setError(`Translation to ${targetLanguage} failed: ${err.message}`);
      setCurrentMode('original');
      setCurrentContent(article.content_html);
      setLastTranslatedLangName(null);
    } finally {
      setIsLoadingTranslate(false);
    }
  };

  const handleSummarize = async () => {
    let textToSummarize: string | null = null;
    let languageOfText: string = 'English'; // Default to English

    // Determine which text content and language to use
    if (currentMode === 'original') {
      textToSummarize = article.content_text;
      languageOfText = 'English';
    } else if (currentMode === 'translated' && translatedContent) {
      textToSummarize = translatedContent;
      languageOfText = lastTranslatedLangName || 'Unknown'; // Use the language name of the current translation
    } else if (currentMode === 'summarized') {
       // Already summarized, do nothing or maybe show original?
       console.log('Already viewing summary.');
       return; 
    }

    if (!textToSummarize) {
      setError('Cannot summarize empty or unavailable content.');
      return;
    }
    
    setIsLoadingSummarize(true);
    setError(null);
    setSummarizedContent(null); // Clear previous summary
    
    console.log(`[handleSummarize] Requesting summary for language: ${languageOfText}`);

    try {
      const response = await fetch('/api/summarize', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the text, its language, and the article ID
        body: JSON.stringify({
            text: textToSummarize,
            language: languageOfText,
            articleId: article.wp_post_id
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Summarization failed');
      }

      const data = await response.json();
      setSummarizedContent(data.summary);
      setCurrentContent(data.summary); // Display summary
      setCurrentMode('summarized');
    } catch (err: any) {
      console.error("Summarization error:", err);
      setError(`Summarization failed: ${err.message}`);
      // Optionally revert view if summarization fails
      // if (currentMode === 'translated') {
      //    setCurrentContent(translatedContent);
      // } else {
      //    setCurrentContent(article.content_html);
      //    setCurrentMode('original');
      // }
    } finally {
      setIsLoadingSummarize(false);
    }
  };

  const showOriginal = () => {
    setCurrentContent(article.content_html);
    setCurrentMode('original');
    setLastTranslatedLangName(null);
    setError(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="prose prose-invert lg:prose-xl prose-img:rounded-lg prose-a:text-indigo-400 hover:prose-a:text-indigo-300 prose-headings:text-gray-100 prose-p:text-gray-300 prose-strong:text-gray-100">
        <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-gray-100 md:text-4xl lg:text-5xl">
          {article.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-400 mb-6 not-prose">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-1.5" />
            <span>Published: {formatDate(article.published_at)}</span>
          </div>
          {article.url && (
            <a 
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <span>View Original</span>
              <ExternalLink className="h-4 w-4 ml-1" />
            </a>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3 mb-8 not-prose">
          {currentMode !== 'original' && (
            <Button variant="outline" size="sm" onClick={showOriginal}>
              Show Original
            </Button>
          )}
          
          <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openCombobox}
                className="w-[200px] justify-between bg-gray-700/50 border-gray-600 hover:bg-gray-600/50 focus:ring-indigo-500 text-white h-9 text-sm"
                disabled={isLoadingLanguages}
              >
                {isLoadingLanguages ? "Loading..." : (comboboxInputValue || "Select language...") }
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0 bg-gray-800 border-gray-700 text-white">
              <Command shouldFilter={false}>
                <CommandInput 
                    placeholder="Search or type language..." 
                    value={comboboxInputValue}
                    onValueChange={(value) => {
                        setComboboxInputValue(value);
                        setSelectedLanguageName("");
                    }}
                 />
                <CommandList>
                  <CommandEmpty>
                    No language found. <br />
                    <span className="text-xs text-gray-400">(You can still try translating)</span>
                  </CommandEmpty>
                  <CommandGroup>
                    {availableLanguages
                      .filter(lang => lang.name.toLowerCase().includes(comboboxInputValue.toLowerCase()))
                      .map((lang) => (
                      <CommandItem
                        key={lang.code}
                        value={lang.name}
                        onSelect={(currentValue) => {
                           setSelectedLanguageName(currentValue);
                           setComboboxInputValue(currentValue);
                           setOpenCombobox(false);
                        }}
                        className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            comboboxInputValue?.toLowerCase() === lang.name.toLowerCase() ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {lang.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                 </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleTranslate} 
            disabled={isLoadingTranslate || isLoadingLanguages || !getTargetLanguage() || (currentMode === 'translated' && lastTranslatedLangName === getTargetLanguage())}
            className="h-9"
          >
            {isLoadingTranslate ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Languages className="h-4 w-4 mr-2" />}
            Translate
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleSummarize} disabled={isLoadingSummarize || currentMode === 'summarized'} className="h-9">
            {isLoadingSummarize ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <BookText className="h-4 w-4 mr-2" />}
            Summarize
          </Button>
        </div>

        {error && (
           <div className="my-4 bg-red-900/20 border border-red-500/30 rounded-lg p-3 flex items-center text-sm text-red-300 not-prose">
              <AlertCircle className="h-5 w-5 mr-2 text-red-400" />
              <p>{error}</p>
            </div>
        )}

        <div className="mt-6">
          {currentMode === 'original' && article.content_html && (
            <div dangerouslySetInnerHTML={{ __html: article.content_html }} />
          )}
          {currentMode === 'translated' && translatedContent && (
            <p className="whitespace-pre-wrap text-gray-300">{translatedContent}</p>
          )}
          {currentMode === 'summarized' && summarizedContent && (
            <p className="whitespace-pre-wrap text-gray-300">{summarizedContent}</p>
          )}
          {!currentContent && currentMode === 'original' && (
             <p>Article content not available.</p>
          )}
          {(isLoadingTranslate || isLoadingSummarize) && !error && (
            <div className="flex justify-center items-center mt-8">
                <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-gray-700">
         <p className="text-center text-gray-500 text-sm">End of article content.</p>
      </div>
    </div>
  );
} 