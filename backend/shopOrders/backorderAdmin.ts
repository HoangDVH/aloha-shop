import { randomUUID } from "node:crypto";
import type { Express } from "express";
import type { Db } from "mongodb";
import { z } from "zod";
import { requireAuth, requireActive, requireManager, type AuthRequest } from "../auth/middleware.js";
import { requireShopAuth, type ShopAuthRequest } from "../shopAuth/routes.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";
import { SHOP_ORDERS } from "./models.js";
import { applyCatalogPrices } from "./orderRouteShared.js";
import { releaseShopStockHolds } from "./stockHold.js";
import { assertStockAvailable } from "./stockApply.js";
import { serializeShopCheckout } from "./backorder.js";
import { markShopOrderPaid } from "./markPaid.js";
import { syncBus } from "../syncBus.js";

type GetDb = () => Promise<Db>;
const proposalSchema = z.object({ revision: z.number().int().nonnegative(), shippingFee: z.number().int().min(0).max(100000000),
  depositDue: z.number().int().min(1).max(1000000000), deliveryNote: z.string().trim().min(10).max(1000) });
const paymentSchema = z.object({ revision: z.number().int().nonnegative(), amount: z.number().int().positive(), reference: z.string().trim().min(6).max(160) });
const errorResponse = (res: any, error: any) => res.status(error.issues ? 400 : 503).json({ error: error.issues?.[0]?.message || "Chưa cập nhật được đơn. Vui lòng thử lại." });

