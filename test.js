// test.js
// Skyline AA-1 Project - Design Validator & Enhancer (Step 3.5)
// Validates the system design output and enhances unclear/incomplete information

const OpenAI = require('openai');

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Validates and enhances a system design by fixing unclear or incomplete information
 * @param {Object} systemDesign - The system design JSON object
 * @param {string} originalSteps - The original plain text steps for context
 * @returns {Promise<Object>} - Enhanced system design with clear information
 * @throws {Error} - If AI call fails or output is invalid
 */
async function validateAndEnhanceDesign(systemDesign, originalSteps) {
    // Validate input
    if (!systemDesign || typeof systemDesign !== 'object') {
        throw new Error('Invalid input: systemDesign must be a non-empty object');
    }

    if (Object.keys(systemDesign).length === 0) {
        throw new Error('Invalid input: systemDesign has no modules');
    }

    if (!originalSteps || typeof originalSteps !== 'string') {
        throw new Error('Invalid input: originalSteps must be a non-empty string');
    }

    const systemPrompt = `You are a Senior Design Quality Assurance Specialist and Detective.

Your task: THOROUGHLY validate and enhance the system design. Detect ANY unclear, incomplete, or problematic areas and fix them.

CRITICAL RULES:
- Keep ALL existing content that is already clear and correct
- DO NOT remove or replace working content - ONLY ADD or ENHANCE
- Be a DETECTIVE - find hidden issues others might miss
- Ensure the design is 100% ready for code generation

DETECTIVE CHECKLIST (check EVERY module for these issues):

1. PURPOSE VALIDATION (most important):
   ✓ Does it explain WHAT the module does?
   ✓ Does it explain WHY this module exists?
   ✓ Does it mention DEPENDENCIES (what other modules it needs)?
   ✓ Does it mention WHAT IT PROVIDES to other modules?
   ✓ Is it specific enough (no generic phrases like "handles data", "does stuff")?
   ✓ Minimum 60 characters - if shorter, ENHANCE it

2. FILE VALIDATION:
   ✓ Are file paths realistic and specific?
   ✓ Do extensions match the technology (.js, .py, .jsx, .css, .html, .json)?
   ✓ Are files organized in logical folders (src/, lib/, components/, routes/)?
   ✓ Are there missing files that should exist (e.g., index.js, package.json)?
   ✓ Generic names like "file.js" or "script.py" - REPLACE with specific names

3. KEY_LOGIC VALIDATION:
   ✓ Is each logic item specific and actionable?
   ✓ Does each item include a brief description of what it does?
   ✓ Are there missing logic items implied by the steps?
   ✓ Are function names realistic (camelCase for JS, snake_case for Python)?
   ✓ Are there any placeholder names like "doSomething()" or "process()"? - ENHANCE them

4. MODULE COHERENCE CHECK:
   ✓ Does this module logically belong as a separate unit?
   ✓ Are there overlapping responsibilities with other modules?
   ✓ Should this module be split into smaller modules?
   ✓ Should this module be merged with another?

5. STEP COVERAGE CHECK:
   ✓ Cross-reference each step from original steps
   ✓ Is every step covered by at least one module?
   ✓ Are there orphaned steps with no module?

6. DEPENDENCY DETECTION:
   ✓ Are inter-module dependencies clearly stated?
   ✓ Is there a circular dependency (A needs B, B needs A)?
   ✓ Are there missing dependencies that should exist?

7. TECHNOLOGY CONSISTENCY:
   ✓ Do files and logic match the tech stack implied in steps?
   ✓ Are there mixed paradigms (e.g., class-based and functional in same module)?

ENHANCEMENT GUIDELINES:

For UNCLEAR PURPOSE:
Add: "This module [specific action] and [specific outcome]. It depends on [other modules]. It provides [what it exports]."

For MISSING FILES:
Add: "src/[module_name]/index.js" as entry point
Add: "src/[module_name]/[core_functionality].js"

For VAGUE KEY_LOGIC:
Enhance: "functionName(param1, param2) - [specific description of what it does and returns]"

OUTPUT FORMAT:
Return the ENHANCED JSON with ALL improvements applied. Keep the same structure.
Add a "_validation" field at the end of each module with a status.

Example enhanced module:
{
  "user_auth": {
    "purpose": "Handles user authentication including registration, login, and session management. Depends on database_module for user storage and validation. Provides JWT tokens and session cookies for API authorization.",
    "files": ["src/auth/auth.controller.js", "src/auth/auth.middleware.js", "src/auth/jwt.utils.js"],
    "key_logic": [
      "registerUser(email, password) - validates input, hashes password, saves to database, returns user object",
      "loginUser(email, password) - checks credentials, generates JWT token, returns token and user data",
      "verifyToken(req, res, next) - middleware that validates JWT and attaches user to request",
      "refreshToken(refreshToken) - generates new access token from valid refresh token"
    ],
    "_validation": {
      "status": "enhanced",
      "issues_fixed": ["short purpose", "missing files", "vague key_logic"]
    }
  }
}

IMPORTANT: Be THOROUGH but CONCISE. You have limited tokens. Focus on the most critical issues first.`;

    const userPrompt = `As a Design Detective, thoroughly validate and enhance this system design.

Original Steps (for context):
${originalSteps}

Current Design:
${JSON.stringify(systemDesign, null, 2)}

INSTRUCTIONS:
1. Check EVERY module against the Detective Checklist
2. Identify ALL issues (short purpose, missing files, vague logic, missing dependencies)
3. ENHANCE each module by fixing the issues
4. Add a "_validation" field to each module showing what was fixed
5. Return the COMPLETE enhanced JSON

Return ONLY the enhanced JSON, no other text.`;

    try {
        // Call OpenAI API with GPT-4o
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                {
                    role: 'user',
                    content: userPrompt,
                },
            ],
            max_tokens: 600,
            temperature: 0.2,
            response_format: { type: 'json_object' },
        });

        // Extract the enhanced JSON
        const jsonResponse = completion.choices[0]?.message?.content?.trim();

        if (!jsonResponse || jsonResponse.length === 0) {
            console.warn('⚠️ AI returned empty response, using original design');
            return systemDesign;
        }

        // Parse JSON to validate
        let enhancedDesign;
        try {
            enhancedDesign = JSON.parse(jsonResponse);
        } catch (parseError) {
            console.warn(`⚠️ AI returned invalid JSON: ${parseError.message}, using original design`);
            return systemDesign;
        }

        // Validate structure matches original
        if (Object.keys(enhancedDesign).length === 0) {
            console.warn('⚠️ AI returned empty design, using original');
            return systemDesign;
        }

        // Count enhancements
        let enhancedCount = 0;
        for (const [moduleName, moduleData] of Object.entries(enhancedDesign)) {
            if (moduleData._validation && moduleData._validation.status === 'enhanced') {
                enhancedCount++;
            }
        }

        console.log(`✅ Design validation complete - Enhanced ${enhancedCount} modules`);
        return enhancedDesign;

    } catch (error) {
        // Handle errors gracefully - return original design if validation fails
        console.error('Error during design validation:', error.message);
        console.warn('⚠️ Returning original design without enhancement');
        return systemDesign;
    }
}

