import nodemailer from "nodemailer";

export const sendOrderNotification = async (toEmail, orderId) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: "New Order Assigned",
    html: `<p>You have a new order to deliver. Order ID: <b>${orderId}</b></p>
           <p>Accept or cancel the order in your dashboard.</p>`,
  };

  await transporter.sendMail(mailOptions);
};
