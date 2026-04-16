// syntax.js
// Skyline AA-1 Project - Step 6: Syntax Validation & Repair
// Analyzes each file individually, fixes syntax errors, and reviews the fix.
// Uses a 2-pass system: Pass 1 (Fix, 1000 tokens), Pass 2 (Review, 800 tokens).

const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Detects the language based on file extension.
 */
function getLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
        'py': 'Python',
        'js': 'JavaScript',
        'ts': 'TypeScript',
        'jsx': 'React JSX',
        'tsx': 'React TSX',
        'go': 'Go',
        'rb': 'Ruby',
        'java': 'Java',
        'cpp': 'C++',
        'c': 'C',
        'html': 'HTML',
        'css': 'CSS',
        'json': 'JSON',
        'yaml': 'YAML',
        'yml': 'YAML'
    };
    return map[ext] || 'Unknown';
}

/**
 * Pass 1: Analyze and Fix Syntax Errors.
 */
async function fixSyntaxPass1(code, filename, language) {
    const prompt = `You are a Syntax Expert for ${language}.
Analyze the following code from '${filename}' for SYNTAX ERRORS ONLY.
Examples: Missing brackets, unclosed strings, indentation errors, missing semicolons, invalid variable names.

DO NOT change logic. DO NOT refactor. ONLY fix syntax.

CODE:
${code}

Return ONLY the fixed code. No explanations.`;
    try {
        const res = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1000,
            temperature: 0.1
        });
        return res.choices[0]?.message?.content?.trim() || code;
    } catch (e) {
        console.error(`❌ Pass 1 failed for ${filename}:`, e.message);
        return code;
    }
}

/**
 * Pass 2: Review the Fix.
 */
async function reviewSyntaxPass2(originalCode, fixedCode, filename, language) {
    const prompt = `You are a Code Reviewer for ${language}.
Compare the Original Code and the Fixed Code for '${filename}'.

Original:
${originalCode}

Fixed:
${fixedCode}

TASK:
1. Did the fix introduce any NEW syntax errors?
2. Is the code now syntactically valid?
3. If valid, return the word "VALID".
4. If invalid, return the corrected code ONLY.

Do not explain. Return only "VALID" or the corrected code.`;

    try {
        const res = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 800,
            temperature: 0.1
        });
        const result = res.choices[0]?.message?.content?.trim();
        
        if (result.toUpperCase() === 'VALID') {
            return fixedCode;
        }
        return result; // Return the re-corrected code
    } catch (e) {        console.error(`❌ Pass 2 failed for ${filename}:`, e.message);
        return fixedCode;
    }
}

/**
 * Main Function: Process all files sequentially.
 */
async function validateAndFixSyntax(generatedFiles) {
    if (!generatedFiles || typeof generatedFiles !== 'object') {
        throw new Error('Invalid input for syntax validation');
    }

    const fixedFiles = {};
    const filenames = Object.keys(generatedFiles);

    console.log(`🔍 Starting Syntax Validation for ${filenames.length} files...`);

    for (const filename of filenames) {
        const originalCode = generatedFiles[filename];
        const language = getLanguage(filename);

        console.log(`⚙️ Checking syntax for ${filename} (${language})...`);

        // Pass 1: Fix
        let currentCode = await fixSyntaxPass1(originalCode, filename, language);
        
        // Pass 2: Review
        currentCode = await reviewSyntaxPass2(originalCode, currentCode, filename, language);

        fixedFiles[filename] = currentCode;
        console.log(`✅ Syntax validated for ${filename}`);
    }

    console.log(`🎉 Syntax Validation Complete.`);
    return fixedFiles;
}

module.exports = { validateAndFixSyntax };
