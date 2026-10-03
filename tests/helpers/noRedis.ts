/** Import đầu tiên trong file test: module redis đọc REDIS_URL lúc nạp, nên phải xoá trước mọi import khác. */
export const REDIS_URL_BEFORE = process.env.REDIS_URL;
process.env.REDIS_URL = "";
