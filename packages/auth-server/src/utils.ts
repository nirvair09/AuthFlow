import crypto from "crypto";

export function randomHex(len=32){
    return crypto.randomBytes(len).toString("hex");
}

export function sha256hex(str:string){
    return crypto.createHash("sha256").update(str).digest("hex");
}