import PDFDocument from 'pdfkit';
import { Buffer } from 'node:buffer';

/**
 * Generate a nicely formatted invoice PDF as a Buffer.  This function
 * improves upon the original implementation by organising the page
 * into clear sections, placing the billing details and invoice
 * metadata side-by-side, and drawing subtle borders around key areas
 * like the payment summary.  Headings use a consistent typographic
 * hierarchy and spacing has been tuned so that the document reads
 * comfortably on A4 paper.  Callers can await the returned promise
 * to receive a Node.js Buffer containing the PDF data.
 *
 * @param {Object} invoiceData – details required to populate the invoice
 * @param {Object} invoiceData.user – the billed user's information
 * @param {string} invoiceData.user.name – full name of the recipient
 * @param {string} invoiceData.user.email – email address of the recipient
 * @param {Object} invoiceData.course – course details
 * @param {string} invoiceData.course.name – name of the course
 * @param {number} [invoiceData.course.listedPrice] – optional list price
 * @param {string} invoiceData.invoiceNumber – unique invoice identifier
 * @param {string} invoiceData.issueDate – ISO formatted issue date
 * @param {number} invoiceData.amount – amount billed
 * @param {string} [invoiceData.notes] – optional free-form notes
 * @returns {Promise<Buffer>} a promise resolving to a Buffer containing the PDF
 */
export function generateInvoicePdfBuffer(invoiceData) {
  return new Promise((resolve, reject) => {
    // Create a new document with sensible defaults for A4
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Format numbers into Indian rupees using a prefix rather than the
    // rupee symbol.  Some fonts bundled with PDFKit do not support
    // Unicode currency glyphs, so using "Rs." ensures correct output.
    const formatCurrency = (value) => `Rs. ${Number(value ?? 0).toFixed(2)}`;

    // ===== HEADER =====
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text('Artistic Vickey');
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#4B5563')
      .text('https://artisticvickey.in', {
        link: 'https://artisticvickey.in',
        underline: false,
      });

    // Add a small amount of breathing room below the header
    doc.moveDown(1);

    /**
     * Two column layout: left column for recipient information, right
     * column for invoice metadata.  We compute the available width
     * within the page margins and split it in half.  Setting the y
     * positions explicitly ensures both columns start at the same
     * vertical alignment.
     */
    const leftX = doc.x; // should be margin
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnWidth = contentWidth / 2;
    const yStart = doc.y;

    // ===== BILL TO COLUMN =====
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text('Bill To:', leftX, yStart, { underline: true });
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#111827')
      .moveDown(0.3)
      .text(invoiceData.user.name)
      .text(invoiceData.user.email);

    // ===== INVOICE META COLUMN =====
    const metaX = leftX + columnWidth;
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text('Invoice Details:', metaX, yStart, { underline: true });
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#111827')
      .moveDown(0.3)
      .text(`Invoice No: ${invoiceData.invoiceNumber}`, metaX)
      .text(`Issue Date: ${invoiceData.issueDate}`, metaX);

    // After both columns we need to reset the x position and move below
    // whichever column took up the most vertical space.
    doc.moveDown(1);

    // Draw a thin separator line
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor('#E5E7EB')
      .lineWidth(1)
      .stroke();
    doc.moveDown(1);

    // ===== COURSE DETAILS =====
    doc
      .fontSize(13)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text('Course Details', { underline: true });
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#111827')
      .moveDown(0.3)
      .text(`Course: ${invoiceData.course.name}`);

    doc.moveDown(1);

    // ===== PAYMENT SUMMARY BOX =====
    const summaryX = doc.page.margins.left;
    const summaryWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const summaryY = doc.y;
    const summaryHeight = 60;

    doc
      .roundedRect(summaryX, summaryY, summaryWidth, summaryHeight, 8)
      .strokeColor('#D1D5DB')
      .lineWidth(0.8)
      .fillAndStroke('#F9FAFB', '#D1D5DB');

    const innerPadding = 10;

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text('Payment Summary', summaryX + innerPadding, summaryY + innerPadding);

    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#111827')
      .text(
        `Billed Amount: ${formatCurrency(invoiceData.amount)}`,
        summaryX + innerPadding,
        summaryY + innerPadding + 22,
      );

    // Move the cursor below the summary box
    doc.y = summaryY + summaryHeight + 20;

    // ===== NOTES (OPTIONAL) =====
    if (invoiceData.notes) {
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text('Notes:', { underline: true });
      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#111827')
        .moveDown(0.3)
        .text(invoiceData.notes, {
          width: summaryWidth,
          align: 'left',
        });
      doc.moveDown(1);
    }

    // ===== SIGNATURE (DIGITAL SIGN) =====
    // Placed on the right side above the footer.
    const sigBlockWidth = 200;
    const sigBlockX =
      doc.page.width - doc.page.margins.right - sigBlockWidth;
    const sigBlockY = doc.y + 10;

    // Stylised signature text
    doc
      .fontSize(18)
      .font('Helvetica-Oblique')
      .fillColor('#111827')
      .text('Vicky', sigBlockX, sigBlockY + 20, {
        width: sigBlockWidth,
        align: 'left',
      });

    // Small note under the signature
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#6B7280')
      .text('Digitally signed by Vicky', sigBlockX, sigBlockY + 45, {
        width: sigBlockWidth,
        align: 'left',
      });

    // Ensure internal cursor is below the signature block
    doc.y = Math.max(doc.y, sigBlockY + 65);

    // ===== FOOTER =====
    const footerY = doc.page.height - doc.page.margins.bottom - 40;
    doc
      .moveTo(doc.page.margins.left, footerY)
      .lineTo(doc.page.width - doc.page.margins.right, footerY)
      .strokeColor('#E5E7EB')
      .lineWidth(1)
      .stroke();

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#6B7280')
      .text(
        'This is a system generated invoice from Artistic Vickey. For any billing queries, contact vikkitembhurne358@gmail.com.',
        doc.page.margins.left,
        footerY + 10,
        {
          width: summaryWidth,
          align: 'center',
        },
      );

    // Finalise the document
    doc.end();
  });
}
