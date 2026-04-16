// design.js
// Skyline AA-1 Project - System Design & Decomposition (Step 3)
// Converts plain text numbered steps into a dynamic JSON blueprint

const OpenAI = require('openai');
const { validateAndEnhanceDesign } = require('./test');

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Attempts to fix truncated JSON by adding missing quotes or brackets
 * @param {string} jsonString - Potentially truncated JSON string
 * @returns {string} - Attempted fixed JSON string
 */
function attemptFixTruncatedJson(jsonString) {
    // Try to complete unterminated strings
    let fixed = jsonString;
    
    // Count opening vs closing braces
    const openBraces = (fixed.match(/\{/g) || []).length;
    const closeBraces = (fixed.match(/\}/g) || []).length;
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    
    // Add missing closing braces
    for (let i = 0; i < openBraces - closeBraces; i++) {
        fixed += '}';
    }
    
    // Add missing closing brackets
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
        fixed += ']';
    }
    
    // If last line has unterminated string, try to close it
    const lines = fixed.split('\n');
    const lastLine = lines[lines.length - 1];
    if (lastLine.includes('"') && (lastLine.split('"').length % 2 === 0)) {
        // Unterminated string - add closing quote
        fixed += '"';
    }
    
    return fixed;
}

/**
 * Generates a dynamic system design JSON from plain text development steps
 * @param {string} stepsText - Numbered list of plain text development steps
 * @returns {Promise<Object>} - Dynamic JSON blueprint with modules, purposes, files, and key logic
 * @throws {Error} - If AI call fails or output is invalid JSON
 */
async function generateSystemDesign(stepsText) {
    // Validate input
    if (!stepsText || typeof stepsText !== 'string') {
        throw new Error('Invalid input: stepsText must be a non-empty string');
    }

    if (stepsText.trim().length === 0) {
        throw new Error('Invalid input: stepsText cannot be empty');
    }

    const systemPrompt = `You are a Dynamic System Architect specializing in code generation preparation.

Your task: Analyze the provided development steps and decompose them into a logical, dynamic JSON structure with DETAILED, COMPLETE explanations.

CRITICAL RULES:
- DO NOT hardcode categories like "frontend" or "backend"
- Let the project's natural architecture emerge from the steps
- Create modules based on WHAT the project actually needs
- Provide THOROUGH, DETAILED explanations for each module
- Keep responses concise but complete - you have limited tokens

ANALYSIS PROCESS:
1. Read all steps to understand the complete project
2. Identify natural groupings (e.g., database work, API work, UI work, utilities)
3. Name modules based on their actual purpose (e.g., "user_authentication", "data_storage")
4. For each module, extract:
   - Specific files that need to be created
   - Key functions, classes, or logic that belongs in that module

OUTPUT STRUCTURE (keep it compact but complete):
{
  "module_name": {
    "purpose": "What it does, why needed, dependencies (1-2 sentences)",
    "files": ["file1.ext", "file2.ext"],
    "key_logic": ["function1() - brief description", "function2() - brief description"]
  }
}

QUALITY REQUIREMENTS:
- Every step should be represented
- Files must have realistic extensions (.js, .py, .css, .html)
- Key logic must be specific and actionable
- JSON must be valid and complete

IMPORTANT: Return ONLY valid, complete JSON. No trailing commas. Close all brackets and braces.`;

    const userPrompt = `Create a system design JSON from these development steps. Keep it compact but complete.

Steps:
${stepsText}

Return ONLY valid JSON.`;

    try {
        // Call OpenAI API with GPT-4o
        let completion;
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount <= maxRetries) {
            try {
                completion = await openai.chat.completions.create({
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
                    max_tokens: 3000,
                    temperature: 0.2,
                    response_format: { type: 'json_object' },
                });
                break;
            } catch (apiError) {
                if (apiError.status === 400 && apiError.message.includes('max_tokens') && retryCount < maxRetries) {
                    console.warn(`⚠️ Token limit issue, retrying with reduced output...`);
                    retryCount++;
                } else {
                    throw apiError;
                }
            }
        }

        // Extract the generated JSON
        let jsonResponse = completion.choices[0]?.message?.content?.trim();

        if (!jsonResponse || jsonResponse.length === 0) {
            throw new Error('AI returned empty response');
        }

        // Parse JSON to validate
        let systemDesign;
        try {
            systemDesign = JSON.parse(jsonResponse);
        } catch (parseError) {
            console.warn(`⚠️ Initial JSON parse failed: ${parseError.message}`);
            
            // Try to fix truncated JSON
            const fixedJson = attemptFixTruncatedJson(jsonResponse);
            try {
                systemDesign = JSON.parse(fixedJson);
                console.log('✅ Successfully fixed and parsed JSON');
            } catch (secondError) {
                throw new Error(`AI returned invalid JSON: ${parseError.message}`);
            }
        }

        // Validate structure (should have at least one module)
        if (Object.keys(systemDesign).length === 0) {
            throw new Error('AI returned empty design with no modules');
        }

        // Validate each module has required fields
        for (const [moduleName, moduleData] of Object.entries(systemDesign)) {
            if (!moduleData.purpose || typeof moduleData.purpose !== 'string') {
                moduleData.purpose = moduleData.purpose || "Purpose not specified - check original steps";
            }
            if (!moduleData.files || !Array.isArray(moduleData.files)) {
                moduleData.files = ["src/" + moduleName + "/index.js"];
            }
            if (!moduleData.key_logic || !Array.isArray(moduleData.key_logic)) {
                moduleData.key_logic = ["implement core functionality"];
            }
        }

        console.log(`✅ System design generated with ${Object.keys(systemDesign).length} modules`);
        
        // Step: Validate and enhance the design using test.js
        console.log('🔍 Validating and enhancing design with test.js...');
        const enhancedDesign = await validateAndEnhanceDesign(systemDesign, stepsText);
        
        console.log('✅ Design validation and enhancement complete');
        return enhancedDesign;

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
        
        // Re-throw with more context for other errors
        throw new Error(`Failed to generate system design: ${error.message}`);
    }
}

/**
 * Validates a system design JSON structure
 * @param {Object} systemDesign - The system design object to validate
 * @returns {boolean} - True if valid
 */
function validateSystemDesign(systemDesign) {
    if (!systemDesign || typeof systemDesign !== 'object') {
        return false;
    }
    
    for (const moduleData of Object.values(systemDesign)) {
        if (!moduleData.purpose || !Array.isArray(moduleData.files) || !Array.isArray(moduleData.key_logic)) {
            return false;
        }
    }
    
    return true;
}

module.exports = {
    generateSystemDesign,
    validateSystemDesign,
};
