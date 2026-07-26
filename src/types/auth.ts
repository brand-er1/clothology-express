
import type { AccountType } from "@/utils/accountRouting";

export interface AuthFormData {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  brandName: string;
  fullName: string;
  phoneNumber: string;
  address: string;
  addressDetail: string;
  postcode: string;
  height: string;
  weight: string;
  gender: string;
  accountType: AccountType | "";
}
