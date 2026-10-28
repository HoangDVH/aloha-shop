export type ParsedCustomer = {
  name: string;
  phone: string;
  address: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  ghnDistrictId?: number;
  ghnWardCode?: string;
};

export type QuickOrderItem = {
  productCode: string;
  productName: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  stock: number;
  imageUrl: string;
};

export type QuickOrderCandidate = {
  productCode: string;
  productName: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  stock: number;
  imageUrl: string;
  confidence: number;
  matchReasons?: string[];
};

export type QuickOrderVisualAnalysis = {
  plantName?: string;
  potType?: string;
  accessories?: string[];
  keywords?: string[];
};

export type ParseApiResponse = {
  ok: boolean;
  data: {
    customer: ParsedCustomer;
    items: QuickOrderItem[];
    candidates?: QuickOrderCandidate[];
    visualAnalysis?: QuickOrderVisualAnalysis;
    unmatchedItems?: string[];
    note: string;
    rawText?: string;
  };
};

export type CreateApiResponse = {
  ok: boolean;
  orderId: string;
  orderCode: string;
  kvOrderCode?: string;
  total: number;
  shippingFee: number;
  discount: number;
};
