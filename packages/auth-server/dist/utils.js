"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomHex = randomHex;
exports.sha256hex = sha256hex;
const crypto_1 = __importDefault(require("crypto"));
function randomHex(len = 32) {
    return crypto_1.default.randomBytes(len).toString("hex");
}
function sha256hex(str) {
    return crypto_1.default.createHash("sha256").update(str).digest("hex");
}