/**
 * Quick validation to check if a purpose field is clear enough
 * @param {string} purpose - The purpose text to check
 * @returns {boolean} - True if purpose is clear
 */
function isPurposeClear(purpose) {
    if (!purpose || typeof purpose !== 'string') return false;
    if (purpose.length < 50) return false;
    
    const requiredElements = ['what', 'why', 'depends', 'provides'];
    const hasWhat = purpose.toLowerCase().includes('handles') || purpose.toLowerCase().includes('manages') || purpose.toLowerCase().includes('creates');
    const hasWhy = purpose.toLowerCase().includes('to') || purpose.toLowerCase().includes('for');
    const hasDependencies = purpose.toLowerCase().includes('depends') || purpose.toLowerCase().includes('requires') || purpose.toLowerCase().includes('uses');
    
    return hasWhat && hasWhy && purpose.length >= 50;
}

/**
 * Validates a single module's completeness with detailed checks
 * @param {Object} module - The module to validate
 * @returns {Object} - Validation results with issues found and severity
 */
function validateModuleCompleteness(module) {
    const issues = [];
    const warnings = [];
    
    // Check purpose
    if (!module.purpose) {
        issues.push({ severity: 'critical', message: 'purpose is completely missing' });
    } else if (module.purpose.length < 50) {
        warnings.push({ severity: 'warning', message: `purpose is too short (${module.purpose.length} chars, min 50)` });
    } else if (!module.purpose.toLowerCase().includes('depends')) {
        warnings.push({ severity: 'info', message: 'purpose doesn\'t mention dependencies' });
    }
    
    // Check files
    if (!module.files || module.files.length === 0) {
        issues.push({ severity: 'critical', message: 'no files specified' });
    } else {
        const genericFiles = module.files.filter(f => f === 'file.js' || f === 'script.js' || f === 'index.js' && module.files.length === 1);
        if (genericFiles.length > 0) {
            issues.push({ severity: 'high', message: 'contains generic file names that need specificity' });
        }
        
        const missingExtensions = module.files.filter(f => !f.includes('.'));
        if (missingExtensions.length > 0) {
            warnings.push({ severity: 'medium', message: 'files missing extensions' });
        }
    }
    
    // Check key_logic
    if (!module.key_logic || module.key_logic.length === 0) {
        issues.push({ severity: 'critical', message: 'no key logic specified' });
    } else {
        const vagueLogic = module.key_logic.filter(l => 
            l.toLowerCase().includes('do') || 
            l.toLowerCase().includes('process') || 
            l.toLowerCase().includes('handle') ||
            l.length < 15
        );
        if (vagueLogic.length > 0) {
            warnings.push({ severity: 'medium', message: `${vagueLogic.length} key logic items are vague` });
        }
        
        const missingDescriptions = module.key_logic.filter(l => !l.includes('-') && !l.includes('('));
        if (missingDescriptions.length > 0) {
            warnings.push({ severity: 'medium', message: `${missingDescriptions.length} key logic items missing descriptions` });
        }
    }
    
    const isComplete = issues.length === 0;
    const hasWarnings = warnings.length > 0;
    
    return {
        isComplete: isComplete,
        hasWarnings: hasWarnings,
        issues: issues,
        warnings: warnings,
        score: Math.max(0, 100 - (issues.length * 20) - (warnings.length * 5))
    };
}

