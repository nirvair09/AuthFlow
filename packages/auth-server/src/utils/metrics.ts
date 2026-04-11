import client from "prom-client";

// Create a Registry which registers the metrics
export const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
    app: "auth-flow-server"
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Define custom metrics
export const httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
});

export const authSuccessTotal = new client.Counter({
    name: "auth_success_total",
    help: "Total number of successful authentications",
});

export const authFailureTotal = new client.Counter({
    name: "auth_failure_total",
    help: "Total number of failed authentications",
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(authSuccessTotal);
register.registerMetric(authFailureTotal);
