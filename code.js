// code.js
// Skyline AA-1 Project - Step 5: Intelligent, Context-Aware Code Generation
// Implements Architecture, Logic, Security, DB, Error Handling, Consistency, Integration, and Production Thinking.

const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates code for a SINGLE file with FULL SYSTEM AWARENESS.
 */
async function generateIntelligentCode(filename, skeletonSnippet, fullSkeleton, designJson) {
    
    // Dynamic Token Limits
    let maxTokens = 2500;
    if (filename.match(/(model|schema|config|type)/i)) maxTokens = 1500;

    const systemPrompt = `You are a Principal Software Engineer. You are writing PRODUCTION-READY CODE for '${filename}'.

🚨 8-POINT ENGINEERING STANDARD (DYNAMICALLY APPLIED):

1. ARCHITECTURE: Analyze the FULL SKELETON. Identify if this file is a Controller, Route, Model, or Service. Enforce strict separation of concerns.
2. LOGIC VALIDATION: Cross-reference with DESIGN JSON. Ensure data flows correctly (e.g., User -> Task relationships).
3. SECURITY: Enforce Auth checks on protected routes. Hash passwords. Use Env Vars. No hardcoded secrets.
4. DATABASE: Use correct ORM syntax detected from the skeleton. Enforce Foreign Keys and Relationships.
5. ERROR HANDLING: Wrap DB/External calls in try/catch. Return proper HTTP status codes (400, 401, 404, 500).
6. CONSISTENCY: Mimic the naming conventions and import styles of the FULL SKELETON.
7. INTEGRATION: Ensure imports match other files. Initialize DB/App correctly in main files.
8. PRODUCTION: Add logging, input validation, and CORS where needed.

❌ NO PLACEHOLDERS. ❌ NO TODOs. ❌ NO EXPLANATIONS.

---
**FULL PROJECT SKELETON (For Integration & Architecture):**
${fullSkeleton}

---
**DESIGN CONTEXT (For Logic & Relationships):**
${JSON.stringify(designJson, null, 2)}

---
**SPECIFIC TASK FOR '${filename}':**
${skeletonSnippet}

Write the complete, integrated, and secure code for '${filename}'.`;

    try {
        const completion = await openai.chat.completions.create({            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Generate the production-ready code for ${filename}.` }
            ],
            max_tokens: maxTokens,
            temperature: 0.1,
        });

        let code = completion.choices[0]?.message?.content?.trim();
        
        // Clean up
        code = code.replace(/```[\s\S]*?\n/g, '');
        code = code.replace(/```/g, '');
        
        if (!code || code.length < 20) throw new Error("Empty generation");

        return code;

    } catch (error) {
        throw new Error(`Failed to generate ${filename}: ${error.message}`);
    }
}

/**
 * Orchestrates generation for all files.
 */
async function generateAllCode(fullSkeleton, designJson) {
    if (!fullSkeleton) throw new Error('Missing skeleton');

    // Parse Skeleton
    const fileBlocks = {};
    const lines = fullSkeleton.split('\n');
    let currentFile = null;
    let currentContent = [];

    for (const line of lines) {
        const match = line.match(/^([a-zA-Z0-9_\-./]+\.\w+):/);
        if (match) {
            if (currentFile) fileBlocks[currentFile] = currentContent.join('\n');
            currentFile = match[1];
            currentContent = [];
        } else if (currentFile) {
            currentContent.push(line);
        }
    }
    if (currentFile) fileBlocks[currentFile] = currentContent.join('\n');

    console.log(`🚀 Generating ${Object.keys(fileBlocks).length} files with Full Context...`);
    const generatedFiles = {};

    for (const [filename, snippet] of Object.entries(fileBlocks)) {
        console.log(`⚙️ Writing ${filename}...`);
        try {
            const code = await generateIntelligentCode(filename, snippet, fullSkeleton, designJson);
            generatedFiles[filename] = code;
            console.log(`✅ Done: ${filename}`);
        } catch (error) {
            console.error(`❌ Failed: ${filename}`, error.message);
            throw error; // Stop pipeline on failure
        }
    }

    return generatedFiles;
}

module.exports = { generateAllCode };
