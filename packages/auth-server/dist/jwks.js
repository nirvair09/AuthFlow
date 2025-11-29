"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateJWKPair = void 0;
const jose_1 = require("jose");
const jose_2 = require("jose");
const crypto_1 = __importDefault(require("crypto"));
const generateJWKPair = async () => {
    const { publicKey, privateKey } = await (0, jose_1.generateKeyPair)("RS256", {
        modulusLength: 2048,
    });
    const kid = crypto_1.default.randomUUID();
    const publicKeyJWK = await (0, jose_2.exportJWK)(publicKey);
    const privateKeyJWK = await (0, jose_2.exportJWK)(privateKey);
    return {
        kid,
        publicKey: publicKeyJWK,
        privateKey: privateKeyJWK
    };
};
exports.generateJWKPair = generateJWKPair;
