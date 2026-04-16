// text.js
// Skyline AA-1 Project - JSON to Text Plan Conversion & Feasibility Check
// Handles AI conversion, real-world feasibility analysis, and validation

const OpenAI = require('openai');
const { validateTextPlan } = require('./validator');

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates a plain text numbered plan from a structured JSON plan object
 * Includes AI-powered feasibility checks and automatic validation
 * @param {Object} planObject - The structured JSON plan object
 * @returns {Promise<string>} - Plain text numbered list of execution steps
 * @throws {Error} - If AI call fails or output is invalid
 */
async function generateTextPlan(planObject) {
    // AI Conversion & Feasibility Check
    const systemPrompt = `You are a Senior Lead Engineer with 15+ years of full-stack development experience.

Your task: Convert the input JSON plan into a clean, numbered list of plain text execution steps.

CRITICAL RULES:
- Output ONLY the numbered list - NO markdown, NO JSON, NO code blocks, NO backticks
- NO introductory phrases like "Here is the plan:" or "The steps are:"
- NO trailing comments or explanations after the list
- Each step must follow this exact format: "1. [Action]" (number, period, space, then the action)

FORMAT EXAMPLE:
1. Initialize Node.js project and install dependencies (express, mongoose, bcrypt, jsonwebtoken)
2. Create User database model with email/password/hashed_password fields
3. Setup password hashing utility (bcrypt)
4. Create signup endpoint with email validation
5. Create login endpoint with JWT token generation
6. Add token verification middleware
7. Create protected route example
8. Add password reset flow (email token)
9. Implement global error handling middleware

FEASIBILITY REQUIREMENTS:
- Analyze every step for real-world completeness
- If critical pieces are MISSING, ADD them to the list:
  * Database connection setup and configuration
  * Environment variable management (.env files)
  * Error handling middleware and try-catch blocks
  * Security middleware (helmet, CORS, rate limiting)
  * Input validation and sanitization
  * Logging mechanisms
  * Database migrations or schema updates
  * API documentation (Swagger/OpenAPI)
  * Testing strategy (unit/integration tests)
  * Deployment configuration

LOGICAL FLOW REQUIREMENTS:
Order steps following this sequence:
1. Setup & Configuration (project init, dependencies, environment)
2. Database Setup (models, migrations, connections)
3. Backend Logic (utilities, services, business logic)
4. Security Implementation (auth, middleware, encryption)
5. API Endpoints (routes, controllers, validation)
6. Error Handling (global handlers, logging)
7. Frontend Integration (components, API clients)
8. Testing & Documentation
9. Deployment & Monitoring

QUALITY STANDARDS:
- Use imperative verbs (Create, Setup, Implement, Configure, Add, Install)
- Be specific and actionable (e.g., "Create User model with email/password fields" not "Create model")
- Include technology names when specified in the plan
- Ensure no step is ambiguous or too high-level
- Break down complex tasks into multiple substeps`;

    const userPrompt = `Convert the following JSON plan into a numbered list of plain text execution steps. Add any missing critical steps for real-world feasibility. Follow the exact formatting rules.

JSON Plan:
${JSON.stringify(planObject, null, 2)}

Remember: Output ONLY the numbered list. No markdown, no JSON, no extra text. Start with "1. "`;

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
            max_tokens: 1000,
            temperature: 0.2,
        });

        // Extract the generated text
        let plainSteps = completion.choices[0]?.message?.content?.trim();

        // Output Cleaning
        if (!plainSteps || plainSteps.length === 0) {
            throw new Error('AI returned empty content. No steps generated.');
        }

        // Remove common introductory phrases
        const introPatterns = [
            /^here\s+is\s+the\s+plan:?\s*/i,
            /^the\s+steps\s+are:?\s*/i,
            /^below\s+is\s+the\s+plan:?\s*/i,
            /^i'll\s+provide\s+the\s+steps:?\s*/i,
            /^let me\s+provide\s+the\s+steps:?\s*/i,
            /^```\s*\n?/,
            /^\n*```\n?/,
        ];

        for (const pattern of introPatterns) {
            plainSteps = plainSteps.replace(pattern, '');
        }

        // Remove trailing markdown code blocks
        plainSteps = plainSteps.replace(/```[\s\S]*?```/g, '');
        
        // Remove any trailing explanatory text
        const lines = plainSteps.split('\n');
        const cleanedLines = [];
        let foundSteps = false;
        
        for (const line of lines) {
            if (/^\d+\.\s+\S/.test(line)) {
                cleanedLines.push(line);
                foundSteps = true;
            } else if (foundSteps && line.trim().length > 0) {
                if (/^\s+\S/.test(line) || /^[a-z]/i.test(line)) {
                    const lastIndex = cleanedLines.length - 1;
                    if (lastIndex >= 0) {
                        cleanedLines[lastIndex] += ' ' + line.trim();
                    }
                } else if (line.trim().length > 0) {
                    break;
                }
            }
        }
        
        plainSteps = cleanedLines.join('\n');

        // Final validation
        if (!/^\d+\.\s+\S/m.test(plainSteps)) {
            throw new Error('AI output does not contain properly formatted numbered steps');
        }

        const stepLines = plainSteps.split('\n').filter(line => /^\d+\.\s+\S/.test(line));
        if (stepLines.length === 0) {
            throw new Error('No valid numbered steps found in AI output');
        }

        // Renumber steps sequentially
        const renumberedSteps = stepLines.map((line, index) => {
            return line.replace(/^\d+\./, `${index + 1}.`);
        });
        
        plainSteps = renumberedSteps.join('\n');

        // Step 4: Validate the generated text plan using validator.js
        console.log('🔍 Validating generated text plan...');
        const validationResult = await validateTextPlan(plainSteps);
        
        // Use fixed plan if available, otherwise use original
        let finalSteps = plainSteps;
        
        if (validationResult.fixedPlan && validationResult.fixedPlan !== plainSteps) {
            console.log('📝 Using reordered plan from validator');
            finalSteps = validationResult.fixedPlan;
        }
        
        if (!validationResult.isValid) {
            console.warn('⚠️ Text plan validation warnings:');
            validationResult.errors.forEach(error => console.warn(`   - ${error}`));
            console.warn('Plan generated but has validation issues.');
        } else {
            console.log('✅ Text plan validation passed!');
        }

        // Return ONLY the plain text steps string
        return finalSteps;

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
        
        throw new Error(`Failed to generate text plan: ${error.message}`);
    }
}

/**
 * Batch version for processing multiple plan objects
 * @param {Array<Object>} planObjects - Array of plan objects
 * @returns {Promise<Array<string>>} - Array of plain text plans
 */
async function generateMultipleTextPlans(planObjects) {
    if (!Array.isArray(planObjects)) {
        throw new Error('Expected an array of plan objects');
    }
    
    const results = [];
    for (let i = 0; i < planObjects.length; i++) {
        try {
            const textPlan = await generateTextPlan(planObjects[i]);
            results.push(textPlan);
        } catch (error) {
            console.error(`Failed to generate text plan for item ${i}: ${error.message}`);
            results.push(null);
        }
    }
    
    return results;
}

module.exports = {
    generateTextPlan,
    generateMultipleTextPlans,
};
