import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Express } from "express";
import type { Db } from "mongodb";
import { SHOP_ACCOUNTS, SHOP_REFRESH, shopAccountIdQuery } from "../shopAuth/models.js";
import { requireAuth, requireActive, requireManager, type AuthRequest } from "../auth/middleware.js";
import { isAllowedShopOrigin } from "../shopCors.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import { clearShopAuthCookies } from "../shopAuth/tokens.js";
import { SI_TERMS_VERSION, normalizeWholesalePhone } from "./policy.js";
const TOKENS="aloha_shop_password_tokens";
const digest=(v:string)=>crypto.createHash("sha256").update(v).digest("hex");
const origin=()=>String(process.env.SHOP_PUBLIC_URL||process.env.NEXT_PUBLIC_SHOP_ORIGIN||"https://alohathegioichaucay.com").replace(/\/$/,"");

async function makeToken(db:Db,accountId:string,kind="reset"){
  const token=crypto.randomBytes(32).toString("hex");
  await db.collection(TOKENS).createIndex({expiresAt:1},{expireAfterSeconds:0});
  await db.collection(TOKENS).insertOne({hash:digest(token),accountId,kind,expiresAt:new Date(Date.now()+30*60000),createdAt:new Date()});
  return `${origin()}/dat-mat-khau?token=${token}`;
}
export function registerWholesalePasswordRoutes(app:Express,getDb:()=>Promise<Db>,getOpsDb:()=>Promise<Db>){
  app.use("/api/shop/auth/password",(req,res,next)=>{
    res.setHeader("Cache-Control","no-store");
    if(req.headers.origin&&!isAllowedShopOrigin(req.headers.origin))return res.sendStatus(403);
    if(!shopRateLimitOrReject(req,res,"shop_password",5,60000))return;
    next();
  });
  app.post("/api/shop/auth/password/forgot",async(req,res)=>{
    const generic={ok:true,message:"Nếu email có tài khoản, Aloha sẽ gửi hướng dẫn khôi phục. Nếu chưa nhận được, vui lòng liên hệ hỗ trợ."};
    try{
      const parsed=z.string().email().safeParse(String(req.body.email||"").trim().toLowerCase());
      if(!parsed.success)return res.json(generic);
      const db=await getDb();const account=await db.collection(SHOP_ACCOUNTS).findOne({email:parsed.data,active:{$ne:false}});
      if(account&&process.env.SHOP_MAIL_ENABLED==="1"&&process.env.RESEND_API_KEY&&process.env.SHOP_MAIL_FROM){
        const url=await makeToken(db,String(account._id));
        await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},
          body:JSON.stringify({from:process.env.SHOP_MAIL_FROM,to:[account.email],subject:"ALOHA — Đặt lại mật khẩu",text:`Mở liên kết để đặt lại mật khẩu (hiệu lực 30 phút): ${url}\nNếu bạn không yêu cầu, hãy bỏ qua email này.`}),signal:AbortSignal.timeout(10000)});
      }
      res.json(generic);
    }catch{res.json(generic);}
  });
  app.post("/api/shop/auth/password/reset",async(req,res)=>{
    try{
      const body=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password:z.string().min(8).max(128),acceptedTerms:z.boolean().optional()}).parse(req.body);
      const db=await getDb();
      const record=await db.collection(TOKENS).findOne({hash:digest(body.token),expiresAt:{$gt:new Date()}});
      if(!record)return res.status(400).json({error:"Liên kết đã hết hạn hoặc đã được sử dụng"});
      if(record.kind==="invite"&&body.acceptedTerms!==true)return res.status(400).json({error:"Vui lòng đồng ý điều khoản mua sỉ"});
      const passwordHash=await bcrypt.hash(body.password,12);
      const consumed=await db.collection(TOKENS).findOneAndDelete({_id:record._id,expiresAt:{$gt:new Date()}});
      if(!consumed)return res.status(409).json({error:"Liên kết đã được sử dụng"});
      const patch:Record<string,unknown>={passwordHash,authInvalidBefore:Math.floor(Date.now()/1000)+1};
      if(record.kind==="invite"){patch["siProfile.acceptedTermsAt"]=new Date().toISOString();patch["siProfile.termsVersion"]=SI_TERMS_VERSION;}
      await db.collection(SHOP_ACCOUNTS).updateOne(shopAccountIdQuery(record.accountId),{$set:patch});
      await db.collection(SHOP_REFRESH).updateMany({userId:record.accountId},{$set:{revokedAt:new Date()}});
      await db.collection(TOKENS).deleteMany({accountId:record.accountId});
      clearShopAuthCookies(res);res.json({ok:true});
    }catch(error:any){res.status(400).json({error:error.issues?.[0]?.message||"Chưa đổi được mật khẩu. Vui lòng yêu cầu liên kết mới."});}
  });
  app.post("/api/shop/admin/si/invite",requireAuth(getOpsDb),requireActive,requireManager,async(req:AuthRequest,res)=>{
    try{
      const body=z.object({email:z.string().trim().email(),fullName:z.string().trim().min(2).max(120),phone:z.string().transform(normalizeWholesalePhone).pipe(z.string().regex(/^0[35789]\d{8}$/))}).parse(req.body);
      const db=await getDb();const existing=await db.collection(SHOP_ACCOUNTS).findOne({$or:[{email:body.email.toLowerCase()},{phone:body.phone},{phoneNorm:body.phone}]});
      if(existing)return res.status(409).json({error:"Email/SĐT đã có tài khoản. Khách cần đăng nhập hoặc dùng quên mật khẩu; không tạo tài khoản thứ hai."});
      await db.collection(SHOP_ACCOUNTS).createIndex({phoneNorm:1},{unique:true,partialFilterExpression:{siIdentity:true,phoneNorm:{$type:"string"}}});
      const now=new Date().toISOString();
      const inserted=await db.collection(SHOP_ACCOUNTS).insertOne({...body,email:body.email.toLowerCase(),phoneNorm:body.phone,siIdentity:true,roles:["customer","si"],siStatus:"cho_duyet",active:true,applicationRevision:1,
        siProfile:{fullName:body.fullName,phone:body.phone},createdAt:now,updatedAt:now,siAudit:[{id:crypto.randomUUID(),action:"invite",actorAdminId:req.auth!.userId,at:now}]});
      res.json({ok:true,url:await makeToken(db,String(inserted.insertedId),"invite")});
    }catch(error:any){res.status(error.code===11000?409:400).json({error:error.issues?.[0]?.message||"Không tạo được lời mời. Kiểm tra tài khoản trùng."});}
  });
}
