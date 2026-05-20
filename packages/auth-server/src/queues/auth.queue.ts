import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import RedisMock from "ioredis-mock";
import dotenv from "dotenv";

dotenv.config();



const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Create a connection to Redis
const connection = process.env.USE_REDIS_MOCK === "true"
    ? new RedisMock() as any
    : new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
    });


/**
 * Authentication Events Queue
 */
export const authQueue = new Queue("auth-events", { connection });

/**
 * Generic function to add events to the queue
 */
export const publishAuthEvent = async (name: string, data: any) => {
    await authQueue.add(name, data, {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000,
        },
    });
};

/**
 * Background Worker to process auth events
 * In a real-world scenario, this would be a separate microservice.
 */
export const startAuthWorker = () => {
    const worker = new Worker("auth-events", async (job: Job) => {
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
