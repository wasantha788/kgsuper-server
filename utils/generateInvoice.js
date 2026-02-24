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

    /* ================= HEADER ================= */
    doc
      .fontSize(26)
      .fillColor("#2E86C1")
      .text("KG SUPER", { align: "center" });

    doc
      .fontSize(14)
      .fillColor("black")
      .text("Payment Receipt", { align: "center" });

    doc.moveDown(2);

    /* ================= CUSTOMER BOX ================= */
    doc.rect(50, 130, 500, 80).stroke();

    doc
      .fontSize(12)
      .text(`Invoice ID: ${order._id}`, 60, 140)
      .text(`Customer Email: ${user.email}`, 60, 160)
      .text(`Date: ${new Date().toLocaleDateString()}`, 60, 180);

    /* ================= TABLE HEADER ================= */
    const tableTop = 240;

    doc
      .fontSize(13)
      .text("Item", 50, tableTop)
      .text("Qty", 320, tableTop, { width: 50, align: "right" })
      .text("Price", 380, tableTop, { width: 80, align: "right" })
      .text("Total", 470, tableTop, { width: 80, align: "right" });

    doc.moveTo(50, tableTop + 15)
       .lineTo(550, tableTop + 15)
       .stroke();

    /* ================= TABLE CONTENT ================= */
    let position = tableTop + 25;
    let subtotal = 0;

    order.items.forEach((item) => {
      const product = item.product;
      if (!product) return;

      const price = Number(product.price);
      const qty = Number(item.quantity);
      const itemTotal = price * qty;
      subtotal += itemTotal;

      // Wrap long product names properly
      doc
        .fontSize(11)
        .text(product.name, 50, position, { width: 250 }) // limit width to avoid overlap
        .text(qty, 320, position, { width: 50, align: "right" })
        .text(`LKR ${price.toFixed(2)}`, 380, position, { width: 80, align: "right" })
        .text(`LKR ${itemTotal.toFixed(2)}`, 470, position, { width: 80, align: "right" });

      position += 25;
    });

    /* ================= TOTAL SECTION ================= */
    doc.moveTo(300, position + 10)
       .lineTo(550, position + 10)
       .stroke();

    doc
      .fontSize(15)
      .fillColor("#27AE60")
      .text(
        `TOTAL PAID: LKR ${subtotal.toFixed(2)}`,
        300,
        position + 20,
        { align: "right" }
      );

    /* ================= FOOTER ================= */
    doc.moveDown(4);
    doc
      .fontSize(12)
      .fillColor("#555")
      .text("Thank you for shopping with KG Super!", {
        align: "center",
      });

    doc
      .fontSize(10)
      .text("We appreciate your business.", {
        align: "center",
      });

    doc.end();

    stream.on("finish", () => resolve(invoicePath));
    stream.on("error", reject);
  });
};