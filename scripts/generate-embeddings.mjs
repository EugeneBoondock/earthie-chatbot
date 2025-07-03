import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local file
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
  console.error(
    'Missing environment variables. Make sure your .env.local file contains NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, and GEMINI_API_KEY.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const genAI = new GoogleGenerativeAI(geminiApiKey);
const embeddingModel = genAI.getGenerativeModel({
  model: 'text-embedding-004',
});

// Path to the knowledge files
const KNOWLEDGE_FILES_DIR = path.join(process.cwd(), 'app/knowledge');

// List of knowledge files
const KNOWLEDGE_FILE_NAMES = [
  "Earth2_final.txt",
  "earth2_all_articles.txt",
  "Jewels.txt",
  "megacityList.txt",
  "Earth_2_Official_Whitepaper_Release.txt",
  "Resource_jewel_droid.txt",
  "Civilians.txt",
];

// Function to split text into chunks
function splitIntoChunks(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.substring(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

async function main() {
  console.log('Starting embedding generation process...');

  const textChunks = [];
  const sourceFileMapping = [];

  // 1. Read and chunk all documents
  for (const fileName of KNOWLEDGE_FILE_NAMES) {
    const fullPath = path.join(KNOWLEDGE_FILES_DIR, fileName);
    try {
      console.log(`Reading and chunking ${fileName}...`);
      const content = await fs.readFile(fullPath, 'utf-8');
      const chunks = splitIntoChunks(content);
      chunks.forEach(chunk => {
        textChunks.push(chunk);
        sourceFileMapping.push(fileName);
      });
      console.log(`- Found ${chunks.length} chunks.`);
    } catch (error) {
      console.error(`Error reading file ${fileName}. Skipping.`, error);
    }
  }

  if (textChunks.length === 0) {
    console.log('No text chunks to process. Exiting.');
    return;
  }
  
  console.log(`Total chunks to process: ${textChunks.length}`);

  // 2. Generate embeddings for all chunks
  console.log('Generating embeddings for all text chunks...');
  
  const batchSize = 100; // Google's API limit
  const allEmbeddings = [];

  for (let i = 0; i < textChunks.length; i += batchSize) {
    const batchOfTexts = textChunks.slice(i, i + batchSize);
    console.log(`- Processing batch from index ${i}...`);

    const requests = batchOfTexts.map(text => ({
      content: { parts: [{ text }] },
    }));

    try {
      const result = await embeddingModel.batchEmbedContents({ requests });
      const batchEmbeddings = result.embeddings.map(e => e.values);
      allEmbeddings.push(...batchEmbeddings);
    } catch (error) {
      console.error(`Error embedding batch starting at index ${i}:`, error);
      console.error('Halting script due to API error.');
      return; 
    }
  }

  console.log(`Generated ${allEmbeddings.length} embeddings.`);

  // 3. Prepare data for Supabase
  const dataToInsert = allEmbeddings.map((embedding, index) => ({
    source_file: sourceFileMapping[index],
    content: textChunks[index],
    embedding: embedding,
  }));

  // 4. Insert data into Supabase
  console.log('Deleting old knowledge data from Supabase...');
  const { error: deleteError } = await supabase.from('knowledge').delete().neq('id', -1); // Delete all rows
  if (deleteError) {
    console.error('Error deleting old data:', deleteError);
    return;
  }

  console.log('Inserting new knowledge data into Supabase...');
  const { error: insertError } = await supabase.from('knowledge').insert(dataToInsert);
  if (insertError) {
    console.error('Error inserting data:', insertError);
  } else {
    console.log('Successfully inserted all knowledge data into Supabase!');
  }
}

main().catch(console.error); 