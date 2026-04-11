"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const user_repository_1 = require("../repositories/user.repository");
const argon2_1 = __importDefault(require("argon2"));
const auth_queue_1 = require("../queues/auth.queue");
class AuthService {
    constructor() {
        this.userRepository = new user_repository_1.UserRepository();
    }
    async register(data) {
        const { email, password, name, metadata } = data;
        const existingUser = await this.userRepository.findByEmail(email);
        if (existingUser)
            throw new Error("User already exists");
        const passwordHash = await argon2_1.default.hash(password);
        const user = await this.userRepository.create({
            email,
            name,
            password: passwordHash,
            metadata
        });
        await (0, auth_queue_1.publishAuthEvent)("USER_REGISTERED", {
            userId: user._id,
            email: user.email,
            name: user.name
        });
        return user;
    }
}
exports.AuthService = AuthService;
