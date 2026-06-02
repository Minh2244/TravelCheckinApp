// website/src/utils/formatMoney.ts

// Format số tiền thành định dạng VNĐ
export const formatMoney = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined) return "0 đ";
  
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) return "0 đ";
  
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(numAmount);
};

// Format số với dấu phẩy (không có đ)
export const formatNumber = (num: number | string | null | undefined): string => {
  if (num === null || num === undefined) return "0";
  
  const numValue = typeof num === "string" ? parseFloat(num) : num;
  
  if (isNaN(numValue)) return "0";
  
  return new Intl.NumberFormat("vi-VN").format(numValue);
};