/**
 * Validates the entire system design
 * @param {Object} systemDesign - The complete system design
 * @returns {Object} - Overall validation report
 */
function validateFullSystemDesign(systemDesign) {
    const moduleResults = {};
    let totalScore = 0;
    let criticalIssues = 0;
    let totalWarnings = 0;
    
    for (const [moduleName, moduleData] of Object.entries(systemDesign)) {
        const result = validateModuleCompleteness(moduleData);
        moduleResults[moduleName] = result;
        totalScore += result.score;
        criticalIssues += result.issues.filter(i => i.severity === 'critical').length;
        totalWarnings += result.warnings.length;
    }
    
    const averageScore = Object.keys(systemDesign).length > 0 ? totalScore / Object.keys(systemDesign).length : 0;
    
    return {
        overallStatus: criticalIssues === 0 ? (totalWarnings === 0 ? 'excellent' : 'good_with_warnings') : 'needs_improvement',
        averageScore: Math.round(averageScore),
        totalModules: Object.keys(systemDesign).length,
        criticalIssues: criticalIssues,
        totalWarnings: totalWarnings,
        moduleResults: moduleResults
    };
}

module.exports = {
    validateAndEnhanceDesign,
    isPurposeClear,
    validateModuleCompleteness,
    validateFullSystemDesign,
};
