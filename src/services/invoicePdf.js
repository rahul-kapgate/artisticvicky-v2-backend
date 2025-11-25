import PDFDocument from "pdfkit";
import { Buffer } from "node:buffer"; // (optional in Node 18+, but safe)

export function generateInvoicePdfBuffer(invoiceData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ✅ Use "Rs." to avoid ₹ font issues
    const formatCurrency = (value) =>
      `Rs. ${Number(value ?? 0).toFixed(2)}`;

    // ===== HEADER / BRANDING =====
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor("#111827")
      .text("Artistic Vickey", { align: "left" });

    doc
      .moveDown(0.2)
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#4B5563")
      .text("Maharashtra Applied Arts & Crafts CET Coaching", {
        align: "left",
      })
      .text("https://artisticvickey.in", {
        align: "left",
        link: "https://artisticvickey.in",
        underline: false,
      })
      .moveDown(0.5);

    // INVOICE label on the right
    const headerY = doc.y;
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .fillColor("#111827")
      .text("INVOICE", 0, headerY, { align: "right" });

    // Separator line
    doc
      .moveDown(0.5)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#E5E7EB")
      .lineWidth(1)
      .stroke()
      .moveDown(1);

    // ===== BILL TO =====
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#111827")
      .text("Bill To:", { underline: true })
      .moveDown(0.3);

    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#111827")
      .text(invoiceData.user.name)
      .text(invoiceData.user.email)
      .moveDown(1);

    // ===== INVOICE META (RIGHT SIDE BOX) =====
    const metaBoxTopY = doc.y;
    const metaBoxX = 320;
    const metaBoxWidth = 225;

    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#111827")
      .text(`Invoice No: ${invoiceData.invoiceNumber}`, metaBoxX, metaBoxTopY, {
        width: metaBoxWidth,
        align: "left",
      })
      .moveDown(0.2);

    doc
      .text(`Issue Date: ${invoiceData.issueDate}`, {
        width: metaBoxWidth,
        align: "left",
      })
      .moveDown(0.2);

    // Dynamic meta box height
    const metaBoxBottomY = doc.y;
    const metaBoxHeight = metaBoxBottomY - metaBoxTopY + 5;

    doc
      .roundedRect(
        metaBoxX - 5,
        metaBoxTopY - 5,
        metaBoxWidth + 10,
        metaBoxHeight + 5,
        6
      )
      .strokeColor("#E5E7EB")
      .lineWidth(0.8)
      .stroke();

    doc.moveDown(2);

    // ===== COURSE DETAILS =====
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#111827")
      .text("Course Details", { underline: true })
      .moveDown(0.6);

    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#111827")
      .text(`Course: ${invoiceData.course.name}`)
      .moveDown(0.3);

    if (
      invoiceData.course.listedPrice !== null &&
      invoiceData.course.listedPrice !== undefined
    ) {
      doc
        .fontSize(11)
        .text(
          `Listed Course Price: ${formatCurrency(
            invoiceData.course.listedPrice
          )}`
        );
    }

    // ===== AMOUNT SUMMARY BOX =====
    doc.moveDown(1);

    const summaryBoxY = doc.y;
    const summaryBoxWidth = 495;

    doc
      .roundedRect(50, summaryBoxY - 5, summaryBoxWidth, 60, 8)
      .strokeColor("#D1D5DB")
      .lineWidth(0.8)
      .stroke();

    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#111827")
      .text("Payment Summary", 60, summaryBoxY, {
        width: summaryBoxWidth - 20,
        align: "left",
      });

    const billedAmountText = `Billed Amount: ${formatCurrency(
      invoiceData.amount
    )}`;

    doc
      .moveDown(0.6)
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#111827")
      .text(billedAmountText, {
        width: summaryBoxWidth - 20,
        align: "left",
      });

    doc.moveDown(2);

    // ===== NOTES (OPTIONAL) =====
    if (invoiceData.notes) {
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#111827")
        .text("Notes:", { underline: true })
        .moveDown(0.3);

      doc
        .fontSize(11)
        .font("Helvetica")
        .fillColor("#111827")
        .text(invoiceData.notes, {
          width: 495,
          align: "left",
        })
        .moveDown(2);
    }

    // ===== FOOTER =====
    const bottomMargin = 50;
    const pageHeight = doc.page.height;
    doc.y = pageHeight - bottomMargin - 40;

    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#E5E7EB")
      .lineWidth(1)
      .stroke()
      .moveDown(0.5);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#6B7280")
      .text(
        "This is a system generated invoice from Artistic Vickey. For any billing queries, contact support@artisticvickey.in.",
        50,
        doc.y,
        {
          width: 495,
          align: "center",
        }
      );

    doc.end();
  });
}
