import mongoose from "mongoose";

export interface IUser extends mongoose.Document {
    email:string;
    password:string;
    name:string;
    createdAt:Date;
    updatedAt:Date;
    isVerified:boolean;
    metadata?:Record<string,any>;
}

const userSchema = new mongoose.Schema<IUser>({
    email:{type:String,required:true,unique:true},
    password:{type:String,required:true},
    name:{type:String,required:true},
    createdAt:{type:Date,default:Date.now},
    updatedAt:{type:Date,default:Date.now},
    isVerified:{type:Boolean,default:false},
    metadata:{type:mongoose.Schema.Types.Mixed}
},{timestamps:true});

export default mongoose.model<IUser>("User",userSchema);