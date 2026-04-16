// semicolons.js
// Skyline AA-1 Project - Step 8: Semicolon & Statement Terminator Validation
// Analyzes each file individually for missing semicolons or statement terminators.
// Uses a 2-pass system: Pass 1 (Fix, 1000 tokens), Pass 2 (Review, 800 tokens).
// ONLY adds/fixes semicolons where needed, leaving the rest of the file intact.

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
        'cs': 'C#',
        'php': 'PHP'
    };
    return map[ext] || 'Unknown';
}

/**
 * Pass 1: Analyze and Fix Missing Semicolons.
 */
async function fixSemicolonsPass1(code, filename, language) {
    // Skip languages that don't use semicolons strictly (like Python)
    if (['Python', 'Ruby'].includes(language)) {
        return code;
    }

    const prompt = `You are a Code Formatter for ${language}.
Analyze the following code from '${filename}' for MISSING SEMICOLONS or STATEMENT TERMINATORS.

RULES:
1. Add semicolons to the end of statements where required by ${language} syntax.
2. Do NOT change any logic, variable names, or structure.
3. Do NOT add semicolons after blocks (like if/for/while) if the language doesn't require it.4. Return the FULL file content with the fixes applied.

CODE:
${code}

Return ONLY the corrected code. No explanations.`;

    try {
        const res = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1000,
            temperature: 0.1
        });
        return res.choices[0]?.message?.content?.trim() || code;
    } catch (e) {
        console.error(`❌ Semicolon Pass 1 failed for ${filename}:`, e.message);
        return code;
    }
}

/**
 * Pass 2: Review the Fixes.
 */
async function reviewSemicolonsPass2(originalCode, fixedCode, filename, language) {
    // Skip languages that don't use semicolons strictly
    if (['Python', 'Ruby'].includes(language)) {
        return fixedCode;
    }

    const prompt = `You are a Code Reviewer for ${language}.
Compare the Original Code and the Fixed Code for '${filename}'.

Original:
${originalCode}

Fixed:
${fixedCode}

TASK:
1. Did the fix correctly add missing semicolons?
2. Did it add any unnecessary semicolons?
3. If the code is now correct regarding semicolons, return the word "VALID".
4. If there are still missing or incorrect semicolons, return the corrected code ONLY.

Do not explain. Return only "VALID" or the corrected code.`;

    try {
        const res = await openai.chat.completions.create({
            model: 'gpt-4o',            messages: [{ role: 'user', content: prompt }],
            max_tokens: 800,
            temperature: 0.1
        });
        const result = res.choices[0]?.message?.content?.trim();
        
        if (result.toUpperCase() === 'VALID') {
            return fixedCode;
        }
        return result; // Return the re-corrected code
    } catch (e) {
        console.error(`❌ Semicolon Pass 2 failed for ${filename}:`, e.message);
        return fixedCode;
    }
}

/**
 * Main Function: Process all files sequentially.
 */
async function validateAndFixSemicolons(typoCheckedFiles) {
    if (!typoCheckedFiles || typeof typoCheckedFiles !== 'object') {
        throw new Error('Invalid input for semicolon validation');
    }

    const finalFiles = {};
    const filenames = Object.keys(typoCheckedFiles);

    console.log(`🔍 Starting Semicolon Validation for ${filenames.length} files...`);

    for (const filename of filenames) {
        const originalCode = typoCheckedFiles[filename];
        const language = getLanguage(filename);

        console.log(`⚙️ Checking semicolons for ${filename} (${language})...`);

        // Pass 1: Fix Semicolons
        let currentCode = await fixSemicolonsPass1(originalCode, filename, language);
        
        // Pass 2: Review Fixes
        currentCode = await reviewSemicolonsPass2(originalCode, currentCode, filename, language);

        finalFiles[filename] = currentCode;
        console.log(`✅ Semicolon validation complete for ${filename}`);
    }

    console.log(`🎉 Semicolon Validation Complete.`);
    return finalFiles;
}

module.exports = { validateAndFixSemicolons };
