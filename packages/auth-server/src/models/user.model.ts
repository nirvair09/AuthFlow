import mongoose from "mongoose";

export interface IUser extends mongoose.Document {
    email:string;
    password:string;
    name:string;
    createdAt:Date;
    updatedAt:Date;
    isVerified:boolean;
    metadata?:Record<string,any>;
    knownDevices: Array<{ ip: string; userAgent: string; lastUsed: Date }>;
    failedLoginAttempts: number;
    lockUntil?: Date;
}

const userSchema = new mongoose.Schema<IUser>({
    email:{type:String,required:true,unique:true},
    password:{type:String,required:true},
    name:{type:String,required:true},
    createdAt:{type:Date,default:Date.now},
    updatedAt:{type:Date,default:Date.now},
    isVerified:{type:Boolean,default:false},
    metadata:{type:mongoose.Schema.Types.Mixed},
    knownDevices: [{
        ip: String,
        userAgent: String,
        lastUsed: { type: Date, default: Date.now }
    }],
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date }
},{timestamps:true});

export default mongoose.model<IUser>("User",userSchema);