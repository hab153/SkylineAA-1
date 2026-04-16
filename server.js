// server.js
// Skyline AA-1 Project - Production Ready Server
// Handles incoming HTTP requests and orchestrates the full generation pipeline.

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config(); // Load environment variables

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

const app = express();
// Use PORT from environment (Render sets this) or default to 5001 for local
const PORT = process.env.PORT || 5001;

// Job storage (In production, use Redis or a Database)
const jobs = new Map();

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

app.use(express.json({ limit: '10mb' })); // Increase limit for large code outputs
app.use(express.urlencoded({ extended: true }));

// Async job processor
async function processJob(jobId, requestData) {
    try {
        console.log(`🚀 [Job ${jobId}] Starting processing...`);
        
        // Update job status
        jobs.set(jobId, { 
            ...jobs.get(jobId),
            currentStep: '📋 Planning',
            stepNumber: 1,            totalSteps: 10,
            progress: 10
        });
        
        // Step 1: Get Structured JSON Plan from plan.js
        console.log(`📋 [Job ${jobId}] [1/10] Generating structured JSON plan...`);
        const planResult = await handlePlanRequest(requestData);
        
        // Handle clarification requests
        if (planResult.data && planResult.data.status === 'needs_clarification') {
            jobs.set(jobId, {
                status: 'needs_clarification',
                 planResult.data,
                completedAt: Date.now()
            });
            return;
        }

        // Step 2: Convert to Plain Text Steps
        console.log(`📝 [Job ${jobId}] [2/10] Generating plain text steps...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '📝 Text Generation', stepNumber: 2, progress: 20 });
        const textPlan = await generateTextPlan(planResult.data);
        
        // Step 3: Generate System Design
        console.log(`🏗️ [Job ${jobId}] [3/10] Generating system design blueprint...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '🏗️ System Design', stepNumber: 3, progress: 30 });
        const systemDesign = await generateSystemDesign(textPlan);
        
        // Step 4: Generate Code Skeleton
        console.log(`🦴 [Job ${jobId}] [4/10] Generating and validating code skeleton...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '🦴 Code Skeleton', stepNumber: 4, progress: 40 });
        const codeSkeleton = await generateCodeSkeleton(systemDesign);
        
        // Step 5: Generate Initial Code
        console.log(`💻 [Job ${jobId}] [5/10] Generating initial code files...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '💻 Code Generation', stepNumber: 5, progress: 50 });
        const generatedFiles = await generateAllCode(codeSkeleton, systemDesign);
        
        // Step 6: Validate and Fix Syntax
        console.log(`🔧 [Job ${jobId}] [6/10] Validating and fixing syntax errors...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '🔧 Syntax Check', stepNumber: 6, progress: 60 });
        const syntaxCheckedFiles = await validateAndFixSyntax(generatedFiles);
        
        // Step 7: Validate and Fix Typos
        console.log(`✏️ [Job ${jobId}] [7/10] Validating and fixing typos/naming...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '✏️ Typo Fix', stepNumber: 7, progress: 70 });
        const typoCheckedFiles = await validateAndFixTypos(syntaxCheckedFiles);
        
        // Step 8: Validate and Fix Semicolons
        console.log(`🔚 [Job ${jobId}] [8/10] Validating and fixing semicolons...`);        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '🔚 Semicolon Fix', stepNumber: 8, progress: 80 });
        const semicolonCheckedFiles = await validateAndFixSemicolons(typoCheckedFiles);
        
        // Step 9: Validate and Fix Logic
        console.log(`🧠 [Job ${jobId}] [9/10] Validating and fixing logical errors...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '🧠 Logic Validation', stepNumber: 9, progress: 90 });
        const logicCheckedFiles = await validateAndFixLogic(semicolonCheckedFiles);
        
        // Step 10: Validate and Fix Security
        console.log(`🔒 [Job ${jobId}] [10/10] Validating and fixing security flaws...`);
        jobs.set(jobId, { ...jobs.get(jobId), currentStep: '🔒 Security Audit', stepNumber: 10, progress: 95 });
        const finalFiles = await validateAndFixSecurity(logicCheckedFiles);
        
        // Format for Frontend
        let formattedOutput = "";
        for (const [filename, code] of Object.entries(finalFiles)) {
            formattedOutput += `--- ${filename} ---\n${code}\n\n`;
        }
        
        // Job completed successfully
        jobs.set(jobId, {
            status: 'completed',
            result: {
                success: true,
                 {
                    formattedOutput: formattedOutput,
                    files: finalFiles,
                    fileCount: Object.keys(finalFiles).length
                }
            },
            completedAt: Date.now()
        });
        
        console.log(`✅ [Job ${jobId}] Completed successfully!`);
        
        // Clean up old jobs after 1 hour
        setTimeout(() => {
            if (jobs.has(jobId)) {
                jobs.delete(jobId);
                console.log(`🗑️ [Job ${jobId}] Cleaned up from memory`);
            }
        }, 3600000);
        
    } catch (error) {
        console.error(`❌ [Job ${jobId}] Error:`, error.message);
        jobs.set(jobId, {
            status: 'failed',
            error: error.message,
            completedAt: Date.now()
        });    }
}

// ENDPOINT: Start a job (non-blocking)
app.post('/api/plan/start', async (req, res) => {
    try {
        const requestData = req.body;
        
        if (!requestData || (!requestData.text && !requestData.context)) {
            return res.status(400).json({
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
        
        res.status(202).json({
            success: true,
            jobId: jobId,
            status: 'queued',
            message: 'Job started successfully. Poll /api/plan/status/:jobId for updates.'
        });
        
    } catch (error) {
        console.error('Error starting job:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start job',
            message: error.message
        });
    }
});

// ENDPOINT: Check job status
app.get('/api/plan/status/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);
    
    if (!job) {        return res.status(404).json({
            success: false,
            error: 'Job not found',
            message: `No job found with ID: ${jobId}`
        });
    }
    
    if (job.status === 'completed') {
        return res.json({
            success: true,
            status: 'completed',
            result: job.result
        });
    } else if (job.status === 'failed') {
        return res.json({
            success: false,
            status: 'failed',
            error: job.error
        });
    } else if (job.status === 'needs_clarification') {
        return res.json({
            success: true,
            status: 'needs_clarification',
             job.data
        });
    } else {
        return res.json({
            success: true,
            status: job.status,
            currentStep: job.currentStep || 'Initializing',
            stepNumber: job.stepNumber || 0,
            totalSteps: job.totalSteps || 10,
            progress: job.progress || 0,
            message: `Processing: ${job.currentStep || 'Starting...'} (Step ${job.stepNumber || 0}/10)`
        });
    }
});

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        service: 'Skyline AA-1 Server',
        activeJobs: jobs.size,
        timestamp: new Date().toISOString()
    });
});

// Root Endpoint
app.get('/', (req, res) => {    res.status(200).json({ 
        message: 'Skyline AA-1 Server is running', 
        endpoints: {
            startJob: 'POST /api/plan/start',
            checkStatus: 'GET /api/plan/status/:jobId',
            health: 'GET /health'
        },
        workflow: 'plan → text → design → skeleton → code → syntax → Typos → semicolons → logic → security'
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.url}`
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`✅ Skyline AA-1 server running on port ${PORT}`);
    console.log(`📍 Start Job: POST /api/plan/start`);
    console.log(`📍 Check Status: GET /api/plan/status/:jobId`);
    console.log(`🏥 Health Check: GET /health`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
});

module.exports = app;