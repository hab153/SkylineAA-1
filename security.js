// security.js
// Skyline AA-1 Project - Step 10: Security Flaw Validation
// Analyzes each file individually for security vulnerabilities (SQLi, XSS, Hardcoded Secrets, etc.).
// Uses a 2-pass system: Pass 1 (Fix, 1000 tokens), Pass 2 (Review, 800 tokens).
// ONLY fixes the specific security areas, leaving the rest of the file intact.

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
 * Pass 1: Analyze and Fix Security Flaws.
 */
async function fixSecurityPass1(code, filename, language) {
    const prompt = `You are a Senior Security Engineer specializing in ${language}.
Analyze the following code from '${filename}' for SECURITY VULNERABILITIES.

LOOK FOR:
1. Hardcoded secrets, API keys, or passwords.
2. SQL Injection risks (string concatenation in queries).
3. XSS risks (unsanitized output in HTML/JS).
4. Insecure direct object references (IDOR).
5. Missing input validation on sensitive data.
6. Weak cryptographic practices (e.g., MD5, weak JWT secrets).
7. Exposure of sensitive error messages.
RULES:
- DO NOT change the overall architecture or feature set.
- DO NOT refactor working code unless it is a security risk.
- Replace hardcoded secrets with environment variable placeholders (e.g., process.env.SECRET).
- Sanitize inputs and outputs where necessary.
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
        console.error(`❌ Security Pass 1 failed for ${filename}:`, e.message);
        return code;
    }
}

/**
 * Pass 2: Review the Fixes.
 */
async function reviewSecurityPass2(originalCode, fixedCode, filename, language) {
    const prompt = `You are a Security Code Reviewer for ${language}.
Compare the Original Code and the Fixed Code for '${filename}'.

Original:
${originalCode}

Fixed:
${fixedCode}

TASK:
1. Did the fix resolve the security vulnerabilities?
2. Did the fix introduce any new security risks or break functionality?
3. If the code is now secure, return the word "VALID".
4. If there are still security flaws, return the corrected code ONLY.

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
        console.error(`❌ Security Pass 2 failed for ${filename}:`, e.message);
        return fixedCode;
    }
}

/**
 * Main Function: Process all files sequentially.
 */
async function validateAndFixSecurity(logicCheckedFiles) {
    if (!logicCheckedFiles || typeof logicCheckedFiles !== 'object') {
        throw new Error('Invalid input for security validation');
    }

    const finalFiles = {};
    const filenames = Object.keys(logicCheckedFiles);

    console.log(`🔒 Starting Security Validation for ${filenames.length} files...`);

    for (const filename of filenames) {
        const originalCode = logicCheckedFiles[filename];
        const language = getLanguage(filename);

        console.log(`⚙️ Checking security for ${filename} (${language})...`);

        // Pass 1: Fix Security
        let currentCode = await fixSecurityPass1(originalCode, filename, language);
        
        // Pass 2: Review Fixes
        currentCode = await reviewSecurityPass2(originalCode, currentCode, filename, language);

        finalFiles[filename] = currentCode;
        console.log(`✅ Security validation complete for ${filename}`);
    }

    console.log(`🎉 Security Validation Complete.`);
    return finalFiles;
}

module.exports = { validateAndFixSecurity };
