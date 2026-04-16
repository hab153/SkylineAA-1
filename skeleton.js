// skeleton.js
// Skyline AA-1 Project - Code Skeleton Generation (Step 4)
// Converts dynamic JSON design map into a STRICT code-structure blueprint with real syntax
// Integrated with exam.js for automatic validation and self-correction

const OpenAI = require('openai');
const { examineAndFixSkeleton } = require('./exam'); // Import the examiner

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates a strict code-structure skeleton blueprint from a system design JSON
 * @param {Object} designJson - The system design JSON from design.js
 * @returns {Promise<string>} - Plain text blueprint with real syntax, imports, and connections
 * @throws {Error} - If AI call fails or output is invalid
 */
async function generateCodeSkeleton(designJson) {
    // Validate input
    if (!designJson || typeof designJson !== 'object') {
        throw new Error('Invalid input: designJson must be a non-empty object');
    }

    if (Object.keys(designJson).length === 0) {
        throw new Error('Invalid input: designJson has no modules');
    }

    // Collect all files from the design
    const allFiles = [];
    for (const [moduleName, moduleData] of Object.entries(designJson)) {
        if (moduleData.files && Array.isArray(moduleData.files)) {
            for (const file of moduleData.files) {
                allFiles.push({
                    module: moduleName,
                    file: file,
                    purpose: moduleData.purpose,
                    key_logic: moduleData.key_logic
                });
            }
        }
    }

    if (allFiles.length === 0) {
        throw new Error('No files found in designJson');
    }

    // Dynamic System Prompt - Upgraded for Framework Correctness + Execution Flow
    const systemPrompt = `You are a Principal Software Architect. Generate a STRICT CODE-STRUCTURE SKELETON using REAL SYNTAX.
🚨 CRITICAL RULES (NON-NEGOTIABLE):

1. NO DOCUMENTATION / NO EXPLANATIONS:
   - ❌ BAD: "Function login() → Handles user login"
   - ✅ GOOD: "async def login(request: Request): ..." OR "const login = async (req, res) => { ... }"
   - Output must look like PSEUDO-CODE STRUCTURE using actual syntax elements (variables, assignments, signatures).

2. STRICT FRAMEWORK CORRECTNESS (NO MIXING):
   - Detect the framework from FILE EXTENSIONS and CONTEXT.
   - Python (.py/FastAPI): Use 'async def', 'Pydantic models', 'Depends()', '@app.get'.
   - JavaScript (.js/Express): Use 'const', 'req/res/next', 'module.exports', 'router.get'.
   - TypeScript (.ts/NestJS): Use '@Controller', '@Injectable', 'interface'.
   - Go (.go): Use 'func', 'struct', 'package main'.
   - ❌ NEVER mix syntax (e.g., do NOT use 'require' in Python or 'def' in JS).

3. EXPLICIT EXECUTION FLOW & IMPORTS (THE GLUE):
   - You MUST show how the system CONNECTS.
   - EVERY file MUST start with specific IMPORTS from other local files.
   - Main Entry Point (e.g., main.py, server.js, app.go) MUST import and register all routers/modules.
   - Controllers MUST import Services/Models.
   - Routes MUST import Controllers/Middleware.
   - Example Flow:
     main.py imports user_routes.
     user_routes imports user_controller.
     user_controller imports user_model.

OUTPUT FORMAT (STRICT PLAIN TEXT):

[filename.ext]:
  [Import Statements specific to this language/framework]
  
  [Global Variables / Configurations]
  [Class Definitions with Properties]
  [Function Signatures with Parameters]
  [Route Registrations / Middleware Applications]

SEPARATE FILES WITH BLANK LINES.

QUALITY CHECKS:
- Every file must have import statements.
- Every file must show connections to other files via imports.
- Use real syntax symbols: =, =>, { }, (), ., @, #, def, class, func.
- NO descriptive text outside of code structure.
- NO markdown formatting (no \`\`\`).
- Indent with 2 spaces inside blocks.

CRITICAL: Return ONLY the skeleton blueprint. NO JSON wrapper. NO markdown code blocks. NO explanatory text.`;

    const userPrompt = `Generate a STRICT CODE-STRUCTURE SKELETON for these files using REAL SYNTAX.
System Design:
${JSON.stringify(designJson, null, 2)}

Files to generate skeletons for:
${allFiles.map(f => `- ${f.file}: ${f.purpose.substring(0, 100)}`).join('\n')}

REQUIREMENTS:
1. Detect framework from file extensions (.py, .js, .ts, etc.) and apply CORRECT syntax.
2. Show IMPORTS for every file to establish EXECUTION FLOW.
3. Show how files CONNECT (Main -> Routes -> Controllers -> Models).
4. Use REAL SYNTAX (not descriptions).
5. NO documentation text like "handles user login".
6. ONLY code structure: imports, assignments, function signatures, class definitions.

Return format (plain text only):

[filename.ext]:
  [import statements]
  [code structure]

NO markdown. NO JSON. NO explanations. ONLY code skeleton.`;

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
            max_tokens: 1500,
            temperature: 0.1,
        });

        // Extract the generated blueprint
        let blueprint = completion.choices[0]?.message?.content?.trim();

        if (!blueprint || blueprint.length === 0) {
            throw new Error('Skeleton Generation Error: AI returned empty content');
        }

        // Check for documentation-style text (bad patterns)
        const badPatterns = [            /→\s*Handles/i,
            /→\s*Manages/i,
            /→\s*Processes/i,
            /function\s+\w+\s*\(\s*\)\s*→/i,
            /purpose:/i
        ];

        let hasDocumentationStyle = false;
        for (const pattern of badPatterns) {
            if (pattern.test(blueprint)) {
                hasDocumentationStyle = true;
                console.warn(`⚠️ Found documentation pattern: ${pattern}`);
                break;
            }
        }

        if (hasDocumentationStyle) {
            console.warn('⚠️ Blueprint contains documentation-style text instead of real syntax');
        }

        // Check for real syntax patterns (Dynamic Check)
        const hasRealSyntax = /(import|from|require|const|let|var|def|class|@|=>|=|{|}|\(\)|->|func|package)/m.test(blueprint);
        if (!hasRealSyntax) {
            throw new Error('Invalid Skeleton Format Error: No real syntax detected');
        }

        // Clean up any markdown code blocks
        blueprint = blueprint.replace(/```[\s\S]*?\n/g, '');
        blueprint = blueprint.replace(/```/g, '');
        blueprint = blueprint.trim();

        // Count files generated
        const fileMatches = blueprint.match(/^[a-zA-Z0-9_\-./]+\.\w+:/gm);
        const fileCount = fileMatches ? fileMatches.length : 0;

        console.log(`✅ Code skeleton generated with ${fileCount} files. Sending to examiner...`);
        
        // --- NEW STEP: Send to exam.js for validation and auto-fixing ---
        const finalBlueprint = await examineAndFixSkeleton(blueprint, designJson);
        
        console.log(`✅ Final blueprint ready.`);
        
        return finalBlueprint;

    } catch (error) {
        // Handle OpenAI API specific errors
        if (error.status === 401) {
            throw new Error('OpenAI API authentication failed. Please check your OPENAI_API_KEY environment variable.');
        }
                if (error.status === 429) {
            throw new Error('OpenAI API rate limit exceeded. Please wait and try again.');
        }
        
        if (error.status === 500 || error.status === 503) {
            throw new Error('OpenAI API server error. Please try again later.');
        }
        
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            throw new Error('Network error: Cannot reach OpenAI API. Please check your internet connection.');
        }
        
        if (error.code === 'ETIMEDOUT') {
            throw new Error('OpenAI API request timed out. Please try again.');
        }
        
        if (error.message.includes('Invalid Skeleton Format Error')) {
            throw error;
        }
        
        throw new Error(`Failed to generate code skeleton: ${error.message}`);
    }
}

