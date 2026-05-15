import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    // 👇 ĐÃ SỬA: Đổi từ EMAIL_PASS thành EMAIL_PASSWORD để khớp với file .env của bạn
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendOTPEmail = async (
  to: string,
  otp: string,
  type: "REGISTER" | "FORGOT_PASSWORD" = "REGISTER"
) => {
  let subject = "";
  let title = "";
  let message = "";

  // Chọn nội dung dựa trên loại email
  if (type === "REGISTER") {
    subject = "Mã xác thực đăng ký tài khoản - Travel Check-in";
    title = "Xin chào,";
    message = "Cảm ơn bạn đã đăng ký tài khoản. Mã xác thực (OTP) của bạn là:";
  } else {
    subject = "Mã xác thực khôi phục mật khẩu - Travel Check-in";
    title = "Yêu cầu đặt lại mật khẩu";
    message =
      "Chúng tôi nhận được yêu cầu lấy lại mật khẩu cho tài khoản này. Mã xác thực (OTP) của bạn là:";
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <h2 style="color: #1890ff; text-align: center;">Travel Check-in App</h2>
      <p style="font-size: 16px; color: #333;">${title}</p>
      <p style="font-size: 16px; color: #555;">${message}</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="display: inline-block; font-size: 32px; font-weight: bold; color: #1890ff; letter-spacing: 5px; padding: 10px 20px; border: 2px dashed #1890ff; border-radius: 5px; background-color: #f0f5ff;">
          ${otp}
        </span>
      </div>
      <p style="color: #red; font-size: 14px;"><strong>Lưu ý quan trọng:</strong></p>
      <ul style="color: #555; font-size: 14px;">
        <li>Mã này chỉ có hiệu lực trong vòng <strong>5 phút</strong>.</li>
        <li>Mã chỉ được sử dụng <strong>1 lần duy nhất</strong>.</li>
        <li>Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</li>
      </ul>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #999; text-align: center;">Đây là email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Travel Check-in App" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: htmlContent,
  });
};

export const sendOwnerTermsEmail = async (
  to: string,
  ownerName: string,
  confirmUrl: string
) => {
  const subject = "Xác nhận điều khoản hoạt động - Travel Check-in";
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <h2 style="color: #1890ff; text-align: center;">Travel Check-in</h2>
      <p style="font-size: 16px; color: #333;">Xin chào ${
        ownerName || "Owner"
      },</p>
      <p style="font-size: 16px; color: #555;">
        Bạn vừa được Admin xét duyệt quyền Owner. Vui lòng xác nhận lại điều khoản hoạt động và hoa hồng để hoàn tất quy trình.
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${confirmUrl}" style="display: inline-block; background: #1890ff; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">
          Xác nhận điều khoản
        </a>
      </div>
      <p style="font-size: 12px; color: #888;">
        Nếu không bấm được nút, hãy mở link sau: ${confirmUrl}
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #999; text-align: center;">Đây là email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Travel Check-in App" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: htmlContent,
  });
};

export const sendOwnerTermsAcceptedEmail = async (
  ownerEmail: string,
  ownerName: string
) => {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_USER;
  if (!adminEmail) return;

  const subject = "Owner đã xác nhận điều khoản";
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <h2 style="color: #1890ff; text-align: center;">Travel Check-in</h2>
      <p style="font-size: 16px; color: #333;">Owner đã xác nhận điều khoản hoạt động.</p>
      <p style="font-size: 14px; color: #555;">Tên: ${ownerName || "Owner"}</p>
      <p style="font-size: 14px; color: #555;">Email: ${ownerEmail || "-"}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #999; text-align: center;">Đây là email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Travel Check-in App" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject,
    html: htmlContent,
  });
};
