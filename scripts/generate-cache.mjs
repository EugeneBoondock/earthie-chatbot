// Use .mjs extension for native ES Module support in Node.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { parse } from 'node-html-parser';
import { parse as csvParse } from 'csv-parse/sync';
import dotenv from 'dotenv';

// Load .env.local variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// --- Configuration ---
const KNOWLEDGE_DIR = path.join(process.cwd(), 'app', 'knowledge');
const CACHE_FILE_PATH = path.join(process.cwd(), 'knowledge_cache.json');
const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.json', '.docx', '.html', '.csv'];
const CHUNK_SIZE = 8000;
const CHUNK_OVERLAP = 500;

// --- Gemini Initialization ---
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("Error: GEMINI_API_KEY not found in .env.local");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// --- Helper Functions (Copied from gemini.ts) ---

async function readKnowledgeFile(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    let content = '';
    try {
        const buffer = await fs.promises.readFile(filePath);
        switch (extension) {
            case '.txt': case '.md': case '.json': content = buffer.toString('utf-8'); break;
            case '.docx': const docxResult = await mammoth.extractRawText({ buffer }); content = docxResult.value; break;
            case '.html': const htmlRoot = parse(buffer.toString('utf-8')); content = htmlRoot.textContent || ''; break;
            case '.csv': const records = csvParse(buffer, { columns: false, skip_empty_lines: true }); content = records.map(row => row.join(', ')).join('\n'); break;
            default: console.warn(`Unsupported file type skipped: ${extension}`); return '';
        }
        return content.replace(/\s\s+/g, ' ').trim();
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return '';
    }
}

async function getKnowledgeFiles() {
    try {
        const files = await fs.promises.readdir(KNOWLEDGE_DIR);
        return files.filter(file => SUPPORTED_EXTENSIONS.includes(path.extname(file).toLowerCase()));
    } catch (error) {
        console.error("Error reading knowledge directory:", error);
        return [];
    }
}

function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    const chunks = []; let index = 0;
    while (index < text.length) {
        const end = Math.min(index + chunkSize, text.length);
        chunks.push(text.substring(index, end));
        if (end === text.length) break;
        index += chunkSize - overlap;
        index = Math.max(index, end - overlap);
    }
    return chunks;
}

async function embedContent(text) {
    try {
        // Add a small delay to avoid hitting rate limits too quickly
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        const result = await embeddingModel.embedContent(text);
        return result.embedding.values;
    } catch (error) {
        console.error(`Error generating embedding for text chunk (length ${text.length}):`, error);
        // Check for specific rate limit error if possible (depends on API response structure)
        if (error.message && error.message.includes('RESOURCE_EXHAUSTED')) {
            console.warn("Rate limit likely hit. Waiting longer...");
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
             // Retry embedding after waiting
            try {
                const result = await embeddingModel.embedContent(text);
                return result.embedding.values;
            } catch (retryError) {
                 console.error("Retry embedding failed:", retryError);
                 return [];
            }
        }
        return []; // Return empty array on other errors
    }
}

function saveCacheChunksToFile(chunks) {
    try {
        console.log(`Saving ${chunks.length} knowledge chunks to ${CACHE_FILE_PATH}...`);
        const fileContent = JSON.stringify(chunks);
        fs.writeFileSync(CACHE_FILE_PATH, fileContent, 'utf-8');
        console.log("Knowledge chunks JSON saved successfully.");
    } catch (error) {
        console.error("Error saving knowledge chunks JSON:", error);
    }
}

// --- Main Processing Logic ---

async function generateCache() {
    console.log("Starting knowledge cache generation...");
    const knowledgeFiles = await getKnowledgeFiles();

    if (knowledgeFiles.length === 0) {
        console.warn("No knowledge files found in", KNOWLEDGE_DIR);
        saveCacheChunksToFile([]);
        return;
    }

    console.log(`Found ${knowledgeFiles.length} knowledge files to process.`);
    const allChunks = [];
    let processedFileCount = 0;

    for (const fileName of knowledgeFiles) {
        processedFileCount++;
        console.log(`[${processedFileCount}/${knowledgeFiles.length}] Processing file: ${fileName}...`);
        const filePath = path.join(KNOWLEDGE_DIR, fileName);
        const fileContent = await readKnowledgeFile(filePath);
        if (!fileContent) {
            console.warn(`  Skipping ${fileName} due to empty content.`);
            continue;
        }

        const textChunks = chunkText(fileContent);
        console.log(`  Split ${fileName} into ${textChunks.length} chunks.`);

        for (let i = 0; i < textChunks.length; i++) {
            const chunkContent = textChunks[i];
            process.stdout.write(`    Embedding chunk ${i + 1}/${textChunks.length}... `);
            const embedding = await embedContent(chunkContent);
            if (embedding.length > 0) {
                allChunks.push({ fileName, chunkIndex: i, content: chunkContent, embedding });
                process.stdout.write(`Done\n`);
            } else {
                process.stdout.write(`Failed\n`);
                console.warn(`      Failed to embed chunk ${i} from ${fileName}. Skipping chunk.`);
            }
        }
    }

    console.log(`\nGenerated a total of ${allChunks.length} chunks with embeddings.`);
    saveCacheChunksToFile(allChunks);
    console.log("Knowledge cache generation complete.");
}

// --- Run the generation --- 
generateCache(); 