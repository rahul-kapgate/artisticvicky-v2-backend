import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SIGNATURE_PATH = path.resolve(
  __dirname,
  "../assets/signatures/vickey-signature.png",
);

const LOGO_PATH = path.resolve(
  __dirname,
  "../assets/logos/artistic-vickey-logo.png",
);

export function generateCertificatePdfBuffer({
  certificateNumber,
  issueDate,
  user,
  course,
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 40,
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const centerX = pageWidth / 2;

    const navy = "#0F172A";
    const gold = "#C9A227";
    const burgundy = "#7F1D1D";
    const gray = "#475569";
    const light = "#FAF7F0";
    const softGold = "#EAD9A0";

    const drawSeal = (x, y) => {
      doc
        .save()
        .fillColor(burgundy)
        .polygon([x - 22, y + 34], [x - 8, y + 82], [x + 4, y + 48])
        .fill()
        .polygon([x + 22, y + 34], [x + 8, y + 82], [x - 4, y + 48])
        .fill()
        .restore();

      doc
        .save()
        .lineWidth(3)
        .fillColor(gold)
        .strokeColor(gold)
        .circle(x, y, 42)
        .fillAndStroke();

      doc
        .fillColor(navy)
        .strokeColor(softGold)
        .lineWidth(2)
        .circle(x, y, 33)
        .fillAndStroke();

      const dotRadius = 2.2;
      const ringRadius = 37;
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12 - Math.PI / 2;
        const dx = x + Math.cos(angle) * ringRadius;
        const dy = y + Math.sin(angle) * ringRadius;
        doc.fillColor(navy).circle(dx, dy, dotRadius).fill();
      }

      doc
        .fillColor(gold)
        .font("Helvetica-Bold")
        .fontSize(18)
        .text("AV", x - 18, y - 13, {
          width: 36,
          align: "center",
        });

      doc
        .font("Helvetica")
        .fontSize(6.5)
        .fillColor(softGold)
        .text("OFFICIAL SEAL", x - 26, y + 8, {
          width: 52,
          align: "center",
        });

      doc.restore();
    };

    const drawCornerAccent = (x, y, flipX = 1, flipY = 1) => {
      const len = 28;
      doc
        .save()
        .strokeColor(gold)
        .lineWidth(2)
        .moveTo(x, y)
        .lineTo(x + len * flipX, y)
        .stroke()
        .moveTo(x, y)
        .lineTo(x, y + len * flipY)
        .stroke()
        .restore();
    };

    const fitTextInBox = ({
      text,
      x,
      y,
      width,
      height,
      maxFontSize = 22,
      minFontSize = 14,
      color = navy,
    }) => {
      let fontSize = maxFontSize;
      let textHeight = 0;

      while (fontSize >= minFontSize) {
        doc.font("Helvetica-Bold").fontSize(fontSize);
        textHeight = doc.heightOfString(text, {
          width,
          align: "center",
          lineGap: 2,
        });

        if (textHeight <= height - 12) break;
        fontSize -= 1;
      }

      const textY = y + (height - textHeight) / 2;

      doc
        .font("Helvetica-Bold")
        .fontSize(fontSize)
        .fillColor(color)
        .text(text, x, textY, {
          width,
          align: "center",
          lineGap: 2,
        });
    };

    // Background
    doc.rect(0, 0, pageWidth, pageHeight).fill(light);

    // Top-left logo
    try {
      doc.image(LOGO_PATH, 48, 40, {
        fit: [75, 75],
        align: "left",
        valign: "top",
      });
    } catch (error) {
      console.error("Failed to load logo image:", error);
    }

    // Borders
    doc
      .lineWidth(3)
      .strokeColor(navy)
      .rect(18, 18, pageWidth - 36, pageHeight - 36)
      .stroke();

    doc
      .lineWidth(1.5)
      .strokeColor(gold)
      .rect(30, 30, pageWidth - 60, pageHeight - 60)
      .stroke();

    doc
      .lineWidth(0.8)
      .strokeColor(softGold)
      .rect(38, 38, pageWidth - 76, pageHeight - 76)
      .stroke();

    drawCornerAccent(30, 30, 1, 1);
    drawCornerAccent(pageWidth - 30, 30, -1, 1);
    drawCornerAccent(30, pageHeight - 30, 1, -1);
    drawCornerAccent(pageWidth - 30, pageHeight - 30, -1, -1);

    // Header
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(burgundy)
      .text("ARTISTIC VICKY", 0, 45, {
        align: "center",
      });

    doc
      .moveTo(170, 64)
      .lineTo(pageWidth - 170, 64)
      .lineWidth(1.5)
      .strokeColor(gold)
      .stroke();

    // Title
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor(navy)
      .text("CERTIFICATE OF COMPLETION", 0, 78, {
        align: "center",
      });

    doc
      .font("Helvetica")
      .fontSize(13)
      .fillColor(gray)
      .text("This prestigious certificate is proudly presented to", 0, 118, {
        align: "center",
      });

    // Student name
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor(burgundy)
      .text(user?.name || "Student Name", 100, 155, {
        align: "center",
        width: pageWidth - 200,
      });

    doc
      .moveTo(centerX - 180, 198)
      .lineTo(centerX + 180, 198)
      .lineWidth(1.8)
      .strokeColor(gold)
      .stroke();

    // Body line
    doc
      .font("Helvetica")
      .fontSize(14)
      .fillColor(gray)
      .text(
        "for successfully completing the certified academic program",
        120,
        220,
        {
          align: "center",
          width: pageWidth - 240,
        },
      );

    // Course box
    const courseBoxX = 95;
    const courseBoxY = 265;
    const courseBoxWidth = pageWidth - 190;
    const courseBoxHeight = 72;

    doc
      .roundedRect(courseBoxX, courseBoxY, courseBoxWidth, courseBoxHeight, 12)
      .fillAndStroke("#FFF8E6", gold);

    fitTextInBox({
      text: course?.name || "Course Name",
      x: courseBoxX + 18,
      y: courseBoxY + 4,
      width: courseBoxWidth - 36,
      height: courseBoxHeight - 8,
      maxFontSize: 22,
      minFontSize: 13,
      color: navy,
    });

    // Supporting text
    doc
      .font("Helvetica")
      .fontSize(11.5)
      .fillColor(gray)
      .text(
        "In recognition of dedication, discipline, and successful fulfillment of the required learning objectives.",
        135,
        355,
        {
          width: pageWidth - 270,
          align: "center",
          lineGap: 2,
        },
      );

    // Meta boxes
    doc.roundedRect(80, 425, 185, 50, 8).fillAndStroke("#FFFFFF", softGold);

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(burgundy)
      .text("CERTIFICATE NO", 95, 438);

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(navy)
      .text(certificateNumber, 95, 454);

    doc
      .roundedRect(pageWidth - 265, 425, 185, 50, 8)
      .fillAndStroke("#FFFFFF", softGold);

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(burgundy)
      .text("ISSUE DATE", pageWidth - 250, 438);

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(navy)
      .text(issueDate, pageWidth - 250, 454);

    // Seal
    drawSeal(centerX, 450);

    // Signature image
    try {
      const signatureBoxX = pageWidth - 245;
      const signatureBoxY = 480;
      const signatureBoxWidth = 150;
      const signatureImageWidth = 130;
      const signatureImageHeight = 50;

      doc.image(
        SIGNATURE_PATH,
        signatureBoxX + (signatureBoxWidth - signatureImageWidth) / 2,
        signatureBoxY,
        {
          fit: [signatureImageWidth, signatureImageHeight],
          align: "center",
          valign: "center",
        },
      );
    } catch (error) {
      console.error("Failed to load signature image:", error);
    }

    // Signature area
    doc
      .moveTo(pageWidth - 245, 515)
      .lineTo(pageWidth - 95, 515)
      .lineWidth(1)
      .strokeColor(gray)
      .stroke();

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(navy)
      .text("Artistic Vicky", pageWidth - 245, 522, {
        width: 150,
        align: "center",
      });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(gray)
      .text("Institute / Platform", pageWidth - 245, 538, {
        width: 150,
        align: "center",
      });

    doc.end();
  });
}
