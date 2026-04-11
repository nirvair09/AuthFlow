import User, { IUser } from "../models/user.model";

export class UserRepository {
    async findByEmail(email: string): Promise<IUser | null> {
        return User.findOne({ email });
    }

    async findById(id: string): Promise<IUser | null> {
        return User.findById(id);
    }

    async create(userData: any): Promise<IUser> {
        return User.create(userData);
    }

    async update(id: string, updateData: any): Promise<IUser | null> {
        return User.findByIdAndUpdate(id, updateData, { new: true });
    }
}
