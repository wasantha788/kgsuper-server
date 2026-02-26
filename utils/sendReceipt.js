import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export const sendEmailReceipt = async ({ to, subject, html, attachments = [] }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "kgsupershop@gmail.com",
      port: 587,
      secure: false, // true for 465
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"KG Super Shop" <${process.env.BREVO_USER}>`,
      to,
      subject,
      html,
      attachments, // For PDFs: [{ filename: 'invoice.pdf', content: pdfBuffer }]
    });

    console.log("Email sent:", info.messageId);
    return { success: true };
  } catch (err) {
    console.error("Email send failed:", err);
    return { success: false, error: err.message };
  }
};