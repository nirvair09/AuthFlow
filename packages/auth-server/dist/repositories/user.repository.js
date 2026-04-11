"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const user_model_1 = __importDefault(require("../models/user.model"));
class UserRepository {
    async findByEmail(email) {
        return user_model_1.default.findOne({ email });
    }
    async findById(id) {
        return user_model_1.default.findById(id);
    }
    async create(userData) {
        return user_model_1.default.create(userData);
    }
    async update(id, updateData) {
        return user_model_1.default.findByIdAndUpdate(id, updateData, { new: true });
    }
}
exports.UserRepository = UserRepository;
