// logic.js
// Skyline AA-1 Project - Step 9: Logical Error Validation
// Analyzes each file individually for logical flaws, undefined variables, and broken flows.
// Uses a 2-pass system: Pass 1 (Fix, 1000 tokens), Pass 2 (Review, 800 tokens).
// ONLY fixes the specific logical areas, leaving the rest of the file intact.

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
 * Pass 1: Analyze and Fix Logical Errors.
 */
async function fixLogicPass1(code, filename, language) {
    const prompt = `You are a Senior Software Engineer specializing in ${language}.
Analyze the following code from '${filename}' for LOGICAL ERRORS.

LOOK FOR:
1. Using variables before they are defined.
2. Calling functions that don't exist or have wrong parameters.
3. Infinite loops or unreachable code.
4. Incorrect conditional logic (e.g., if/else that never triggers).
5. Missing return statements in functions that should return values.
6. Type mismatches (e.g., adding string to number incorrectly).

RULES:- DO NOT change the overall architecture or feature set.
- DO NOT refactor working code.
- ONLY fix the specific logical errors found.
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
        console.error(`❌ Logic Pass 1 failed for ${filename}:`, e.message);
        return code;
    }
}

/**
 * Pass 2: Review the Fixes.
 */
async function reviewLogicPass2(originalCode, fixedCode, filename, language) {
    const prompt = `You are a Code Reviewer for ${language}.
Compare the Original Code and the Fixed Code for '${filename}'.

Original:
${originalCode}

Fixed:
${fixedCode}

TASK:
1. Did the fix correct the logical errors?
2. Did the fix introduce any NEW logical errors or break existing functionality?
3. If the code is now logically sound, return the word "VALID".
4. If there are still logical errors, return the corrected code ONLY.

Do not explain. Return only "VALID" or the corrected code.`;

    try {
        const res = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 800,            temperature: 0.1
        });
        const result = res.choices[0]?.message?.content?.trim();
        
        if (result.toUpperCase() === 'VALID') {
            return fixedCode;
        }
        return result; // Return the re-corrected code
    } catch (e) {
        console.error(`❌ Logic Pass 2 failed for ${filename}:`, e.message);
        return fixedCode;
    }
}

/**
 * Main Function: Process all files sequentially.
 */
async function validateAndFixLogic(semicolonCheckedFiles) {
    if (!semicolonCheckedFiles || typeof semicolonCheckedFiles !== 'object') {
        throw new Error('Invalid input for logic validation');
    }

    const finalFiles = {};
    const filenames = Object.keys(semicolonCheckedFiles);

    console.log(`🧠 Starting Logical Validation for ${filenames.length} files...`);

    for (const filename of filenames) {
        const originalCode = semicolonCheckedFiles[filename];
        const language = getLanguage(filename);

        console.log(`⚙️ Checking logic for ${filename} (${language})...`);

        // Pass 1: Fix Logic
        let currentCode = await fixLogicPass1(originalCode, filename, language);
        
        // Pass 2: Review Fixes
        currentCode = await reviewLogicPass2(originalCode, currentCode, filename, language);

        finalFiles[filename] = currentCode;
        console.log(`✅ Logic validation complete for ${filename}`);
    }

    console.log(`🎉 Logical Validation Complete.`);
    return finalFiles;
}

module.exports = { validateAndFixLogic };
