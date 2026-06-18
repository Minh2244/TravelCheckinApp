import { z } from 'zod';

// Schema cho đăng nhập
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email không được để trống')
    .email('Email không hợp lệ'),
  password: z
    .string()
    .min(1, 'Mật khẩu không được để trống')
    .min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

// Schema cho đăng ký
export const registerSchema = z
  .object({
    full_name: z
      .string()
      .min(1, 'Họ và tên không được để trống')
      .min(2, 'Họ và tên phải có ít nhất 2 ký tự'),
    email: z
      .string()
      .min(1, 'Email không được để trống')
      .email('Email không hợp lệ'),
    phone: z
      .string()
      .min(1, 'Số điện thoại không được để trống')
      .regex(/^(0|\+84)[3|5|7|8|9][0-9]{8}$/, 'Số điện thoại không hợp lệ'),
    password: z
      .string()
      .min(1, 'Mật khẩu không được để trống')
      .min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
    confirmPassword: z
      .string()
      .min(1, 'Vui lòng nhập lại mật khẩu'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu không khớp',
    path: ['confirmPassword'],
  });

// Schema cho quên mật khẩu
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email không được để trống')
    .email('Email không hợp lệ'),
  phone: z
    .string()
    .min(1, 'Số điện thoại không được để trống')
    .regex(/^(0|\+84)[3|5|7|8|9][0-9]{8}$/, 'Số điện thoại không hợp lệ'),
});

// Schema cho xác thực OTP
export const otpSchema = z.object({
  otp: z
    .string()
    .min(1, 'Mã OTP không được để trống')
    .length(6, 'Mã OTP phải có 6 ký tự')
    .regex(/^[0-9]+$/, 'Mã OTP chỉ chứa số'),
});

// Schema cho đặt lại mật khẩu
export const resetPasswordSchema = z
  .object({
    new_password: z
      .string()
      .min(1, 'Mật khẩu mới không được để trống')
      .min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
    confirmPassword: z
      .string()
      .min(1, 'Vui lòng nhập lại mật khẩu'),
  })
  .refine((data) => data.new_password === data.confirmPassword, {
    message: 'Mật khẩu không khớp',
    path: ['confirmPassword'],
  });

// Types cho form
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type OTPFormData = z.infer<typeof otpSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
