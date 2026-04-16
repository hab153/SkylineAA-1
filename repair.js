// Skyline AA-1 - Self Repair AI Engine (PRO MAX)

require('dotenv').config();
const OpenAI = require('openai');

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
        throw new Error("Repair AI returned invalid JSON");
    }
}

/**
 * 🔁 SELF-REPAIR ENGINE
 */
async function repairPlan(planData) {
    try {
        if (!planData || typeof planData !== 'object') {
            throw new Error("Invalid plan input for repair");
        }

        const systemPrompt = `
You are Skyline AA-1 Repair AI.

Your job:
- Fix mistakes in AI-generated plans
- Remove hallucinations
- Simplify over-engineered steps
- Ensure frontend/backend correctness
- Ensure consistency and logic

RULES:
- RETURN ONLY VALID JSON
- DO NOT add new features
- DO NOT over-engineer
- ONLY fix issues
- KEEP structure identical
- If already correct, return as-is

CHECKS:
- Are tasks realistic?
- Is type correct?
- Is security overused?
- Is backend wrongly added?
- Is complexity correct?

OUTPUT MUST MATCH INPUT STRUCTURE EXACTLY.
`;

        const userPrompt = `
Fix this plan if needed:

${JSON.stringify(planData, null, 2)}
`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.1,
            max_tokens: 500, // 🔥 STRICT LIMIT
            response_format: { type: 'json_object' }
        });

        const raw = completion.choices[0]?.message?.content;

        if (!raw) {
            throw new Error("Empty repair response");
        }

        const repaired = safeParse(raw);

        console.log("🔁 Repair AI executed");

        return repaired;

    } catch (error) {
        console.error("❌ Repair failed:", error.message);

        // 🧠 FALLBACK: return original plan if repair fails
        return planData;
    }
}

module.exports = { repairPlan };
