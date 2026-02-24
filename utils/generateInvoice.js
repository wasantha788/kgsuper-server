import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export const generateInvoice = (order, user) => {
  return new Promise((resolve, reject) => {
    const invoiceDir = "invoices";
    const invoicePath = path.join(invoiceDir, `invoice-${order._id}.pdf`);

    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir);
    }

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(invoicePath);
    doc.pipe(stream);

    /* ===============================
       HEADER
    =============================== */
    doc
      .fontSize(26)
      .fillColor("#2E86C1")
      .text("KG SUPER", { align: "center" });

    doc
      .fontSize(14)
      .fillColor("black")
      .text("Payment Receipt", { align: "center" });

    doc.moveDown(2);

    /* ===============================
       CUSTOMER INFO BOX
    =============================== */
    doc
      .rect(50, 130, 500, 80)
      .stroke();

    doc
      .fontSize(12)
      .text(`Invoice ID: ${order._id}`, 60, 140)
      .text(`Customer Email: ${user.email}`, 60, 160)
      .text(`Date: ${new Date().toLocaleDateString()}`, 60, 180);

    doc.moveDown(5);

    /* ===============================
       TABLE HEADER
    =============================== */
    const tableTop = 240;

    doc
      .fontSize(13)
      .fillColor("#000")
      .text("Item", 50, tableTop)
      .text("Qty", 300, tableTop, { width: 50, align: "right" })
      .text("Price", 360, tableTop, { width: 80, align: "right" })
      .text("Total", 450, tableTop, { width: 100, align: "right" });

    doc.moveTo(50, tableTop + 15)
       .lineTo(550, tableTop + 15)
       .stroke();

    /* ===============================
       TABLE CONTENT
    =============================== */
    let position = tableTop + 25;
    let subtotal = 0;

    order.items.forEach((item) => {
      const product = item.product;
      if (!product) return;

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      doc
        .fontSize(11)
        .text(product.name, 50, position)
        .text(item.quantity, 300, position, { width: 50, align: "right" })
        .text(`LKR ${product.price.toFixed(2)}`, 360, position, { width: 80, align: "right" })
        .text(`LKR ${itemTotal.toFixed(2)}`, 450, position, { width: 100, align: "right" });

      position += 20;
    });

    /* ===============================
       TOTAL SECTION
    =============================== */
    doc.moveTo(300, position + 10)
       .lineTo(550, position + 10)
       .stroke();

    doc
      .fontSize(14)
      .fillColor("#27AE60")
      .text(
        `TOTAL PAID: LKR ${Number(order.amount).toFixed(2)}`,
        300,
        position + 20,
        { align: "right" }
      );

    /* ===============================
       FOOTER
    =============================== */
    doc.moveDown(4);
    doc
      .fontSize(12)
      .fillColor("#555")
      .text("Thank you for shopping with KG Super!", {
        align: "center",
      });

    doc
      .fontSize(10)
      .text("We appreciate your business ❤️", {
        align: "center",
      });

    doc.end();

    stream.on("finish", () => resolve(invoicePath));
    stream.on("error", reject);
  });
};