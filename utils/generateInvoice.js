import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export const generateInvoice = (order, user) => {
  return new Promise((resolve, reject) => {
    const invoicePath = path.join("invoices", `invoice-${order._id}.pdf`);

    if (!fs.existsSync("invoices")) {
      fs.mkdirSync("invoices");
    }

    const doc = new PDFDocument();
    const stream = fs.createWriteStream(invoicePath);

    doc.pipe(stream);

    doc.fontSize(20).text("KG Super - Payment Receipt", { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text(`Invoice ID: ${order._id}`);
    doc.text(`Customer: ${user.email}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    doc.text("Order Items:");
    order.items.forEach((item) => {
      doc.text(`${item.name} - ${item.quantity} x LKR ${item.price}`);
    });

    doc.moveDown();
    doc.fontSize(14).text(`Total Paid: LKR ${Number(order.amount).toFixed(2)}`, {
      align: "right",
    });

    doc.end();

    stream.on("finish", () => resolve(invoicePath));
    stream.on("error", reject);
  });
};