/**
 * Extracts all unique file extensions from a design JSON
 * @param {Object} designJson - The system design JSON
 * @returns {string[]} - Array of unique file extensions
 */
function getFileExtensions(designJson) {
    const extensions = new Set();
    
    for (const moduleData of Object.values(designJson)) {
        if (moduleData.files && Array.isArray(moduleData.files)) {
            for (const file of moduleData.files) {
                const ext = file.split('.').pop();
                if (ext && ext !== file) {
                    extensions.add(ext);
                }
            }
        }
    }
    
    return Array.from(extensions);
}

/**
 * Validates if a blueprint contains all expected files
 * @param {string} blueprint - The generated blueprint
 * @param {Object} designJson - The original design JSON * @returns {Object} - Validation results
 */
function validateBlueprintCoverage(blueprint, designJson) {
    const expectedFiles = [];
    for (const moduleData of Object.values(designJson)) {
        if (moduleData.files && Array.isArray(moduleData.files)) {
            expectedFiles.push(...moduleData.files);
        }
    }
    
    const foundFiles = [];
    const lines = blueprint.split('\n');
    for (const line of lines) {
        const match = line.match(/^([a-zA-Z0-9_\-./]+\.\w+):/);
        if (match) {
            foundFiles.push(match[1]);
        }
    }
    
    const missingFiles = expectedFiles.filter(f => !foundFiles.some(ff => ff.includes(f.split('/').pop())));
    const hasRealSyntax = /(import|from|require|const|let|var|def|class|@|=>|=|{|}|\(\)|->|func)/m.test(blueprint);
    const hasDocumentationStyle = /→\s*Handles|→\s*Manages|purpose:/i.test(blueprint);
    
    return {
        totalExpected: expectedFiles.length,
        totalFound: foundFiles.length,
        missingFiles: missingFiles,
        coveragePercent: expectedFiles.length > 0 ? (foundFiles.length / expectedFiles.length) * 100 : 0,
        hasRealSyntax: hasRealSyntax,
        hasDocumentationStyle: hasDocumentationStyle,
        isValid: hasRealSyntax && !hasDocumentationStyle
    };
}

module.exports = {
    generateCodeSkeleton,
    getFileExtensions,
    validateBlueprintCoverage
};
