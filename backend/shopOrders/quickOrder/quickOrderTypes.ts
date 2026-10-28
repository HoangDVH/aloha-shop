export type QuickOrderParseInput = {
  text?: string;
  imageBase64?: string;
  imageMime?: string;
};

export type QuickOrderParsedCustomer = {
  name: string;
  phone: string;
  address: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  fullAddress?: string;
  ghnDistrictId?: number;
  ghnWardCode?: string;
};

export type QuickOrderItem = {
  productCode: string;
  productName: string;
  quantity: number;
  price: number; // Mặc định là GIÁ WEB
  originalPrice?: number;
  stock: number;
  imageUrl: string;
  confidence?: number;
  rawQuery?: string;
};

export type QuickOrderVisualAnalysis = {
  plantName?: string;
  potType?: string;
  accessories?: string[];
  keywords?: string[];
};

export type QuickOrderCandidate = {
  productCode: string;
  productName: string;
  quantity: number;
  price: number; // Mặc định là GIÁ WEB
  originalPrice?: number;
  stock: number;
  imageUrl: string;
  confidence: number;
  matchReasons?: string[];
};

export type QuickOrderParseResult = {
  customer: QuickOrderParsedCustomer;
  items: QuickOrderItem[];
  candidates?: QuickOrderCandidate[];
  visualAnalysis?: QuickOrderVisualAnalysis;
  unmatchedItems?: string[];
  note: string;
  rawText?: string;
};

export type QuickOrderCreateInput = {
  customerName: string;
  customerPhone: string;
  address: string;
  province: string;
  district: string;
  ward: string;
  ghnDistrictId?: number;
  ghnWardCode?: string;
  items: {
    productCode: string;
    productName: string;
    quantity: number;
    price: number;
    discount?: number;
    note?: string;
  }[];
  paymentMethod: "Cash" | "Transfer";
  shippingFee?: number;
  discount?: number;
  note?: string;
};

export type QuickOrderCreateResult = {
  ok: boolean;
  orderId: string;
  orderCode: string;
  kvOrderCode?: string;
  kvOrderId?: number | string;
  total: number;
  shippingFee: number;
  discount: number;
};
