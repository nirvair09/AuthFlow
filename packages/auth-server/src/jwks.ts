import {generateKeyPair} from "jose";
import {exportJWK} from "jose";

export type JWKPair = {
    kid:string;
    publicKey:any;
    privateKey:any;
}

export const generateJWKPair = async ():Promise<JWKPair> =>{
    const {publicKey,privateKey}=await generateKeyPair("RS256",{
        modulusLength:2048,
    });
    const kid = crypto.randomUUID();
    const publicKeyJWK = await exportJWK(publicKey);
    const privateKeyJWK = await exportJWK(privateKey);
    return {
        kid,
        publicKey:publicKeyJWK,
        privateKey:privateKeyJWK};
};