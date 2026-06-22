import { AxiosError } from "axios";

export function getErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ||
      error.message ||
      "Có lỗi kết nối tới máy chủ."
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Đã xảy ra lỗi không xác định.";
}
