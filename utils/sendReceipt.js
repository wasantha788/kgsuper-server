import {Resend }from "resend";
import fs from "fs";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendReceiptEmail = async (toEmail, pdfPath, options) => {
  const pdfData = fs.readFileSync(pdfPath).toString("base64");

  await resend.emails.send({
    from: options.from,
    to: toEmail,
    subject: options.subject,
    html: options.html,
    attachments: [
      {
        name: `Invoice_${Date.now()}.pdf`,
        data: pdfData,
        type: "application/pdf",
      },
    ],
  });
};