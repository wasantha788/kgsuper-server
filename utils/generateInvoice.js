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
      .fontSize(28)
      .fillColor("#1A5276")
      .font("Helvetica-Bold")
      .text("KG SUPER SHOP", { align: "left" });

    doc
      .fontSize(10)
      .fillColor("#7F8C8D")
      .text("Premium Grocery & Daily Essentials", { align: "left" })
      .moveDown(0.5);

    doc.moveTo(50, 95).lineTo(550, 95).lineWidth(2).strokeColor("#1A5276").stroke();
    doc.moveDown(2);

    /* ================= INFO SECTION ================= */
    const infoTop = 115;
    
    // Left Side: Bill To (Fixed Undefined values)
    doc.fillColor("#1A5276").fontSize(12).font("Helvetica-Bold").text("BILL TO:", 50, infoTop);
    doc.fillColor("#2C3E50").font("Helvetica").fontSize(11)
      .text(`${order.address?.firstName || ''} ${order.address?.lastName || ''}`.trim() || "Valued Customer", 50, infoTop + 15)
      .text(order.address?.email || user?.email || "N/A", 50, infoTop + 30)
      .text(`${order.address?.street || order.address?.address || ''}${order.address?.city ? ', ' + order.address.city : ''}` || "Address not provided", 50, infoTop + 45);

    // Right Side: Invoice Details
    doc.fillColor("#1A5276").font("Helvetica-Bold").text("INVOICE DETAILS:", 350, infoTop);
    doc.fillColor("#2C3E50").font("Helvetica").fontSize(10)
      .text(`Invoice ID: #${order._id.toString().toUpperCase()}`, 350, infoTop + 15)
      .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 350, infoTop + 30)
      .text(`Status: ${order.paymentType === 'COD' ? 'Paid COD' : 'Paid Online'}`, 350, infoTop + 45);

    /* ================= TABLE HEADER ================= */
    const tableTop = 230;
    doc.fillColor("#FBFCFC").rect(50, tableTop - 5, 500, 20).fill("#1A5276");
    doc.fillColor("#FFFFFF").fontSize(10).font("Helvetica-Bold")
      .text("Description", 60, tableTop)
      .text("Qty", 320, tableTop, { width: 50, align: "center" })
      .text("Unit Price", 380, tableTop, { width: 80, align: "right" })
      .text("Amount", 470, tableTop, { width: 80, align: "right" });

    /* ================= TABLE CONTENT ================= */
    let position = tableTop + 25;
    let itemsSubtotal = 0;

    doc.font("Helvetica").fillColor("#2C3E50");
    order.items.forEach((item, index) => {
      const product = item.product;
      if (!product) return;

      // Added parentheses to satisfy TypeScript rule ts(5076)
      const price = Number((product.offerPrice ?? product.price) || 0);
      const qty = Number(item.quantity || 0);
      const itemTotal = price * qty;
      itemsSubtotal += itemTotal;

      if (index % 2 !== 0) {
        doc.fillColor("#F4F6F7").rect(50, position - 5, 500, 20).fill();
      }

      doc.fillColor("#2C3E50").fontSize(10)
        .text(product.name || "Product", 60, position, { width: 250 })
        .text(qty.toString(), 320, position, { width: 50, align: "center" })
        .text(`${price.toFixed(2)}`, 380, position, { width: 80, align: "right" })
        .text(`${itemTotal.toFixed(2)}`, 470, position, { width: 80, align: "right" });

      position += 20;
    });

    /* ================= SUMMARY SECTION ================= */
    const deliveryFee = itemsSubtotal >= 5000 ? 0 : 300;
    const finalTotal = itemsSubtotal + deliveryFee;

    position += 20;
    doc.moveTo(350, position).lineTo(550, position).lineWidth(1).strokeColor("#BDC3C7").stroke();
    position += 10;

    doc.fontSize(10).fillColor("#7F8C8D").text("Subtotal:", 350, position, { width: 100, align: "right" });
    doc.fillColor("#2C3E50").text(`LKR ${itemsSubtotal.toFixed(2)}`, 470, position, { width: 80, align: "right" });

    position += 18;
    doc.fillColor("#7F8C8D").text("Delivery Fee:", 350, position, { width: 100, align: "right" });
    
    if (deliveryFee === 0) {
      doc.fillColor("#27AE60").font("Helvetica-Bold").text("FREE", 470, position, { width: 80, align: "right" });
    } else {
      doc.fillColor("#2C3E50").font("Helvetica").text(`LKR ${deliveryFee.toFixed(2)}`, 470, position, { width: 80, align: "right" });
    }

    position += 25;
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1A5276")
      .text("GRAND TOTAL:", 300, position, { width: 150, align: "right" });
    doc.text(`LKR ${finalTotal.toFixed(2)}`, 470, position, { width: 80, align: "right" });

    /* ================= FOOTER ================= */
    const footerTop = 720;
    doc.moveTo(50, footerTop).lineTo(550, footerTop).lineWidth(0.5).strokeColor("#D5DBDB").stroke();
    doc.moveDown(2).font("Helvetica-Bold").fontSize(11).fillColor("#1A5276").text("Thanks for Contacting KG Super Shop!", { align: "center" });
    doc.moveDown(0.5).font("Helvetica").fontSize(9).fillColor("#7F8C8D").text("For any queries regarding this invoice, please reach out to our support team.", { align: "center" });

    doc.end();
    stream.on("finish", () => resolve(invoicePath));
    stream.on("error", (err) => reject(err));
  });
};