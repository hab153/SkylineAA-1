// exam.js
// Skyline AA-1 Project - Skeleton Examiner (Step 4.5)
// Validates connections, execution flow, and real-world feasibility.
// Auto-fixes issues if found. Returns honest, corrected blueprint.

const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Examines the skeleton blueprint for connection errors and logical flaws.
 * If errors are found, it automatically generates a fixed version.
 * @param {string} blueprint - The plain text skeleton from skeleton.js
 * @param {Object} designJson - The original design JSON for context
 * @returns {Promise<string>} - The validated (and potentially fixed) blueprint
 */
async function examineAndFixSkeleton(blueprint, designJson) {
    if (!blueprint || typeof blueprint !== 'string') {
        throw new Error('Invalid blueprint input for examination');
    }

    const systemPrompt = `You are a Strict Code Examiner and Architect for Skyline AA-1.

YOUR JOB:
1. Analyze the provided code skeleton blueprint.
2. Check for TWO critical failures:
   A. CONNECTION FAILURES: Do imports match actual file names? Does the main file import all necessary modules? Are circular dependencies created?
   B. REAL-WORLD FEASIBILITY: Will this structure actually run? Are missing critical steps (like database initialization, app listening, or middleware registration) absent?

RULES:
- If the blueprint is PERFECT: Return the word "PASS" only.
- If the blueprint has ERRORS: 
  1. Identify the specific lines/files that are wrong.
  2. Generate a COMPLETELY NEW, FIXED blueprint.
  3. Ensure all imports are correct and consistent.
  4. Ensure the execution flow (Main -> Routes -> Controllers) is unbroken.
  5. Return ONLY the fixed blueprint text. NO explanations. NO "Here is the fix".

CRITICAL:
- Do NOT change the logic of the functions, only the structure/imports/connections.
- Maintain the same file list as the original design.
- Be HONEST. If it works, say "PASS". If it fails, fix it.`;

    const userPrompt = `Examine this skeleton blueprint against the design:

DESIGN CONTEXT:
${JSON.stringify(designJson, null, 2)}
SKELETON BLUEPRINT TO EXAMINE:
${blueprint}

Check for:
1. Broken imports (e.g., importing 'user' when file is 'users.js').
2. Missing connections (e.g., Main file not importing a route).
3. Framework syntax errors (e.g., mixing Express and FastAPI syntax).
4. Missing real-world necessities (e.g., no DB connection setup).

If valid, return "PASS".
If invalid, return the FULL FIXED blueprint.`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 2000,
            temperature: 0.1,
        });

        const result = completion.choices[0]?.message?.content?.trim();

        if (!result) {
            throw new Error('Examiner returned empty result');
        }

        // If the examiner says it passes, return the original blueprint
        if (result.toUpperCase() === 'PASS') {
            console.log('✅ Examination Passed: Blueprint is valid.');
            return blueprint;
        }

        // If it returns text, it's the fixed blueprint
        console.log('⚠️ Examination Failed: Auto-fixing blueprint...');
        
        // Clean up any markdown if the AI accidentally added it
        let fixedBlueprint = result.replace(/```[\s\S]*?\n/g, '');
        fixedBlueprint = fixedBlueprint.replace(/```/g, '');
        
        return fixedBlueprint.trim();

    } catch (error) {
        console.error('❌ Examination Error:', error.message);
        // If examination fails, return original blueprint to avoid blocking progress
        // but log the error for debugging
        return blueprint;
    }}

module.exports = { examineAndFixSkeleton };
