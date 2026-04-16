// validator.js
// Skyline AA-1 Project - Technical Order & Logic Auditor
// Validates plain text development steps focusing on correct order and logical flow

const OpenAI = require('openai');

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Validates a plain text plan of numbered development steps
 * Focuses on order correctness and logical flow
 * @param {string} stepsText - Numbered list of development steps
 * @returns {Promise<{isValid: boolean, errors: string[], rawResponse: string, fixedPlan?: string, addedSteps?: string[]}>}
 * @throws {Error} - If API call fails or response is empty
 */
async function validateTextPlan(stepsText) {
    // Validate input
    if (!stepsText || typeof stepsText !== 'string') {
        throw new Error('Invalid input: stepsText must be a non-empty string');
    }

    if (stepsText.trim().length === 0) {
        throw new Error('Invalid input: stepsText cannot be empty');
    }

    const systemPrompt = `You are a Technical Order & Logic Auditor for software development plans.

Your PRIMARY role: REORDER the steps into CORRECT LOGICAL ORDER.

CRITICAL RULE: You MUST output a REORDERED version of the plan. Do NOT just copy the original.

LOGICAL ORDER RULES (follow strictly):
1. Setup & Installation steps FIRST (install packages, setup framework)
2. Database setup NEXT (connection, models, schemas)
3. Authentication/Utilities NEXT (JWT, bcrypt, helpers)
4. API Endpoints NEXT (routes, controllers)
5. Middleware NEXT (error handling, security, logging)
6. Frontend NEXT (React components, styling)
7. Testing NEXT (unit tests, integration tests)
8. Documentation NEXT (Swagger, API docs)
9. Deployment LAST (config, monitoring)

SPECIFIC ORDER CHECKS:
- "Initialize Node.js" or "Install dependencies" MUST be step 1
- "Setup Express server" MUST come BEFORE "Create API endpoints"
- "Create User model" MUST come BEFORE "JWT authentication"
- "Setup database connection" MUST come BEFORE any database operations
- "Create API endpoints" MUST come BEFORE "Connect frontend to backend"
- React setup MUST come BEFORE creating React components

OUTPUT FORMAT (STRICT - YOU MUST FOLLOW THIS EXACTLY):
- If order is CORRECT: Return exactly "VALID"
- If order is WRONG: 
  * First line: "ERROR: [specific wrong order issue]"
  * Second line: "FIXED PLAN:"
  * Then each renumbered step on a new line (1., 2., 3., etc.)
  * Keep ALL original text, just change the order and numbers

Example CORRECT output:
VALID

Example WRONG order output (MUST reorder):
ERROR: Step 5 uses JWT before step 3 creates user model

FIXED PLAN:
1. Initialize Node.js project and install dependencies
2. Setup Express server
3. Create User database model
4. Setup database connection
5. Implement JWT authentication
6. Create API endpoints
7. Add error handling middleware
8. Create React frontend
9. Write tests

CRITICAL: You MUST reorder the steps. Do NOT return the same order as the input.`;

    const userPrompt = `REORDER these development steps into the correct logical order. DO NOT just copy them - you MUST reorder them if needed.

Original steps:
${stepsText}

Rules to apply:
1. "Initialize Node.js" or "Install dependencies" → MUST be first
2. "Setup Express" or "Create server" → MUST come before API endpoints
3. "Create User model" → MUST come before authentication (JWT, bcrypt)
4. "Setup database" → MUST come before using database
5. "Create API endpoints" → MUST come before frontend connection
6. React setup → MUST come before React components

Return in this exact format if changes needed:
ERROR: [describe the wrong order issue]

FIXED PLAN:
1. [reordered step 1]
2. [reordered step 2]
... (all steps renumbered)

If no changes needed, return exactly: VALID

Now REORDER the steps above if needed.`;

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
            temperature: 0.3,
        });

        // Extract the AI response
        const aiResponse = completion.choices[0]?.message?.content?.trim();

        if (!aiResponse || aiResponse.length === 0) {
            throw new Error('AI returned empty response');
        }

        // Parse the response
        const rawResponse = aiResponse;
        
        // Check if valid
        if (aiResponse === 'VALID') {
            return {
                isValid: true,
                errors: [],
                rawResponse: rawResponse,
                fixedPlan: null,
                addedSteps: null
            };
        }
        
        // Extract errors and fixed plan
        const errors = [];
        let fixedPlan = null;
        const lines = aiResponse.split('\n');
        let inFixedPlan = false;
        let fixedPlanLines = [];
        
        for (const line of lines) {
            if (line.startsWith('ERROR:')) {
                const errorMessage = line.substring(7).trim();
                if (errorMessage) {
                    errors.push(errorMessage);
                }
            } else if (line.startsWith('FIXED PLAN:')) {
                inFixedPlan = true;
                continue;
            } else if (inFixedPlan && line.trim().length > 0) {
                // Only add lines that look like numbered steps
                if (/^\d+\./.test(line.trim())) {
                    fixedPlanLines.push(line.trim());
                }
            }
        }
        
        if (fixedPlanLines.length > 0) {
            fixedPlan = fixedPlanLines.join('\n');
        }
        
        // If we have errors but no fixed plan, that's a problem
        if (errors.length > 0 && !fixedPlan) {
            fixedPlan = stepsText; // fallback to original
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors,
            rawResponse: rawResponse,
            fixedPlan: fixedPlan,
            addedSteps: null
        };
        
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
        
        throw new Error(`Failed to validate text plan: ${error.message}`);
    }
}

/**
 * Validates and automatically fixes the order of a text plan
 * @param {string} stepsText - Numbered list of development steps
 * @returns {Promise<{isValid: boolean, fixedPlan: string, changes: string[], addedSteps: string[]}>}
 */
async function validateAndFixOrder(stepsText) {
    const result = await validateTextPlan(stepsText);
    
    if (result.isValid) {
        return {
            isValid: true,
            fixedPlan: stepsText,
            changes: [],
            addedSteps: []
        };
    }
    
    return {
        isValid: false,
        fixedPlan: result.fixedPlan || stepsText,
        changes: result.errors,
        addedSteps: result.addedSteps || []
    };
}

/**
 * Validates a text plan and returns a simplified boolean result
 * @param {string} stepsText - Numbered list of development steps
 * @returns {Promise<boolean>} - True if valid, false otherwise
 */
async function isTextPlanValid(stepsText) {
    try {
        const result = await validateTextPlan(stepsText);
        return result.isValid;
    } catch (error) {
        console.error('Validation error:', error.message);
        return false;
    }
}

/**
 * Validates a text plan and throws an error if invalid
 * @param {string} stepsText - Numbered list of development steps
 * @throws {Error} - If plan is invalid, includes error messages
 */
async function validateTextPlanOrThrow(stepsText) {
    const result = await validateTextPlan(stepsText);
    
    if (!result.isValid) {
        const errorMessages = result.errors.join('\n');
        throw new Error(`Plan validation failed:\n${errorMessages}`);
    }
    
    return true;
}

module.exports = {
    validateTextPlan,
    isTextPlanValid,
    validateTextPlanOrThrow,
    validateAndFixOrder,
};
