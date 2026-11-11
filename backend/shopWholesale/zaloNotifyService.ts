import * as zcaModule from "zca-js";
import fs from "fs";
import path from "path";
import CryptoJS from "crypto-js";
import { isPickupDelivery } from "../../shared/opsContracts.js";

const zca = (zcaModule as any).default || zcaModule;
const { Zalo, LoginQRCallbackEventType } = zca;

function encodeAES(secretKey: string, data: string): string {
  const key = CryptoJS.enc.Base64.parse(secretKey);
  return CryptoJS.AES.encrypt(data, key, {
    iv: CryptoJS.enc.Hex.parse("00000000000000000000000000000000"),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).ciphertext.toString(CryptoJS.enc.Base64);
}

export const NOTIFY_PHONE_TARGET = "0337095980";
const SESSION_FILE = typeof __dirname !== "undefined"
  ? path.resolve(__dirname, "zalo_session_0337095980.json")
  : path.resolve(process.cwd(), "backend/shopWholesale/zalo_session_0337095980.json");

interface SavedZaloCredentials {
  cookie: unknown;
  imei: string;
  userAgent: string;
  language?: string;
  uid?: string;
  groupId?: string;
  groupName?: string;
  savedAt?: string;
}

export interface WholesaleNotifyData {
  fullName: string;
  phone: string;
  region?: string;
  shopName?: string;
  businessType?: string;
  address?: string;
  note?: string;
  registeredAt?: string | Date;
}

export interface NewOrderNotifyData {
  orderCode: string;
  customerName: string;
  phone: string;
  address?: string;
  deliveryMethod?: string;
  paymentMethod?: string;
  total: number;
  shippingFee?: number;
  discount?: number;
  items?: Array<{
    name: string;
    quantity: number;
    price?: number;
    variant?: string;
  }>;
  customerNote?: string;
  createdAt?: string | Date;
}

export interface CollaboratorNotifyData {
  fullName: string;
  phone: string;
  email?: string;
  ctvCode?: string;
  referralChannel?: string;
  channelUrl?: string;
  businessExperience?: string;
  address?: string;
  note?: string;
  registeredAt?: string | Date;
  type?: "new_account" | "upgrade_account";
}

export interface RecruitmentNotifyData {
  fullName: string;
  phone: string;
  email?: string;
  position: string;
  submissionType?: string;
  location?: string;
  experienceLevel?: string;
  experienceSummary?: string;
  cvFileName?: string;
  publicCode: string;
  appliedAt?: string | Date;
}

export type ZaloNotificationType = "wholesale" | "order" | "ctv" | "recruitment";

class ZaloNotifyService {
  private api: any = null;
  private ownUid: string = "";
  private isAuthenticating: boolean = false;
  private currentQrDataUrl: string = "";
  private statusText: string = "chua_ket_noi"; // chua_ket_noi | dang_tao_qr | cho_quet | da_quet_cho_xac_nhan | da_ket_noi | loi
  private targetGroupId: string = "3714868686368863924";
  private targetGroupName: string = "Aloha - Thông Báo Sỉ";
  private savedAt: string | null = null;
  private lastExpiryAlertDate: string = "";

  constructor() {
    if (process.env.NODE_ENV === "test") return;

    this.restoreSession().catch((err) => {
      console.log("[ZaloNotifyService] No saved session or restore failed:", err?.message || err);
    });

    // Định kỳ mỗi 6 giờ kiểm tra xem phiên có sắp hết hạn không để cảnh báo trước 48h
    const timer = setInterval(() => {
      this.checkExpiryAndAlert().catch(() => {});
    }, 1000 * 60 * 60 * 6);
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  }

  public getStatus() {
    const savedTime = this.savedAt ? new Date(this.savedAt).getTime() : 0;
    const now = Date.now();
    const daysActive = savedTime ? Math.floor((now - savedTime) / (1000 * 60 * 60 * 24)) : 0;
    const estimatedLifespanDays = 21; // Phiên cookie Zalo cá nhân thường duy trì ~20-30 ngày
    const daysRemaining = savedTime ? Math.max(0, estimatedLifespanDays - daysActive) : 0;
    const isConnected = Boolean(this.api) && this.statusText === "da_ket_noi";
    const isExpiringSoon = isConnected && daysRemaining <= 3;

    return {
      targetPhone: NOTIFY_PHONE_TARGET,
      connected: isConnected,
      ownUid: this.ownUid,
      targetGroupId: this.targetGroupId,
      targetGroupName: this.targetGroupName,
      status: this.statusText,
      hasQr: Boolean(this.currentQrDataUrl),
      qrImage: this.currentQrDataUrl,
      savedAt: this.savedAt,
      daysActive,
      daysRemaining,
      isExpiringSoon,
    };
  }

  public async checkExpiryAndAlert(): Promise<void> {
    if (!this.api || this.statusText !== "da_ket_noi" || !this.savedAt) return;
    const st = this.getStatus();
    if (st.isExpiringSoon && st.daysRemaining <= 2) {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (this.lastExpiryAlertDate === todayStr) return;
      this.lastExpiryAlertDate = todayStr;
      const text = [
        "⚠️ [HỆ THỐNG ALOHA] CẢNH BÁO PHIÊN ZALO SẮP HẾT HẠN!",
        `⏰ Phiên đăng nhập Zalo thông báo còn khoảng ${st.daysRemaining} ngày hiệu lực.`,
        "👉 Quản trị viên vui lòng vào trang Quản trị Aloha để quét mã QR gia hạn, tránh bị gián đoạn nhận thông báo đơn hàng & CTV mới.",
        `🔗 Link gia hạn nhanh: https://alohathegioichaucay.com/admin/ctv/khach-hang`,
      ].join("\n");
      const gid = await this.ensureGroup();
      await this.sendToGroup(gid, text, "Alert:ZaloExpiry").catch((e) =>
        console.error("[ZaloNotifyService] Failed to send expiry alert:", e)
      );
    }
  }

  private async ensureGroup(): Promise<string> {
    if (this.targetGroupId) {
      return this.targetGroupId;
    }
    try {
      let staffUid = "1445028291662827828";
      if (this.api && typeof this.api.findUser === "function") {
        const u = await this.api.findUser("0794901233").catch(() => null);
        if (u?.uid) staffUid = String(u.uid);
      }
      const created = await this.api.createGroup({
        name: "Aloha - Thông Báo Sỉ",
        members: [staffUid],
      });
      if (created?.groupId) {
        this.targetGroupId = String(created.groupId);
        this.targetGroupName = "Aloha - Thông Báo Sỉ";
        if (fs.existsSync(SESSION_FILE)) {
          try {
            const creds = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
            creds.groupId = this.targetGroupId;
            creds.groupName = this.targetGroupName;
            fs.writeFileSync(SESSION_FILE, JSON.stringify(creds, null, 2), "utf8");
          } catch {}
        }
      }
    } catch (e: any) {
      console.error("[ZaloNotifyService] ensureGroup error:", e?.message || e);
    }
    return this.targetGroupId;
  }

  public async getGroupIdForType(type: ZaloNotificationType): Promise<string> {
    if (type === "order" && process.env.ZALO_ORDER_GROUP_ID) return process.env.ZALO_ORDER_GROUP_ID;
    if (type === "ctv" && process.env.ZALO_CTV_GROUP_ID) return process.env.ZALO_CTV_GROUP_ID;
    if (type === "recruitment" && process.env.ZALO_RECRUITMENT_GROUP_ID) return process.env.ZALO_RECRUITMENT_GROUP_ID;
    if (type === "wholesale" && process.env.ZALO_WHOLESALE_GROUP_ID) return process.env.ZALO_WHOLESALE_GROUP_ID;
    if (process.env.ZALO_NOTIFY_GROUP_ID) return process.env.ZALO_NOTIFY_GROUP_ID;
    return this.ensureGroup();
  }

  public async restoreSession(): Promise<boolean> {
    if (!fs.existsSync(SESSION_FILE)) {
      this.statusText = "chua_ket_noi";
      return false;
    }

    try {
      const raw = fs.readFileSync(SESSION_FILE, "utf8");
      const creds: SavedZaloCredentials = JSON.parse(raw);
      if (!creds.cookie || !creds.imei) {
        return false;
      }

      const zalo = new Zalo({ logging: false });
      const api = await zalo.login({
        cookie: creds.cookie,
        imei: creds.imei,
        userAgent: creds.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        language: creds.language || "vi",
      });

      this.api = api;
      this.savedAt = creds.savedAt || null;
      const uid = typeof api.getOwnId === "function" ? api.getOwnId() : creds.uid || "";
      this.ownUid = String(uid);
      if (creds.groupId) {
        this.targetGroupId = String(creds.groupId);
      }
      if (creds.groupName) {
        this.targetGroupName = String(creds.groupName);
      }
      this.statusText = "da_ket_noi";
      console.log(`[ZaloNotifyService] Restored Zalo session for ${NOTIFY_PHONE_TARGET} (UID: ${this.ownUid}, Group: ${this.targetGroupName} - ${this.targetGroupId})`);
      return true;
    } catch (err: any) {
      console.error("[ZaloNotifyService] Session restore failed:", err?.message || err);
      this.api = null;
      this.statusText = "chua_ket_noi";
      return false;
    }
  }

  public async generateQR(force = false): Promise<string> {
    if (this.api && this.statusText === "da_ket_noi" && !force) {
      return this.currentQrDataUrl;
    }

    if (this.isAuthenticating) {
      return this.currentQrDataUrl;
    }

    this.isAuthenticating = true;
    this.statusText = "dang_tao_qr";

    try {
      const zalo = new Zalo({ logging: false });
      zalo.loginQR(
        {
          qrPath: path.resolve(__dirname, "temp_qr.png"),
        },
        (event: any) => {
          if (event.type === LoginQRCallbackEventType.QRCodeGenerated) {
            const rawBase64 = event.data.image.replace(/^data:image\/png;base64,/, "");
            this.currentQrDataUrl = `data:image/png;base64,${rawBase64}`;
            this.statusText = "cho_quet";
            console.log(`[ZaloNotifyService] QR Code generated for phone ${NOTIFY_PHONE_TARGET}. Scan to connect.`);
          } else if (event.type === LoginQRCallbackEventType.QRCodeScanned) {
            this.statusText = "da_quet_cho_xac_nhan";
            console.log(`[ZaloNotifyService] QR scanned. Waiting for confirmation on phone ${NOTIFY_PHONE_TARGET}...`);
          } else if (event.type === LoginQRCallbackEventType.GotLoginInfo) {
            const creds: SavedZaloCredentials = {
              cookie: event.data.cookie,
              imei: event.data.imei,
              userAgent: event.data.userAgent,
              language: "vi",
              savedAt: new Date().toISOString(),
              groupId: this.targetGroupId,
              groupName: this.targetGroupName,
            };
            this.savedAt = creds.savedAt;
            try {
              fs.writeFileSync(SESSION_FILE, JSON.stringify(creds, null, 2), "utf8");
              console.log(`[ZaloNotifyService] Saved session to ${SESSION_FILE}`);
            } catch (saveErr) {
              console.error("[ZaloNotifyService] Could not save session:", saveErr);
            }
          } else if (event.type === LoginQRCallbackEventType.QRCodeExpired) {
            this.statusText = "qr_het_han";
            this.currentQrDataUrl = "";
          } else if (event.type === LoginQRCallbackEventType.QRCodeDeclined) {
            this.statusText = "tu_choi_dang_nhap";
            this.currentQrDataUrl = "";
          }
        }
      )
        .then((api: any) => {
          this.api = api;
          const uid = typeof api.getOwnId === "function" ? api.getOwnId() : "";
          this.ownUid = String(uid);
          this.statusText = "da_ket_noi";
          this.isAuthenticating = false;
          this.currentQrDataUrl = "";

          if (fs.existsSync(SESSION_FILE)) {
            try {
              const creds = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
              creds.uid = this.ownUid;
              fs.writeFileSync(SESSION_FILE, JSON.stringify(creds, null, 2), "utf8");
            } catch {}
          }

          console.log(`[ZaloNotifyService] Authenticated successfully with phone ${NOTIFY_PHONE_TARGET}! UID: ${this.ownUid}`);
        })
        .catch((err: any) => {
          console.error("[ZaloNotifyService] loginQR rejected:", err?.message || err);
          this.statusText = "loi";
          this.isAuthenticating = false;
        });

      let waited = 0;
      while (!this.currentQrDataUrl && waited < 4000) {
        await new Promise((r) => setTimeout(r, 200));
        waited += 200;
      }

      return this.currentQrDataUrl;
    } catch (err: any) {
      this.isAuthenticating = false;
      this.statusText = "loi";
      console.error("[ZaloNotifyService] Error generating QR:", err?.message || err);
      throw err;
    }
  }

  private async sendToGroup(
    groupId: string,
    messageText: string,
    tag: string
  ): Promise<{ success: boolean; reason?: string }> {
    if (!this.api || !this.ownUid) {
      const restored = await this.restoreSession();
      if (!restored || !this.api || !this.ownUid) {
        console.warn(`[ZaloNotifyService] Cannot send [${tag}] to ${NOTIFY_PHONE_TARGET}: Zalo session not connected.`);
        return { success: false, reason: "Zalo chưa được kết nối bằng mã QR." };
      }
    }

    try {
      const gid = groupId || (await this.ensureGroup());
      if (!gid) {
        throw new Error("Không tìm thấy nhóm Zalo thông báo");
      }

      const sendResult = await this.api.sendMessage(messageText, gid, zca.ThreadType.Group);
      const msgId = sendResult?.message?.msgId;
      console.log(`[ZaloNotifyService] Successfully sent [${tag}] to Group (${gid}). MsgId: ${msgId}`);
      return { success: true };
    } catch (err: any) {
      console.error(`[ZaloNotifyService] Failed to send [${tag}] to group:`, err?.message || err);
      return { success: false, reason: err?.message || String(err) };
    }
  }

  public async sendWholesaleRegistrationNotice(data: WholesaleNotifyData): Promise<{ success: boolean; reason?: string }> {
    const regionText = data.region === "HCM" ? "Sỉ TP.HCM" : "Sỉ Tỉnh";
    const timeStr = data.registeredAt
      ? new Date(data.registeredAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
      : new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

    const messageText = [
      `🌾 [ALOHA] CÓ KHÁCH ĐĂNG KÝ MUA SỈ MỚI:`,
      `👤 Khách hàng: ${data.fullName}`,
      `📞 Số điện thoại: ${data.phone}`,
      `📍 Phân vùng: ${regionText}`,
      `🏪 Cửa hàng: ${data.shopName || "Chưa cập nhật"}`,
      `🏢 Mô hình: ${data.businessType || "Chưa cập nhật"}`,
      data.address ? `🏠 Địa chỉ: ${data.address}` : "",
      data.note ? `📝 Ghi chú: ${data.note}` : "",
      `💬 Nhắn Zalo khách ngay: https://zalo.me/${data.phone}`,
      `🔗 Xem hồ sơ khách sỉ: https://alohathegioichaucay.com/admin/ctv/khach-hang?phone=${encodeURIComponent(data.phone)}&review=si`,
      `⏰ Thời gian: ${timeStr}`,
    ]
      .filter(Boolean)
      .join("\n");

    const gid = await this.getGroupIdForType("wholesale");
    return this.sendToGroup(gid, messageText, `Wholesale:${data.phone}`);
  }

  public async sendNewOrderNotice(data: NewOrderNotifyData): Promise<{ success: boolean; reason?: string }> {
    const timeStr = data.createdAt
      ? new Date(data.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
      : new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    const totalStr = new Intl.NumberFormat("vi-VN").format(Math.max(0, data.total || 0));

    const items = (data.items || []).slice(0, 8);
    const itemsLines = items.map((it, idx) => {
      const priceStr = it.price != null ? ` - ${new Intl.NumberFormat("vi-VN").format(it.price * it.quantity)}đ` : "";
      const variantStr = it.variant ? ` (${it.variant})` : "";
      return `  ${idx + 1}. ${it.name}${variantStr} x ${it.quantity}${priceStr}`;
    });
    if ((data.items || []).length > 8) {
      itemsLines.push(`  ... và ${(data.items || []).length - 8} sản phẩm khác`);
    }

    const deliveryStr = isPickupDelivery(data.deliveryMethod) ? "Đến tiệm lấy" : "Giao tận nơi";

    const messageText = [
      `🛒 [ALOHA] CÓ ĐƠN HÀNG MỚI TỪ WEBSITE!`,
      `📦 Mã đơn: #${data.orderCode}`,
      `👤 Khách hàng: ${data.customerName}`,
      `📞 Số điện thoại: ${data.phone}`,
      `💰 Tổng thanh toán: ${totalStr}đ`,
      data.paymentMethod ? `💳 Phương thức: ${data.paymentMethod}` : "",
      `🚚 Hình thức: ${deliveryStr}`,
      data.address ? `🏠 Địa chỉ: ${data.address}` : "",
      itemsLines.length > 0 ? `🛍️ Danh sách sản phẩm:\n${itemsLines.join("\n")}` : "",
      data.customerNote ? `📝 Ghi chú: ${data.customerNote}` : "",
      `💬 Nhắn Zalo khách ngay: https://zalo.me/${data.phone}`,
      `🔗 Chi tiết đơn hàng: https://alohathegioichaucay.com/admin/don-hang-web?code=${encodeURIComponent(data.orderCode)}`,
      `⏰ Thời gian: ${timeStr}`,
    ]
      .filter(Boolean)
      .join("\n");

    const gid = await this.getGroupIdForType("order");
    return this.sendToGroup(gid, messageText, `Order:${data.orderCode}`);
  }

  public async sendCollaboratorNotice(data: CollaboratorNotifyData): Promise<{ success: boolean; reason?: string }> {
    const timeStr = data.registeredAt
      ? new Date(data.registeredAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
      : new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

    const typeTitle = data.type === "upgrade_account"
      ? "🤝 [ALOHA] THÀNH VIÊN ĐĂNG KÝ TRỞ THÀNH CTV!"
      : "🤝 [ALOHA] CÓ ĐĂNG KÝ CỘNG TÁC VIÊN (CTV) MỚI!";

    const messageText = [
      typeTitle,
      `👤 Họ và tên: ${data.fullName}`,
      `📞 Số điện thoại: ${data.phone}`,
      data.email ? `📧 Email: ${data.email}` : "",
      data.ctvCode ? `🏷️ Mã CTV mong muốn/cấp: ${data.ctvCode}` : "",
      data.referralChannel ? `📢 Kênh dự kiến: ${data.referralChannel}` : "",
      data.channelUrl ? `🔗 Link kênh/shop: ${data.channelUrl}` : "",
      data.businessExperience ? `💼 Kinh nghiệm: ${data.businessExperience}` : "",
      data.address ? `🏠 Khu vực/Địa chỉ: ${data.address}` : "",
      data.note ? `📝 Ghi chú: ${data.note}` : "",
      `💬 Nhắn Zalo CTV ngay: https://zalo.me/${data.phone}`,
      `🔗 Xem & duyệt hồ sơ CTV: https://alohathegioichaucay.com/admin/ctv/khach-hang?phone=${encodeURIComponent(data.phone)}&review=ctv`,
      `⏰ Thời gian: ${timeStr}`,
    ]
      .filter(Boolean)
      .join("\n");

    const gid = await this.getGroupIdForType("ctv");
    return this.sendToGroup(gid, messageText, `CTV:${data.phone}`);
  }

  public async sendRecruitmentNotice(data: RecruitmentNotifyData): Promise<{ success: boolean; reason?: string }> {
    const timeStr = data.appliedAt
      ? new Date(data.appliedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
      : new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

    const submissionTitle = data.submissionType === "general_interest"
      ? "📄 [ALOHA] CÓ HỒ SƠ ỨNG VIÊN TIỀM NĂNG!"
      : "📄 [ALOHA] CÓ HỒ SƠ ỨNG TUYỂN VỊ TRÍ MỚI!";

    const messageText = [
      submissionTitle,
      `👤 Ứng viên: ${data.fullName}`,
      `💼 Vị trí: ${data.position}`,
      `📞 Số điện thoại: ${data.phone}`,
      data.email ? `📧 Email: ${data.email}` : "",
      data.location ? `📍 Địa điểm làm việc: ${data.location}` : "",
      data.experienceLevel ? `⭐ Mức kinh nghiệm: ${data.experienceLevel}` : "",
      data.experienceSummary ? `📝 Giới thiệu/Kinh nghiệm: ${data.experienceSummary}` : "",
      data.cvFileName ? `📎 File CV đính kèm: ${data.cvFileName}` : "",
      `🏷️ Mã hồ sơ: ${data.publicCode}`,
      `💬 Nhắn Zalo ứng viên: https://zalo.me/${data.phone}`,
      `🔗 Xem & xử lý hồ sơ: https://alohathegioichaucay.com/admin/tuyen-dung/ho-so?code=${encodeURIComponent(data.publicCode)}`,
      `⏰ Thời gian: ${timeStr}`,
    ]
      .filter(Boolean)
      .join("\n");

    const gid = await this.getGroupIdForType("recruitment");
    return this.sendToGroup(gid, messageText, `Recruitment:${data.publicCode}`);
  }
}

export const zaloNotifyService = new ZaloNotifyService();
