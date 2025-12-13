import PDFDocument from "pdfkit";
import { Buffer } from "node:buffer";

export function generateInvoicePdfBuffer(invoiceData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const COLORS = {
      primary: "#111827", // slate-900
      accent: "#4F46E5", // indigo-600
      accentSoft: "#EEF2FF", // indigo-50
      muted: "#6B7280", // gray-500
      border: "#E5E7EB", // gray-200
      bgSoft: "#F9FAFB", // gray-50
      danger: "#DC2626",
    };

    const formatCurrency = (value) => `Rs. ${Number(value ?? 0).toFixed(2)}`;

    const listedPrice =
      typeof invoiceData.course.listedPrice === "number"
        ? invoiceData.course.listedPrice
        : invoiceData.amount;
    const hasListedPrice =
      typeof invoiceData.course.listedPrice === "number" &&
      invoiceData.course.listedPrice > 0;
    const discount = hasListedPrice ? listedPrice - invoiceData.amount : 0;

    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ===== HEADER BAR (FIRST) =====
    const headerHeight = 70;
    const headerY = doc.page.margins.top + 4; // a bit inside the border

    doc
      .save()
      .rect(doc.page.margins.left + 4, headerY, contentWidth - 8, headerHeight)
      .fill(COLORS.primary)
      .restore();

    // Brand Name
    doc
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .fontSize(22)
      .text("Artistic Vickey", doc.page.margins.left + 16, headerY + 16);

    // URL
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#E5E7EB")
      .text("https://artisticvickey.in", doc.page.margins.left + 16, headerY + 40, {
        link: "https://artisticvickey.in",
        underline: false,
      });

    // INVOICE label on right
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#C7D2FE")
      .text("INVOICE", doc.page.margins.left, headerY + 22, {
        width: contentWidth - 16,
        align: "right",
      });

    // Move cursor below header
    doc.y = headerY + headerHeight + 16;

    // ===== TWO COLUMN: BILL TO + INVOICE DETAILS =====
    const leftX = doc.page.margins.left + 12;
    const columnWidth = contentWidth / 2;
    const yStart = doc.y;

    // BILL TO
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor(COLORS.accent)
      .text("Bill To", leftX, yStart);
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(COLORS.primary)
      .moveDown(0.4)
      .text(invoiceData.user.name, { width: columnWidth - 10 })
      .fillColor(COLORS.muted)
      .text(invoiceData.user.email, { width: columnWidth - 10 });

    const billToEndY = doc.y;

    // INVOICE DETAILS
    const metaX = leftX + columnWidth;
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor(COLORS.accent)
      .text("Invoice Details", metaX, yStart);
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(COLORS.primary)
      .moveDown(0.4)
      .text(`Invoice No: ${invoiceData.invoiceNumber}`, metaX, undefined, {
        width: columnWidth - 10,
      })
      .text(`Issue Date: ${invoiceData.issueDate}`, metaX, undefined, {
        width: columnWidth - 10,
      });

    const metaEndY = doc.y;

    // Set cursor below the tallest column
    doc.y = Math.max(billToEndY, metaEndY) + 18;

    // Separator line
    doc
      .moveTo(doc.page.margins.left + 12, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right - 12, doc.y)
      .lineWidth(0.8)
      .strokeColor(COLORS.border)
      .stroke();
    doc.moveDown(1.1);

    // ===== COURSE / ITEM TABLE =====
    const tableStartY = doc.y;
    const rowHeight = 22;

    const tableX = doc.page.margins.left + 12;
    const tableWidth = contentWidth - 24; // inner card width

    const col1Width = 50;  // #
    const col3Width = 100; // list price
    const col4Width = 100; // amount
    const col2Width = tableWidth - col1Width - col3Width - col4Width; // description

    // Table header background
    doc
      .save()
      .rect(tableX, tableStartY, tableWidth, rowHeight)   // was contentWidth - 24
      .fill(COLORS.accentSoft)
      .restore();

    // Header text
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLORS.primary)
      .text("#", tableX + 8, tableStartY + 6, { width: col1Width - 10 })
      .text("Course / Description", tableX + col1Width + 8, tableStartY + 6, {
        width: col2Width - 10,
      })
      .text(
        "List Price",
        tableX + col1Width + col2Width + 8,
        tableStartY + 6,
        {
          width: col3Width - 10,
          align: "right",
        }
      )
      .text(
        "Amount",
        tableX + col1Width + col2Width + col3Width + 8,
        tableStartY + 6,
        {
          width: col4Width - 10,
          align: "right",
        }
      );

    // Header bottom border
    doc
    .moveTo(tableX, tableStartY + rowHeight)
    .lineTo(tableX + tableWidth, tableStartY + rowHeight) // was tableX + contentWidth - 24
      .lineWidth(0.7)
      .strokeColor(COLORS.border)
      .stroke();

    // Single item row
    const itemY = tableStartY + rowHeight;
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.primary)
      .text("1", tableX + 8, itemY + 5, { width: col1Width - 10 })
      .text(invoiceData.course.name, tableX + col1Width + 8, itemY + 5, {
        width: col2Width - 10,
      })
      .text(
        formatCurrency(listedPrice),
        tableX + col1Width + col2Width + 8,
        itemY + 5,
        {
          width: col3Width - 10,
          align: "right",
        }
      )
      .text(
        formatCurrency(invoiceData.amount),
        tableX + col1Width + col2Width + col3Width + 8,
        itemY + 5,
        {
          width: col4Width - 10,
          align: "right",
        }
      );

    const itemRowBottom = itemY + rowHeight;

    // Table outer border
    doc
      .save()
      .rect(tableX, tableStartY, tableWidth, itemRowBottom - tableStartY) // was contentWidth - 24
      .lineWidth(0.8)
      .strokeColor(COLORS.border)
      .stroke()
      .restore();

    doc.y = itemRowBottom + 24;

    // ===== PAYMENT SUMMARY CARD =====
    const summaryX = doc.page.margins.left + 12;
    const summaryWidth = contentWidth - 24;
    const summaryY = doc.y;
    const summaryHeight = hasListedPrice ? 90 : 70;
    const innerPad = 12;

    doc
      .save()
      .roundedRect(summaryX, summaryY, summaryWidth, summaryHeight, 8)
      .fillAndStroke(COLORS.bgSoft, COLORS.border)
      .restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(COLORS.accent)
      .text("Payment Summary", summaryX + innerPad, summaryY + innerPad);

    const summaryTextY = summaryY + innerPad + 18;

    doc.font("Helvetica").fontSize(10).fillColor(COLORS.primary);

    let lineY = summaryTextY;
    if (hasListedPrice) {
      doc.text("List Price", summaryX + innerPad, lineY);
      lineY += 16;
      doc.text("Discount", summaryX + innerPad, lineY);
      lineY += 16;
    }
    doc.text("Net Payable", summaryX + innerPad, lineY);

    // Right values
    lineY = summaryTextY;
    if (hasListedPrice) {
      doc.text(
        formatCurrency(listedPrice),
        summaryX + summaryWidth / 2,
        lineY,
        {
          align: "right",
          width: summaryWidth / 2 - innerPad,
        }
      );
      lineY += 16;

      const discountLabel =
        discount > 0 ? `- ${formatCurrency(discount)}` : formatCurrency(0);
      doc
        .fillColor(discount > 0 ? COLORS.danger : COLORS.muted)
        .text(discountLabel, summaryX + summaryWidth / 2, lineY, {
          align: "right",
          width: summaryWidth / 2 - innerPad,
        })
        .fillColor(COLORS.primary);
      lineY += 16;
    }

    doc
      .font("Helvetica-Bold")
      .text(
        formatCurrency(invoiceData.amount),
        summaryX + summaryWidth / 2,
        lineY,
        {
          align: "right",
          width: summaryWidth / 2 - innerPad,
        }
      );

    doc.y = summaryY + summaryHeight + 24;

    // ===== NOTES (OPTIONAL) =====
    if (invoiceData.notes) {
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(COLORS.accent)
        .text("Notes", summaryX, doc.y);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(COLORS.primary)
        .moveDown(0.3)
        .text(invoiceData.notes, {
          width: summaryWidth,
          align: "left",
        });
      doc.moveDown(1);
    }

    // ===== SIGNATURE BLOCK (RIGHT) =====
    const sigBlockWidth = 220;
    const sigBlockX =
      doc.page.width - doc.page.margins.right - sigBlockWidth - 12;
    const sigBlockY = doc.y + 5;
    const sigBlockHeight = 80;

    doc
      .save()
      .roundedRect(sigBlockX, sigBlockY, sigBlockWidth, sigBlockHeight, 8)
      .strokeColor(COLORS.border)
      .lineWidth(0.8)
      .stroke()
      .restore();

    doc
      .fontSize(18)
      .font("Helvetica-Oblique")
      .fillColor(COLORS.primary)
      .text("Vickey", sigBlockX + 16, sigBlockY + 18);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(COLORS.muted)
      .text("Digitally signed by Vickey", sigBlockX + 16, sigBlockY + 42);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(COLORS.muted)
      .text("Authorised Signatory", sigBlockX + 16, sigBlockY + 58);

    doc.y = Math.max(doc.y, sigBlockY + sigBlockHeight + 24);

    // ===== FOOTER =====
    const footerY = doc.page.height - doc.page.margins.bottom - 40;
    doc
      .moveTo(doc.page.margins.left + 12, footerY)
      .lineTo(doc.page.width - doc.page.margins.right - 12, footerY)
      .strokeColor(COLORS.border)
      .lineWidth(0.8)
      .stroke();

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(COLORS.muted)
      .text(
        "This is a system generated invoice from Artistic Vickey. For any billing queries, contact vikkitembhurne358@gmail.com.",
        doc.page.margins.left + 20,
        footerY + 8,
        {
          width: contentWidth - 40,
          align: "center",
        }
      );

    // ===== OUTER BORDER (LAST, ON TOP) =====
    const outerPadding = 8;
    const outerX = doc.page.margins.left - outerPadding;
    const outerY = doc.page.margins.top - outerPadding;
    const outerWidth =
      doc.page.width -
      doc.page.margins.left -
      doc.page.margins.right +
      outerPadding * 2;
    const outerHeight =
      doc.page.height -
      doc.page.margins.top -
      doc.page.margins.bottom +
      outerPadding * 2;

    doc
      .save()
      .roundedRect(outerX, outerY, outerWidth, outerHeight, 12)
      .lineWidth(1)
      .strokeColor(COLORS.border)
      .stroke()
      .restore();

    doc.end();
  });
}
