"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAuthWorker = exports.publishAuthEvent = exports.authQueue = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = require("ioredis");
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
// Create a connection to Redis
const connection = new ioredis_1.Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
});
/**
 * Authentication Events Queue
 */
exports.authQueue = new bullmq_1.Queue("auth-events", { connection });
/**
 * Generic function to add events to the queue
 */
const publishAuthEvent = async (name, data) => {
    await exports.authQueue.add(name, data, {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000,
        },
    });
};
exports.publishAuthEvent = publishAuthEvent;
/**
 * Background Worker to process auth events
 * In a real-world scenario, this would be a separate microservice.
 */
const startAuthWorker = () => {
    const worker = new bullmq_1.Worker("auth-events", async (job) => {
        console.log(`[Worker] Processing job ${job.id} of type ${job.name}...`);
        switch (job.name) {
            case "USER_REGISTERED":
                console.log(`[Worker] Sending welcome email to ${job.data.email}...`);
                // Mock SMTP call
                await new Promise(res => setTimeout(res, 1000));
                console.log(`[Worker] Welcome email sent!`);
                break;
            case "SUSPICIOUS_LOGIN":
                console.log(`[Worker] ALERT: Suspicious login for ${job.data.email} from ${job.data.ip}`);
                // Mock Alerting (Email/Slack/SMS)
                await new Promise(res => setTimeout(res, 500));
                console.log(`[Worker] Alert notification sent!`);
                break;
            default:
                console.warn(`[Worker] Unknown job type: ${job.name}`);
        }
    }, { connection });
    worker.on("completed", job => {
        console.log(`[Worker] Job ${job.id} completed successfully.`);
    });
    worker.on("failed", (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
    });
    console.log("[Worker] Auth Event Worker started.");
};
exports.startAuthWorker = startAuthWorker;
