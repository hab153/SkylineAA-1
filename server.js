// server.js
/**
 * SKYLINE AA-1 - WEEK 41 (DEPLOYMENT READY)
 * The Web Server: Serves BOTH the API (Backend) and the UI (Frontend).
 * Uses Native HTTP module for maximum control and zero-dependency static serving.
 */

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Import Pipeline Modules
const { handlePlanRequest } = require('./plan');
const { generateTextPlan } = require('./text');
const { generateSystemDesign } = require('./design');
const { generateCodeSkeleton } = require('./skeleton');
const { generateAllCode } = require('./code');
const { validateAndFixSyntax } = require('./syntax');
const { validateAndFixTypos } = require('./Typos');
const { validateAndFixSemicolons } = require('./semicolons');
const { validateAndFixLogic } = require('./logic');
const { validateAndFixSecurity } = require('./security');

const PORT = process.env.PORT || 5001;

// Job storage (In production, use Redis)
const jobs = new Map();

// Helper: Parse JSON Body
const parseBody = (req) => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); } 
            catch (e) { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
};

// Helper: Send JSON Response
const sendJSON = (res, statusCode, data) => {
    res.writeHead(statusCode, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));};

// Async job processor
async function processJob(jobId, requestData) {
    try {
        console.log(`🚀 [Job ${jobId}] Starting processing...`);
        
        jobs.set(jobId, { 
            ...jobs.get(jobId),
            currentStep: '📋 Planning',
            stepNumber: 1,
            totalSteps: 10,
            progress: 10
        });
        
        // Step 1: Plan
        console.log(`📋 [Job ${jobId}] [1/10] Generating structured JSON plan...`);
        const planResult = await handlePlanRequest(requestData);
        
        if (planResult.data && planResult.data.status === 'needs_clarification') {
            jobs.set(jobId, {
                status: 'needs_clarification',
                data: planResult.data, // FIXED: Explicit key 'data'
                completedAt: Date.now()
            });
            return;
        }

        // Step 2: Text
        console.log(`📝 [Job ${jobId}] [2/10] Generating plain text steps...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '📝 Text Generation', stepNumber: 2, progress: 20 });
        const textPlan = await generateTextPlan(planResult.data);
        
        // Step 3: Design
        console.log(`🏗️ [Job ${jobId}] [3/10] Generating system design blueprint...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '🏗️ System Design', stepNumber: 3, progress: 30 });
        const systemDesign = await generateSystemDesign(textPlan);
        
        // Step 4: Skeleton
        console.log(`🦴 [Job ${jobId}] [4/10] Generating and validating code skeleton...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '🦴 Code Skeleton', stepNumber: 4, progress: 40 });
        const codeSkeleton = await generateCodeSkeleton(systemDesign);
        
        // Step 5: Code Gen
        console.log(`💻 [Job ${jobId}] [5/10] Generating initial code files...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '💻 Code Generation', stepNumber: 5, progress: 50 });
        const generatedFiles = await generateAllCode(codeSkeleton, systemDesign);
        
        // Step 6: Syntax
        console.log(`🔧 [Job ${jobId}] [6/10] Validating and fixing syntax errors...`);        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '🔧 Syntax Check', stepNumber: 6, progress: 60 });
        const syntaxCheckedFiles = await validateAndFixSyntax(generatedFiles);
        
        // Step 7: Typos
        console.log(`✏️ [Job ${jobId}] [7/10] Validating and fixing typos/naming...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '✏️ Typo Fix', stepNumber: 7, progress: 70 });
        const typoCheckedFiles = await validateAndFixTypos(syntaxCheckedFiles);
        
        // Step 8: Semicolons
        console.log(`🔚 [Job ${jobId}] [8/10] Validating and fixing semicolons...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '🔚 Semicolon Fix', stepNumber: 8, progress: 80 });
        const semicolonCheckedFiles = await validateAndFixSemicolons(typoCheckedFiles);
        
        // Step 9: Logic
        console.log(`🧠 [Job ${jobId}] [9/10] Validating and fixing logical errors...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '🧠 Logic Validation', stepNumber: 9, progress: 90 });
        const logicCheckedFiles = await validateAndFixLogic(semicolonCheckedFiles);
        
        // Step 10: Security
        console.log(`🔒 [Job ${jobId}] [10/10] Validating and fixing security flaws...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '🔒 Security Audit', stepNumber: 10, progress: 95 });
        const finalFiles = await validateAndFixSecurity(logicCheckedFiles);
        
        // Format Output
        let formattedOutput = "";
        for (const [filename, code] of Object.entries(finalFiles)) {
            formattedOutput += `--- ${filename} ---\n${code}\n\n`;
        }
        
        // Job Completed
        jobs.set(jobId, {
            status: 'completed',
            result: {
                success: true,
                data: { // FIXED: Explicit key 'data'
                    formattedOutput: formattedOutput,
                    files: finalFiles,
                    fileCount: Object.keys(finalFiles).length
                }
            },
            completedAt: Date.now()
        });
        
        console.log(`✅ [Job ${jobId}] Completed successfully!`);
        
        // Cleanup after 1 hour
        setTimeout(() => {
            if (jobs.has(jobId)) {
                jobs.delete(jobId);
                console.log(`🗑️ [Job ${jobId}] Cleaned up from memory`);            }
        }, 3600000);
        
    } catch (error) {
        console.error(`❌ [Job ${jobId}] Error:`, error.message);
        jobs.set(jobId, {
            status: 'failed',
            error: error.message,
            completedAt: Date.now()
        });
    }
}

