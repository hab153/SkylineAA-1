// Typos.js
// Skyline AA-1 Project - Step 7: Typo, Naming & Consistency Validation
// Analyzes each file individually for typos, undefined variables, and naming inconsistencies.
// Uses a 2-pass system: Pass 1 (Fix, 1000 tokens), Pass 2 (Review, 800 tokens).
// ONLY replaces the specific areas with errors, leaving the rest of the file intact.

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
 * Pass 1: Analyze and Fix Typos/Undefined Variables.
 */
async function fixTyposPass1(code, filename, language) {
    const prompt = `You are a Code Proofreader for ${language}.
Analyze the following code from '${filename}' for TYPOS and UNDEFINED VARIABLES ONLY.

LOOK FOR:
1. Misspelled variable or function names (e.g., 'usernmae' instead of 'username').
2. Calling a function that doesn't exist or is named differently.
3. Inconsistent naming (e.g., using 'camelCase' in one place and 'snake_case' for the same variable).
4. Simple logical typos (e.g., 'retrun' instead of 'return').
RULES:
- DO NOT change logic or architecture.
- DO NOT refactor working code.
- ONLY fix the specific typos or undefined references.
- Return the FULL file content with the fixes applied.

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
        console.error(`❌ Typo Pass 1 failed for ${filename}:`, e.message);
        return code;
    }
}

/**
 * Pass 2: Review the Fixes.
 */
async function reviewTyposPass2(originalCode, fixedCode, filename, language) {
    const prompt = `You are a Code Reviewer for ${language}.
Compare the Original Code and the Fixed Code for '${filename}'.

Original:
${originalCode}

Fixed:
${fixedCode}

TASK:
1. Did the fix correct the typos/undefined variables?
2. Did the fix accidentally break any working logic?
3. If the code is now clean and consistent, return the word "VALID".
4. If there are still typos or new errors, return the corrected code ONLY.

Do not explain. Return only "VALID" or the corrected code.`;

    try {
        const res = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],            max_tokens: 800,
            temperature: 0.1
        });
        const result = res.choices[0]?.message?.content?.trim();
        
        if (result.toUpperCase() === 'VALID') {
            return fixedCode;
        }
        return result; // Return the re-corrected code
    } catch (e) {
        console.error(`❌ Typo Pass 2 failed for ${filename}:`, e.message);
        return fixedCode;
    }
}

/**
 * Main Function: Process all files sequentially.
 */
async function validateAndFixTypos(syntaxCheckedFiles) {
    if (!syntaxCheckedFiles || typeof syntaxCheckedFiles !== 'object') {
        throw new Error('Invalid input for typo validation');
    }

    const finalFiles = {};
    const filenames = Object.keys(syntaxCheckedFiles);

    console.log(`🔍 Starting Typo & Consistency Validation for ${filenames.length} files...`);

    for (const filename of filenames) {
        const originalCode = syntaxCheckedFiles[filename];
        const language = getLanguage(filename);

        console.log(`⚙️ Checking typos for ${filename} (${language})...`);

        // Pass 1: Fix Typos
        let currentCode = await fixTyposPass1(originalCode, filename, language);
        
        // Pass 2: Review Fixes
        currentCode = await reviewTyposPass2(originalCode, currentCode, filename, language);

        finalFiles[filename] = currentCode;
        console.log(`✅ Typo validation complete for ${filename}`);
    }

    console.log(`🎉 Typo Validation Complete.`);
    return finalFiles;
}

module.exports = { validateAndFixTypos };
