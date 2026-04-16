// Skyline AA-1 - Intent Understanding Module (PRO MAX v5 - Clarification Enabled)

require('dotenv').config();
const OpenAI = require('openai');
const { repairPlan } = require('./repair'); 

if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY missing in .env');
    process.exit(1);
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 🧠 SAFE PARSER
 */
function safeParse(json) {
    try {
        return JSON.parse(json);
    } catch {
        throw new Error("AI returned invalid JSON");
    }
}

/**
 * 🧠 VALIDATION LAYER
 */
function validatePlanStructure(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid response object');
    }

    const requiredFields = [
        'goal',
        'type',
        'intent_classification',
        'features',
        'tasks',
        'constraints',
        'constraints_checked',
        'execution_check',
        'complexity',
        'confidence',
        'expected_output'
    ];

    for (const f of requiredFields) {
        if (!(f in data)) throw new Error(`Missing field: ${f}`);    }

    if (typeof data.goal !== 'string' || !data.goal.trim()) {
        throw new Error('Invalid goal');
    }

    const validTypes = ['frontend', 'backend', 'fullstack'];
    if (!validTypes.includes(data.type)) {
        throw new Error('Invalid type');
    }

    if (!Array.isArray(data.features)) {
        throw new Error('Invalid features');
    }

    if (!Array.isArray(data.tasks)) {
        throw new Error('Invalid tasks');
    }

    if (!data.execution_check?.feasible) {
        throw new Error('Missing execution feasibility check');
    }

    if (typeof data.confidence !== 'number') {
        throw new Error('Invalid confidence');
    }

    return data;
}

/**
 * 🧠 INPUT HANDLER
 */
function extractUserInput(requestData) {
    if (typeof requestData === 'string') return requestData;

    if (typeof requestData === 'object' && requestData !== null) {
        // If context exists (answers to questions), combine them
        if (requestData.context && requestData.text) {
            return `Original Request: ${requestData.text}\n\nUser Clarifications:\n${JSON.stringify(requestData.context, null, 2)}`;
        }
        return (
            requestData.text ||
            requestData.rawInput ||
            requestData.content ||
            requestData.message ||
            JSON.stringify(requestData)
        );
    }
    throw new Error('Invalid input');
}

/**
 * 🔍 STEP 1: CLARIFICATION CHECKER
 */
async function checkForClarification(userInput) {
    const systemPrompt = `
You are Skyline AA-1 Intent Analyzer.

TASK:
Analyze the user's request. Determine if it is too vague to create a precise technical plan.

RULES:
1. Detect the LANGUAGE the user is writing in.
2. If the request is vague, generate exactly 4-5 specific clarification questions.
3. The questions MUST be in the SAME LANGUAGE as the user's input.
4. If the request is clear enough to proceed, return status "clear".

OUTPUT FORMAT (JSON ONLY):
{
  "status": "needs_clarification" | "clear",
  "questions": ["string"] | null
}

EXAMPLES:
User: "Make a login page"
Output: { "status": "needs_clarification", "questions": ["What framework?", "Database?", "Auth method?", "UI style?"] }

User: "Build a React login page with Firebase Auth and Tailwind CSS"
Output: { "status": "clear", "questions": null }
`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userInput }
            ],
            temperature: 0.2,
            max_tokens: 600,
            response_format: { type: 'json_object' }
        });

        const raw = completion.choices[0]?.message?.content;
        if (!raw) throw new Error('Empty clarification response');
        
        return safeParse(raw);
    } catch (error) {        console.error("Clarification Check Failed:", error.message);
        // Fail safe: Assume clear if check fails to avoid infinite loops
        return { status: "clear", questions: null };
    }
}

/**
 * 🚀 STEP 2: FINAL PLAN GENERATOR
 */
async function generateFinalPlan(processedInput) {
    const systemPrompt = `
You are Skyline AA-1 PRO MAX AI Planner.

Rules:
- JSON ONLY
- NO assumptions about backend/frontend unless necessary
- MUST include tasks
- MUST include execution_check
- MUST include confidence score

OUTPUT SCHEMA:
{
  "goal": "string",
  "type": "frontend | backend | fullstack",

  "intent_classification": {
    "level": "ui_only | api_needed | full_system",
    "confidence": number
  },

  "features": ["string"],

  "tasks": [
    {
      "step": "string",
      "type": "ui | logic | backend | styling"
    }
  ],

  "constraints": {
    "language": "string or null",
    "framework": "string or null",
    "database": "string or null",
    "security": ["string"],
    "offline_supported": boolean
  },

  "constraints_checked": {
    "frontend_only": boolean,
    "backend_needed": boolean,    "security_level": "low | medium | high reasoning"
  },

  "execution_check": {
    "feasible": boolean,
    "risk_level": "low | medium | high",
    "missing_parts": ["string"]
  },

  "complexity": "Low | Medium | High",
  "confidence": number,

  "expected_output": ["string"]
}
`;

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: processedInput }
        ],
        temperature: 0.2,
        max_tokens: 1300,
        response_format: { type: 'json_object' }
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty AI response');

    const parsed = safeParse(raw);
    const validated = validatePlanStructure(parsed);
    const repaired = await repairPlan(validated);

    console.log("✅ FINAL PRO MAX OUTPUT");
    console.log({
        goal: repaired.goal,
        intent: repaired.intent_classification.level,
        feasibility: repaired.execution_check.feasible,
        confidence: repaired.confidence
    });

    return repaired;
}

/**
 * 🚀 MAIN ENGINE ENTRY POINT
 */
async function handlePlanRequest(requestData) {
    try {        const userInput = extractUserInput(requestData).trim();
        if (!userInput) throw new Error('Empty input');

        // Check if we already have context (answers provided)
        const hasContext = requestData.context && Object.keys(requestData.context).length > 0;

        if (hasContext) {
            // If context exists, skip clarification and go straight to planning
            console.log("🔄 Context detected. Generating final plan...");
            const finalPlan = await generateFinalPlan(userInput);
            return { success: true, data: finalPlan };
        } else {
            // No context: Check if clarification is needed
            console.log("🔍 Checking for clarification needs...");
            const clarificationResult = await checkForClarification(userInput);

            if (clarificationResult.status === 'needs_clarification') {
                console.log("❓ Clarification needed.");
                return { 
                    success: true, 
                    data: { 
                        status: "needs_clarification", 
                        questions: clarificationResult.questions 
                    } 
                };
            } else {
                console.log("✅ Request clear. Generating plan...");
                const finalPlan = await generateFinalPlan(userInput);
                return { success: true, data: finalPlan };
            }
        }

    } catch (error) {
        throw new Error(`Plan failed: ${error.message}`);
    }
}

module.exports = { handlePlanRequest };
