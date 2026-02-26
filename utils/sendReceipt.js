import fs from "fs";
import SibApiV3Sdk from "sib-api-v3-sdk";

const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

export const sendReceiptEmail = async (toEmail, pdfPath) => {
  try {
    const pdfData = fs.readFileSync(pdfPath).toString("base64");
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail({
      sender: { name: "KG Super Shop", email: "kgsupershop@gmail.com" },
      to: [{ email: toEmail }],
      subject: "Payment Successful - Invoice Attached ✅",
      htmlContent: `<h2>Thank you for your payment!</h2>
                    <p>Your invoice is attached as a PDF.</p>`,
      attachment: [
        {
          content: pdfData,
          name: `Invoice_${Date.now()}.pdf`,
        },
      ],
    });

    await emailApi.sendTransacEmail(sendSmtpEmail);
    console.log("✅ Invoice sent via Brevo successfully!");
  } catch (error) {
    console.error("❌ Brevo Send Error:", error);
    throw error;
  }
};