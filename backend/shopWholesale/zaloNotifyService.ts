import * as zcaModule from "zca-js";
import fs from "fs";
import path from "path";
import CryptoJS from "crypto-js";

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

class ZaloNotifyService {
  private api: any = null;
  private ownUid: string = "";
  private isAuthenticating: boolean = false;
  private currentQrDataUrl: string = "";
  private statusText: string = "chua_ket_noi"; // chua_ket_noi | dang_tao_qr | cho_quet | da_quet_cho_xac_nhan | da_ket_noi | loi
  private targetGroupId: string = "3714868686368863924";
  private targetGroupName: string = "Aloha - Thông Báo Sỉ";

  constructor() {
    this.restoreSession().catch((err) => {
      console.log("[ZaloNotifyService] No saved session or restore failed:", err?.message || err);
    });
  }

  public getStatus() {
    return {
      targetPhone: NOTIFY_PHONE_TARGET,
      connected: Boolean(this.api),
      ownUid: this.ownUid,
      targetGroupId: this.targetGroupId,
      targetGroupName: this.targetGroupName,
      status: this.statusText,
      hasQr: Boolean(this.currentQrDataUrl),
      qrImage: this.currentQrDataUrl,
    };
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

  public async generateQR(): Promise<string> {
    if (this.api && this.statusText === "da_ket_noi") {
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
            };
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

  public async sendWholesaleRegistrationNotice(data: {
    fullName: string;
    phone: string;
    region?: string;
    shopName?: string;
    businessType?: string;
    note?: string;
  }): Promise<{ success: boolean; reason?: string }> {
    if (!this.api || !this.ownUid) {
      const restored = await this.restoreSession();
      if (!restored || !this.api || !this.ownUid) {
        console.warn(`[ZaloNotifyService] Cannot send notice to ${NOTIFY_PHONE_TARGET}: Zalo session not connected.`);
        return { success: false, reason: "Zalo chưa được kết nối bằng mã QR." };
      }
    }

    try {
      const regionText = data.region === "HCM" ? "Sỉ TP.HCM (Nội thành)" : "Sỉ Tỉnh (Chành xe)";
      const messageText = [
        `🌿 [ALOHA] CÓ KHÁCH ĐĂNG KÝ MUA SỈ MỚI:`,
        `👤 Khách hàng: ${data.fullName}`,
        `📞 Số điện thoại: ${data.phone}`,
        `📍 Phân vùng: ${regionText}`,
        `🏪 Cửa hàng: ${data.shopName || "Chưa cập nhật"}`,
        `🏢 Mô hình: ${data.businessType || "Chưa cập nhật"}`,
        data.note ? `📝 Ghi chú: ${data.note}` : "",
        `💬 Nhắn Zalo khách ngay: https://zalo.me/${data.phone}`,
        `⏰ Thời gian: ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`,
      ]
        .filter(Boolean)
        .join("\n");

      const gid = await this.ensureGroup();
      if (!gid) {
        throw new Error("Không tìm thấy nhóm Zalo thông báo");
      }

      const sendResult = await this.api.sendMessage(messageText, gid, zca.ThreadType.Group);
      const msgId = sendResult?.message?.msgId;
      console.log(`[ZaloNotifyService] Successfully sent wholesale alert to Group ${this.targetGroupName} (${gid}) for customer ${data.phone}. MsgId: ${msgId}`);
      return { success: true };
    } catch (err: any) {
      console.error(`[ZaloNotifyService] Failed to send message to group:`, err?.message || err);
      return { success: false, reason: err?.message || String(err) };
    }
  }
}

export const zaloNotifyService = new ZaloNotifyService();
