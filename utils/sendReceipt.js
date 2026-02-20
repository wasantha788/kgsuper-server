import { Resend } from "resend";
import fs from "fs";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendReceiptEmail = async (userEmail, invoicePath) => {
  const fileBuffer = fs.readFileSync(invoicePath);

  await resend.emails.send({
    from: "KG Super <onboarding@resend.dev>",
    to: userEmail,
    subject: "Payment Successful - Invoice Attached ✅",
    html: `<h2>Thank you for your payment!</h2>
           <p>Your invoice is attached as a PDF.</p>`,
    attachments: [
      {
        filename: "invoice.pdf",
        content: fileBuffer.toString("base64"),
      },
    ],
  });
};