export function registerBackorderAdminRoutes(app: Express, getDb: GetDb, getOpsDb: GetDb) {
  const gate = [requireAuth(getOpsDb), requireActive, requireManager];
  app.get("/api/shop/admin/backorders", ...gate, async (_req, res) => {
    try {
      const db = await getDb();
      const items = await db.collection(SHOP_ORDERS).find({ backorderStatus: { $exists: true }, orderStatus: { $ne: "huy" } })
        .sort({ createdAt: -1 }).limit(100).toArray();
      res.setHeader("Cache-Control", "private, no-store"); res.json({ items });
    } catch (error) { errorResponse(res, error); }
  });
  app.post("/api/shop/admin/backorders/:code/proposal", ...gate, async (req: AuthRequest, res) => {
    try {
      const body = proposalSchema.parse(req.body);
      const db = await getDb();
      const order = await db.collection(SHOP_ORDERS).findOne({ code: req.params.code });
      if (!order?.backorderStatus || order.orderStatus === "huy" || Number(order.paidAmount)>0 || ["ready", "confirmed_paid"].includes(order.backorderStatus)) return res.status(409).json({ error: "Không thể đổi báo giá đơn này. Đơn đã thu tiền cần đối soát riêng." });
      const buyer = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(order.shopAccountId));
      if (order.priceMode === "si" && (!buyer || buyer.siStatus !== "active")) return res.status(409).json({ error: "Quyền sỉ đã thay đổi. Cần trao đổi lại với khách, không tự đổi sang giá lẻ." });
      const priced = await applyCatalogPrices(db, order.orderDetails, { account: buyer });
      if (!priced.ok) return res.status(400).json({ error: priced.error });
      const subtotal = priced.details.reduce((sum,d)=>sum+d.price*d.quantity,0);
      const total = subtotal+body.shippingFee;
      if(body.depositDue>total) return res.status(400).json({error:"Khoản yêu cầu thanh toán không được vượt tổng đơn"});
      const now=new Date().toISOString();
      const proposal={ version: randomUUID(), subtotal,total,shippingFee:body.shippingFee,depositDue:body.depositDue,
        deliveryNote:body.deliveryNote,details:priced.details,createdAt:now,createdBy:req.auth!.userId };
      const result=await db.collection(SHOP_ORDERS).updateOne({ _id:order._id, revision:body.revision, backorderStatus:order.backorderStatus },{
        $set:{ proposal,backorderStatus:"awaiting_customer",updatedAt:now },$inc:{revision:1},
        $push:{ backorderAudit:{action:"proposal",actor:req.auth!.userId,at:now,version:proposal.version} } as any,
      });
      if(!result.modifiedCount)return res.status(409).json({error:"Đơn đã thay đổi. Vui lòng tải lại."});
      syncBus.publish(["shop_orders"],"backorder-proposal",{ids:[order.code]});res.json({ok:true});
    } catch(error){errorResponse(res,error);}
  });
  app.post("/api/shop/orders/me/:code/accept-proposal",requireShopAuth(getDb),async(req:ShopAuthRequest,res)=>{
    try{
      const db=await getDb();const order=await db.collection(SHOP_ORDERS).findOne({code:req.params.code,shopAccountId:req.shopAuth!.userId});
      if(!order?.proposal||order.proposal.version!==req.body.version||order.backorderStatus!=="awaiting_customer")return res.status(409).json({error:"Báo giá đã thay đổi hoặc không còn hiệu lực"});
      const proposal=order.proposal;const now=new Date().toISOString();
      const result=await db.collection(SHOP_ORDERS).updateOne({_id:order._id,revision:order.revision,backorderStatus:"awaiting_customer"},{$set:{
        backorderStatus:"awaiting_payment",orderStatus:"cho_thanh_toan",proposalAcceptedAt:now,proposalAcceptedVersion:proposal.version,
        orderDetails:proposal.details,subtotal:proposal.subtotal,total:proposal.total,shippingFee:proposal.shippingFee,shippingFeePending:false,
        totalPayment:proposal.total,depositDue:proposal.depositDue,statusValue:"Đã xác nhận — chờ hướng dẫn thanh toán / cọc",updatedAt:now,
      },$inc:{revision:1},$push:{backorderAudit:{action:"customer_accept",at:now,version:proposal.version}} as any});
      if(!result.modifiedCount)return res.sendStatus(409);
      syncBus.publish(["shop_orders"],"backorder-accepted",{ids:[order.code]});res.json({ok:true});
    }catch(error){errorResponse(res,error);}
  });
  app.post("/api/shop/admin/backorders/:code/payment",...gate,async(req:AuthRequest,res)=>{
    try{
      const body=paymentSchema.parse(req.body);const db=await getDb();
      const order=await db.collection(SHOP_ORDERS).findOne({code:req.params.code});
      if(!order||!["awaiting_payment","deposit_received"].includes(order.backorderStatus))return res.status(409).json({error:"Khách phải xác nhận báo giá trước khi ghi nhận thu tiền"});
      if(Number(order.paidAmount||0)+body.amount>Number(order.total))return res.status(400).json({error:"Số thu vượt số còn phải thanh toán. Cần đối soát riêng."});
      const now=new Date().toISOString();
      // Reference is unique across all orders, including concurrent recording by two admins.
      const receipts=db.collection<{_id:string;orderCode:string;amount:number;actor:string;at:string}>("aloha_shop_manual_receipts");
      const key=body.reference.toUpperCase();
      try { await receipts.insertOne({_id:key,orderCode:order.code,amount:body.amount,actor:req.auth!.userId,at:now}); }
      catch(error:any){if(error.code!==11000)throw error;const previous=await receipts.findOne({_id:key});if(!previous||previous.orderCode!==order.code||previous.amount!==body.amount)return res.status(409).json({error:"Mã giao dịch đã dùng cho khoản thu khác"});}
      const result=await db.collection(SHOP_ORDERS).updateOne({_id:order._id,revision:body.revision,"receipts.reference":{$ne:key}},{$inc:{paidAmount:body.amount,revision:1},$set:{backorderStatus:"deposit_received",paymentStatus:"deposit",updatedAt:now},$push:{receipts:{reference:key,amount:body.amount,actor:req.auth!.userId,at:now}} as any});
      if(!result.modifiedCount)return res.status(409).json({error:"Đơn đã thay đổi hoặc khoản thu đã ghi nhận. Tải lại trước khi thử lại cùng mã giao dịch."});
      syncBus.publish(["shop_orders"],"backorder-payment",{ids:[order.code]});res.json({ok:true});
    }catch(error){errorResponse(res,error);}
  });
  app.post("/api/shop/admin/backorders/:code/ready",...gate,serializeShopCheckout(getDb),async(req:AuthRequest,res)=>{
    try{
      const db=await getDb();const order=await db.collection(SHOP_ORDERS).findOne({code:req.params.code});
      if(!order||!["deposit_received","confirmed_paid"].includes(order.backorderStatus)||Number(order.paidAmount)<Number(order.total)||!order.proposalAcceptedAt)return res.status(409).json({error:"Cần khách xác nhận và thu đủ tiền trước khi hoàn tất chuẩn bị hàng"});
      if(order.priceMode==="si"&&!order.kvCustomerId) {
        const account = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(order.shopAccountId));
        if (!account?.kvCustomerId || account.siKvSyncStatus !== "synced") return res.status(409).json({error:"Cần liên kết KH KV trước khi hoàn tất"});
        await db.collection(SHOP_ORDERS).updateOne({_id:order._id,kvCustomerId:null},{$set:{kvCustomerId:account.kvCustomerId,kvRetailer:account.kvRetailer}});
      }
      const details=order.orderDetails.map((d:any)=>({...d,preOrder:false,pendingQty:0,availableQty:d.quantity}));
      const stock=await assertStockAvailable(await getOpsDb(),details,db,{excludeOrderId:order.code});
      if(!stock.ok)return res.status(409).json({error:stock.error});
      const claimed=await db.collection(SHOP_ORDERS).updateOne({_id:order._id,revision:Number(req.body.revision)},{$set:{backorderStatus:"confirmed_paid",orderDetails:details,paymentStatus:"unpaid",method:"Transfer",totalPayment:order.total},$inc:{revision:1}});
      if(!claimed.modifiedCount)return res.status(409).json({error:"Đơn đã thay đổi. Vui lòng tải lại."});
      const paid=await markShopOrderPaid({shopDb:db,mainDb:await getOpsDb(),orderCode:order.code,source:"admin",confirmedBy:req.auth!.userId});
      if(!paid.ok)return res.status(409).json({error:paid.error});
      await db.collection(SHOP_ORDERS).updateOne({_id:order._id},{$set:{backorderStatus:"ready",statusValue:"Đã thanh toán — chờ giao hàng"}});
      res.json({ok:true});
    }catch(error){errorResponse(res,error);}
  });
  app.post("/api/shop/admin/backorders/:code/cancel",...gate,async(req:AuthRequest,res)=>{
    try{
      const db=await getDb();const reason=String(req.body.reason||"").trim().slice(0,1000);
      if(!reason)return res.status(400).json({error:"Nhập lý do hủy"});
      const order=await db.collection(SHOP_ORDERS).findOne({code:req.params.code});
      if(!order?.backorderStatus || ["ready", "confirmed_paid", "cancelled"].includes(order.backorderStatus)) return res.status(409).json({error:"Đơn đã giao xử lý hoặc đã hủy. Cần xử lý theo luồng trả hàng."});
      const paidAmount = Number(order.paidAmount || 0);
      const refundReference = String(req.body.refundReference || "").trim().toUpperCase();
      const now = new Date().toISOString();
      if (paidAmount > 0) {
        if (req.body.refundConfirmed !== true || refundReference.length < 6 || refundReference.length > 160) return res.status(409).json({error:"Cần xác nhận đã hoàn toàn bộ tiền thực thu và nhập mã chứng từ hoàn tiền."});
        const receipts = db.collection<{ _id: string; orderCode: string; amount: number }>("aloha_shop_manual_receipts");
        try { await receipts.insertOne({ _id: refundReference, orderCode: order.code, amount: -paidAmount }); }
        catch (error: any) { if (error.code !== 11000) throw error; const previous = await receipts.findOne({ _id: refundReference }); if (!previous || previous.orderCode !== order.code || previous.amount !== -paidAmount) return res.status(409).json({error:"Chứng từ hoàn tiền đã dùng cho khoản khác"}); }
      }
      const result=await db.collection(SHOP_ORDERS).updateOne({_id:order._id,revision:Number(req.body.revision),backorderStatus:order.backorderStatus},{$set:{orderStatus:"huy",paymentStatus:paidAmount > 0 ? "refunded" : "cancelled",backorderStatus:"cancelled",statusValue:"Đã hủy",cancelReason:reason,updatedAt:now,
        ...(paidAmount > 0 ? { refundedAmount: paidAmount, refundReference, refundedAt: now, refundedBy: req.auth!.userId } : {}) },$inc:{revision:1},$push:{backorderAudit:{action:"cancel",actor:req.auth!.userId,at:now,reason,refundedAmount:paidAmount,refundReference}} as any});
      if(!result.modifiedCount)return res.sendStatus(409);
      await releaseShopStockHolds(db,order.code);syncBus.publish(["shop_orders"],"backorder-cancel",{ids:[order.code]});res.json({ok:true});
    }catch(error){errorResponse(res,error);}
  });
}
