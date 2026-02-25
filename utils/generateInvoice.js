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
    doc.fontSize(26).fillColor("#2E86C1").text("KG SUPER", { align: "center" });
    doc.fontSize(14).fillColor("black").text("Payment Receipt", { align: "center" });
    doc.moveDown(2);

    /* ================= CUSTOMER BOX ================= */
    doc.rect(50, 130, 500, 80).stroke();
    doc.fontSize(12)
       .text(`Invoice ID: ${order._id}`, 60, 140)
       .text(`Customer: ${order.address?.firstName} ${order.address?.lastName}`, 60, 160)
       .text(`Date: ${new Date().toLocaleDateString()}`, 60, 180);

    /* ================= TABLE HEADER ================= */
    const tableTop = 240;
    doc.fontSize(13)
       .text("Item", 50, tableTop)
       .text("Qty", 320, tableTop, { width: 50, align: "right" })
       .text("Price", 380, tableTop, { width: 80, align: "right" })
       .text("Total", 470, tableTop, { width: 80, align: "right" });

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    /* ================= TABLE CONTENT ================= */
    let position = tableTop + 25;
    let itemsSubtotal = 0;

    order.items.forEach((item) => {
      const product = item.product;
      if (!product) return;

      const price = Number(product.price);
      const qty = Number(item.quantity);
      const itemTotal = price * qty;
      itemsSubtotal += itemTotal;

      doc.fontSize(11)
         .fillColor("black")
         .text(product.name, 50, position, { width: 250 })
         .text(qty, 320, position, { width: 50, align: "right" })
         .text(`LKR ${price.toFixed(2)}`, 380, position, { width: 80, align: "right" })
         .text(`LKR ${itemTotal.toFixed(2)}`, 470, position, { width: 80, align: "right" });

      position += 25;
    });

    /* ================= TOTAL SECTION ================= */
    // Calculate the "hidden" fee (3801 - 3727 = 74)
    const finalAmount = Number(order.amount); 
    const deliveryFee = finalAmount - itemsSubtotal;

    position += 10;
    doc.moveTo(300, position).lineTo(550, position).stroke();
    position += 10;

    // Subtotal Row
    doc.fontSize(10).text("Items Subtotal:", 300, position, { width: 150, align: "right" });
    doc.text(`LKR ${itemsSubtotal.toFixed(2)}`, 450, position, { width: 100, align: "right" });

    // Delivery Fee Row (Only shows if there is a difference)
    if (deliveryFee > 0) {
      position += 15;
      doc.text("Delivery/Service Fee:", 300, position, { width: 150, align: "right" });
      doc.text(`LKR ${deliveryFee.toFixed(2)}`, 450, position, { width: 100, align: "right" });
    }

    // Grand Total Row
    position += 25;
    doc.fontSize(15).fillColor("#27AE60").font('Helvetica-Bold')
       .text(`TOTAL PAID: LKR ${finalAmount.toFixed(2)}`, 300, position, { align: "right" });

    /* ================= FOOTER ================= */
    doc.moveDown(4);
    doc.fontSize(12).fillColor("#555").font('Helvetica').text("Thank you for shopping with KG Super!", { align: "center" });

    doc.end();
    stream.on("finish", () => resolve(invoicePath));
    stream.on("error", reject);
  });
};