const server = http.createServer(async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- SERVE STATIC FILES (FRONTEND) ---
    if (req.method === 'GET') {
        let filePath = req.url === '/' ? '/index.html' : req.url;
        
        // Security: Prevent directory traversal
        if (filePath.includes('..')) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        // Remove query strings if any
        filePath = filePath.split('?')[0];

        const fullPath = path.join(__dirname, filePath);
        
        // Check if file exists and serve it
        if (fs.existsSync(fullPath)) {
            const ext = path.extname(fullPath);
            let contentType = 'text/html';
            if (ext === '.js') contentType = 'application/javascript';
            if (ext === '.css') contentType = 'text/css';
            if (ext === '.json') contentType = 'application/json';
            if (ext === '.png') contentType = 'image/png';
            if (ext === '.jpg') contentType = 'image/jpeg';            
            res.writeHead(200, { 'Content-Type': contentType });
            const fileStream = fs.createReadStream(fullPath);
            fileStream.pipe(res);
            return;
        }
    }

    // --- API ROUTES ---

    // Start Job
    if (req.method === 'POST' && req.url === '/api/plan/start') {
        try {
            const requestData = await parseBody(req);
            
            if (!requestData || (!requestData.text && !requestData.context)) {
                return sendJSON(res, 400, {
                    success: false,
                    error: 'Bad Request',
                    message: 'Request body must contain "text" or "context"'
                });
            }
            
            const jobId = crypto.randomBytes(16).toString('hex');
            
            jobs.set(jobId, {
                status: 'queued',
                createdAt: Date.now(),
                requestData: requestData
            });
            
            // Process job asynchronously
            processJob(jobId, requestData);
            
            return sendJSON(res, 202, {
                success: true,
                jobId: jobId,
                status: 'queued',
                message: 'Job started successfully. Poll /api/plan/status/:jobId for updates.'
            });
            
        } catch (error) {
            console.error('Error starting job:', error);
            return sendJSON(res, 500, {
                success: false,
                error: 'Failed to start job',
                message: error.message
            });
        }
    }
    // Check Job Status
    if (req.method === 'GET' && req.url.startsWith('/api/plan/status/')) {
        const jobId = req.url.split('/').pop();
        const job = jobs.get(jobId);
        
        if (!job) {
            return sendJSON(res, 404, {
                success: false,
                error: 'Job not found',
                message: `No job found with ID: ${jobId}`
            });
        }
        
        if (job.status === 'completed') {
            return sendJSON(res, 200, {
                success: true,
                status: 'completed',
                result: job.result
            });
        } else if (job.status === 'failed') {
            return sendJSON(res, 200, {
                success: false,
                status: 'failed',
                error: job.error
            });
        } else if (job.status === 'needs_clarification') {
            return sendJSON(res, 200, {
                success: true,
                status: 'needs_clarification',
                data: job.data // FIXED: Explicit key 'data'
            });
        } else {
            return sendJSON(res, 200, {
                success: true,
                status: job.status,
                currentStep: job.currentStep || 'Initializing',
                stepNumber: job.stepNumber || 0,
                totalSteps: job.totalSteps || 10,
                progress: job.progress || 0,
                message: `Processing: ${job.currentStep || 'Starting...'} (Step ${job.stepNumber || 0}/10)`
            });
        }
    }

    // Health Check
    if (req.method === 'GET' && req.url === '/health') {
        return sendJSON(res, 200, { 
            status: 'OK', 
            service: 'Skyline AA-1 Server',            activeJobs: jobs.size,
            timestamp: new Date().toISOString()
        });
    }

    // 404 for anything else
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found.');
});

server.listen(PORT, () => {
    console.log(`\n🚀 SKYLINE AA-1 SERVER RUNNING!`);
    console.log(`   🌐 Localhost: http://localhost:${PORT}`);
    console.log(`   🧠 AI Model: OpenAI GPT-4o`);
    console.log(`   🏗️ Status: FULL STACK (Backend + Frontend)`);
    console.log(`   ☁️ Ready for Deployment: Render/Railway/Docker`);
    console.log(`   ⚡ Waiting for requests...\n`);
});
