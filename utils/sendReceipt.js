import fs from "fs";
import SibApiV3Sdk from "sib-api-v3-sdk";

// Initialize the client once
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

export const sendReceiptEmail = async (toEmail, pdfPath) => {
  try {
    // 1. Check if file exists before trying to read it
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found at path: ${pdfPath}`);
    }

    // 2. Read and convert to Base64
    const pdfData = fs.readFileSync(pdfPath).toString("base64");

    // 3. Construct the email object
    const sendSmtpEmail = {
      sender: { 
        name: "KG Super Shop", 
        email: process.env.BREVO_USER || "kgsupershop@gmail.com" 
      },
      to: [{ email: toEmail }],
      subject: "Payment Successful - Invoice Attached ✅",
      htmlContent: `
        <div style="font-family: sans-serif; line-height: 1.5;">
          <h2>Thank you for your payment!</h2>
          <p>We appreciate your business at <strong>KG Super Shop</strong>.</p>
          <p>Please find your official invoice attached to this email as a PDF.</p>
          <br />
          <p>Best Regards,<br />KG Super Team</p>
        </div>
      `,
      attachment: [
        {
          content: pdfData,
          name: `Invoice_${new Date().toISOString().split('T')[0]}.pdf`,
        },
      ],
    };

    // 4. Send
    await emailApi.sendTransacEmail(sendSmtpEmail);
    
    console.log(`✅ Invoice sent to ${toEmail} successfully!`);
    return true; // Return true so the controller knows it worked
  } catch (error) {
    // Log the detailed error from Brevo if available
    const errorMsg = error.response?.body?.message || error.message;
    console.error("❌ Brevo Send Error:", errorMsg);
    return false; // Return false so the controller can handle the failure
  }
};