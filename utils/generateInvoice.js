import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export const generateInvoice = (order, user) => {
  return new Promise((resolve, reject) => {
    const invoiceDir = "invoices";
    
    // Ensure directory exists (Recursive: true handles nested folders if needed)
    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir, { recursive: true });
    }

    const invoicePath = path.join(invoiceDir, `invoice-${order._id}.pdf`);
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(invoicePath);

    // Handle stream errors immediately
    stream.on("error", (err) => reject(err));
    
    doc.pipe(stream);

    /* ================= HEADER ================= */
    doc.fillColor("#2E86C1").fontSize(26).text("KG SUPER", { align: "center" });
    doc.fillColor("black").fontSize(14).text("Payment Receipt", { align: "center" });
    doc.moveDown(2);

    /* ================= CUSTOMER BOX ================= */
    doc.rect(50, 130, 500, 80).stroke();
    doc.fontSize(11)
       .text(`Invoice ID: ${order._id}`, 60, 140)
       .text(`Customer Email: ${user.email || "N/A"}`, 60, 160)
       .text(`Date: ${new Date().toLocaleDateString()}`, 60, 180);

    /* ================= TABLE HEADER ================= */
    const tableTop = 240;
    doc.fontSize(12).fillColor("#333")
       .text("Item", 50, tableTop)
       .text("Qty", 320, tableTop, { width: 50, align: "right" })
       .text("Price", 380, tableTop, { width: 80, align: "right" })
       .text("Total", 470, tableTop, { width: 80, align: "right" });

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    /* ================= TABLE CONTENT ================= */
    let position = tableTop + 30;
    let subtotal = 0;

    // Safety check for items array
    const items = order.items || [];

    items.forEach((item) => {
      // Handle cases where product might be deleted or not populated
      const productName = item.product?.name || "Unknown Product";
      const price = Number(item.product?.price || 0);
      const qty = Number(item.quantity || 0);
      const itemTotal = price * qty;
      subtotal += itemTotal;

      // Check if we are running out of page space
      if (position > 700) { 
        doc.addPage();
        position = 50; // Reset position for new page
      }

      doc.fontSize(10).fillColor("black")
         .text(productName, 50, position, { width: 250, lineBreak: true })
         .text(qty.toString(), 320, position, { width: 50, align: "right" })
         .text(`LKR ${price.toLocaleString()}`, 380, position, { width: 80, align: "right" })
         .text(`LKR ${itemTotal.toLocaleString()}`, 470, position, { width: 80, align: "right" });

      // Calculate next position based on text height (handles multi-line names)
      const textHeight = doc.heightOfString(productName, { width: 250 });
      position += Math.max(textHeight, 20) + 10;
    });

    /* ================= TOTAL SECTION ================= */
    doc.moveTo(300, position).lineTo(550, position).stroke();

    doc.fontSize(14).fillColor("#27AE60")
       .text(`TOTAL PAID: LKR ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 
             300, position + 15, { align: "right", width: 250 });

    /* ================= FOOTER ================= */
    // Place footer at the bottom of the current page
    doc.fontSize(10).fillColor("#888")
       .text("Thank you for shopping with KG Super!", 50, 780, { align: "center", width: 500 });

    doc.end();

    stream.on("finish", () => resolve(invoicePath));
  });
};