"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authFailureTotal = exports.authSuccessTotal = exports.httpRequestsTotal = exports.register = void 0;
const prom_client_1 = __importDefault(require("prom-client"));
// Create a Registry which registers the metrics
exports.register = new prom_client_1.default.Registry();
// Add a default label which is added to all metrics
exports.register.setDefaultLabels({
    app: "auth-flow-server"
});
// Enable the collection of default metrics
prom_client_1.default.collectDefaultMetrics({ register: exports.register });
// Define custom metrics
exports.httpRequestsTotal = new prom_client_1.default.Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
});
exports.authSuccessTotal = new prom_client_1.default.Counter({
    name: "auth_success_total",
    help: "Total number of successful authentications",
});
exports.authFailureTotal = new prom_client_1.default.Counter({
    name: "auth_failure_total",
    help: "Total number of failed authentications",
});
exports.register.registerMetric(exports.httpRequestsTotal);
exports.register.registerMetric(exports.authSuccessTotal);
exports.register.registerMetric(exports.authFailureTotal);
