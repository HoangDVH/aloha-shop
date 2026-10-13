import type { SiRegisterInput } from "./siRegisterSchema";
import type { ShopUser } from "./auth";
type Request = <T>(path: string, body: unknown) => Promise<T>;

export async function submitSiRegistration(values: SiRegisterInput, loggedIn: boolean, request: Request) {
  const lookup = await request<{ lookupId: string; result: string }>("/api/shop/auth/si/lookup", {
    phone: values.phone, province: values.province, district: values.district, ward: values.ward, detail: values.detail,
  });
  return request<{ user: ShopUser }>("/api/shop/auth/si/register", {
    ...values, lookupId: lookup.lookupId,
    email: loggedIn ? undefined : values.email, password: loggedIn ? undefined : values.password,
  });
}
